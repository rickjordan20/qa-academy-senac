ALTER TABLE public.builder_mission_runs
  ADD COLUMN IF NOT EXISTS eval_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp_awarded integer,
  ADD COLUMN IF NOT EXISTS feedback text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS evaluated_by uuid,
  ADD COLUMN IF NOT EXISTS evaluated_at timestamptz;

UPDATE public.builder_mission_runs
   SET eval_status = 'awaiting'
 WHERE submitted_at IS NOT NULL AND eval_status = 'none';

CREATE TABLE IF NOT EXISTS public.builder_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.builder_mission_runs(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.builder_missions(id) ON DELETE CASCADE,
  actor_id uuid,
  kind text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.builder_run_events TO authenticated;
GRANT ALL ON public.builder_run_events TO service_role;

ALTER TABLE public.builder_run_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instrutor ve eventos" ON public.builder_run_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Participante ve eventos da propria execucao" ON public.builder_run_events
  FOR SELECT TO authenticated USING (public.builder_run_can_view(run_id, auth.uid()));

CREATE POLICY "Registro de eventos" ON public.builder_run_events
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (public.has_role(auth.uid(), 'instructor') OR public.builder_run_can_view(run_id, auth.uid()))
  );

CREATE INDEX IF NOT EXISTS builder_run_events_run_idx ON public.builder_run_events(run_id, created_at);

INSERT INTO public.builder_run_events (run_id, mission_id, actor_id, kind, attempt, note, created_at)
SELECT r.id, r.mission_id, COALESCE(r.student_id, r.submitted_by, r.created_by), 'submitted', 1, '', r.submitted_at
  FROM public.builder_mission_runs r
 WHERE r.submitted_at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.builder_run_events e WHERE e.run_id = r.id AND e.kind = 'submitted');

CREATE POLICY "Instrutor avalia execucoes" ON public.builder_mission_runs
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'instructor'))
  WITH CHECK (public.has_role(auth.uid(), 'instructor'));

DROP POLICY IF EXISTS "Participante atualiza execucao aberta" ON public.builder_mission_runs;
CREATE POLICY "Participante atualiza execucao aberta" ON public.builder_mission_runs
  FOR UPDATE TO authenticated
  USING (
    public.builder_mission_open(mission_id)
    AND (student_id = auth.uid() OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())))
  )
  WITH CHECK (
    public.builder_mission_open(mission_id)
    AND (student_id = auth.uid() OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())))
  );

CREATE OR REPLACE FUNCTION public.gam_apply_action_config()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE a public.gam_actions%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.gam_actions WHERE code = NEW.action_code;
  IF a.code IS NULL OR NOT a.enabled THEN
    RAISE EXCEPTION 'Ação de XP inválida ou desativada: %', NEW.action_code;
  END IF;
  IF public.has_role(auth.uid(), 'instructor') THEN
    -- o instrutor pode definir manualmente o XP ao avaliar
    NEW.xp := COALESCE(NEW.xp, a.xp);
  ELSE
    NEW.xp := a.xp;
  END IF;
  NEW.kind := a.kind;
  IF NOT public.has_role(auth.uid(), 'instructor') THEN
    NEW.status := CASE WHEN a.requires_validation THEN 'pending' ELSE 'approved' END;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END; $function$;

INSERT INTO public.gam_actions (code, label, description, xp, kind, context, requires_validation, enabled, position)
VALUES ('builder_mission_evaluated', 'Missão avaliada pelo instrutor', 'XP concedido pelo instrutor na avaliação da missão', 0, 'individual', 'both', false, true, 90)
ON CONFLICT (code) DO NOTHING;