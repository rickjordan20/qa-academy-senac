-- Edição da missão passa a depender do estado da avaliação, não do envio.
-- Editável: eval_status NULL / 'none' / 'awaiting' / 'revision'
-- Bloqueado: 'in_review' / 'evaluated' / 'reeval'

CREATE OR REPLACE FUNCTION public.builder_run_editable_status(_eval_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT _eval_status IS NULL
      OR _eval_status NOT IN ('in_review', 'evaluated', 'reeval');
$function$;

REVOKE EXECUTE ON FUNCTION public.builder_run_editable_status(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.builder_run_editable_status(text) TO authenticated;

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
        (
          (m.opens_at IS NULL OR now() >= m.opens_at)
          AND public.builder_run_editable_status(r.eval_status)
        )
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
  (
    (public.builder_mission_open(mission_id) AND public.builder_run_editable_status(eval_status))
    OR (eval_status = 'revision' AND public.builder_mission_published(mission_id))
  )
  AND ((student_id = auth.uid()) OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())))
)
WITH CHECK (
  (
    (public.builder_mission_open(mission_id) AND public.builder_run_editable_status(eval_status))
    OR (eval_status = 'revision' AND public.builder_mission_published(mission_id))
  )
  AND ((student_id = auth.uid()) OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())))
);