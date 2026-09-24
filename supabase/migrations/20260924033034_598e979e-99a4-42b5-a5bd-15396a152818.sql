-- Abertura das missões passa a ser bloqueio real (opens_at), preservando revisão.

CREATE OR REPLACE FUNCTION public.builder_mission_published(_mission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.builder_missions m WHERE m.id = _mission_id AND m.status = 'published');
$function$;

CREATE OR REPLACE FUNCTION public.builder_mission_open(_mission_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.builder_missions m
    WHERE m.id = _mission_id
      AND m.status = 'published'
      AND (m.opens_at IS NULL OR now() >= m.opens_at)
  );
$function$;

CREATE OR REPLACE FUNCTION public.builder_run_can_edit(_run_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.builder_mission_runs r
    JOIN public.builder_missions m ON m.id = r.mission_id
    WHERE r.id = _run_id
      AND m.status = 'published'
      AND (
        (m.opens_at IS NULL OR now() >= m.opens_at)
        OR r.eval_status = 'revision'
      )
      AND (r.student_id = _user_id OR (r.group_id IS NOT NULL AND public.is_group_member(r.group_id, _user_id)))
  );
$function$;

DROP POLICY IF EXISTS "Participante atualiza execucao aberta" ON public.builder_mission_runs;
CREATE POLICY "Participante atualiza execucao aberta"
ON public.builder_mission_runs
FOR UPDATE
USING (
  (public.builder_mission_open(mission_id)
    OR (eval_status = 'revision' AND public.builder_mission_published(mission_id)))
  AND ((student_id = auth.uid()) OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())))
)
WITH CHECK (
  (public.builder_mission_open(mission_id)
    OR (eval_status = 'revision' AND public.builder_mission_published(mission_id)))
  AND ((student_id = auth.uid()) OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())))
);