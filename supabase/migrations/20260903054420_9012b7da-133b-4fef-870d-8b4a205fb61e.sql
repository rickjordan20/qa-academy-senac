CREATE TABLE IF NOT EXISTS public.builder_run_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.builder_mission_runs(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.builder_missions(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  evaluator_id uuid,
  xp integer,
  feedback text NOT NULL DEFAULT '',
  block_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  indicator_finals jsonb NOT NULL DEFAULT '{}'::jsonb,
  group_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_student_ids uuid[] NOT NULL DEFAULT '{}',
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (run_id, version)
);

GRANT SELECT, INSERT, UPDATE ON public.builder_run_evaluations TO authenticated;
GRANT ALL ON public.builder_run_evaluations TO service_role;

ALTER TABLE public.builder_run_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instrutor gerencia avaliacoes de missao"
ON public.builder_run_evaluations FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'))
WITH CHECK (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Participantes veem avaliacoes do proprio envio"
ON public.builder_run_evaluations FOR SELECT TO authenticated
USING (public.builder_run_can_view(run_id, auth.uid()));

CREATE INDEX IF NOT EXISTS builder_run_evaluations_run_idx ON public.builder_run_evaluations(run_id);
CREATE INDEX IF NOT EXISTS builder_run_evaluations_mission_idx ON public.builder_run_evaluations(mission_id);

CREATE TRIGGER builder_run_evaluations_updated_at
BEFORE UPDATE ON public.builder_run_evaluations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.indicator_evaluations
  ADD COLUMN IF NOT EXISTS source_mission_id uuid,
  ADD COLUMN IF NOT EXISTS source_run_id uuid,
  ADD COLUMN IF NOT EXISTS source_evaluation_id uuid;