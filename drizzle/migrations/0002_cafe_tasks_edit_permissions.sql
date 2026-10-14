
CREATE OR REPLACE FUNCTION public.cafe_task_write_open(_group_id uuid, _builder_run_id uuid, _run_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.is_class_instructor(public.group_class_id(_group_id), _user_id) THEN true
    WHEN _builder_run_id IS NOT NULL THEN public.builder_run_can_edit(_builder_run_id, _user_id)
    WHEN _run_id IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.cafe_group_runs r WHERE r.id = _run_id AND r.status <> 'submitted')
    ELSE true
  END;
$$;

CREATE OR REPLACE FUNCTION public.cafe_task_can_manage(_task_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cafe_tasks t
    WHERE t.id = _task_id
      AND public.cafe_task_write_open(t.group_id, t.builder_run_id, t.run_id, _user_id)
      AND (public.can_manage_group(t.group_id, _user_id)
           OR (t.created_by = _user_id AND public.is_group_member(t.group_id, _user_id)))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.cafe_task_write_open(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cafe_task_can_manage(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cafe_task_write_open(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_task_can_manage(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS cafe_tasks_insert ON public.cafe_tasks;
CREATE POLICY cafe_tasks_insert ON public.cafe_tasks FOR INSERT TO authenticated
WITH CHECK (
  public.can_manage_group(group_id, auth.uid()) AND created_by = auth.uid()
  AND public.cafe_task_write_open(group_id, builder_run_id, run_id, auth.uid())
);

DROP POLICY IF EXISTS cafe_tasks_update ON public.cafe_tasks;
CREATE POLICY cafe_tasks_update ON public.cafe_tasks FOR UPDATE TO authenticated
USING (
  public.cafe_task_write_open(group_id, builder_run_id, run_id, auth.uid())
  AND (
    public.can_manage_group(group_id, auth.uid())
    OR (created_by = auth.uid() AND public.is_group_member(group_id, auth.uid()))
    OR assignee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.cafe_task_collaborators c WHERE c.task_id = cafe_tasks.id AND c.student_id = auth.uid())
  )
)
WITH CHECK (
  public.cafe_task_write_open(group_id, builder_run_id, run_id, auth.uid())
  AND (
    public.can_manage_group(group_id, auth.uid())
    OR (created_by = auth.uid() AND public.is_group_member(group_id, auth.uid()))
    OR assignee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.cafe_task_collaborators c WHERE c.task_id = cafe_tasks.id AND c.student_id = auth.uid())
  )
);

DROP POLICY IF EXISTS cafe_tasks_delete ON public.cafe_tasks;
CREATE POLICY cafe_tasks_delete ON public.cafe_tasks FOR DELETE TO authenticated
USING (
  public.cafe_task_write_open(group_id, builder_run_id, run_id, auth.uid())
  AND (
    public.can_manage_group(group_id, auth.uid())
    OR (created_by = auth.uid() AND public.is_group_member(group_id, auth.uid()))
  )
);

CREATE OR REPLACE FUNCTION public.cafe_tasks_update_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN NEW; END IF;
  -- Vínculos estruturais nunca mudam por requisição de usuário.
  IF NEW.group_id IS DISTINCT FROM OLD.group_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.builder_run_id IS DISTINCT FROM OLD.builder_run_id
     OR NEW.run_id IS DISTINCT FROM OLD.run_id
     OR NEW.mission_id IS DISTINCT FROM OLD.mission_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Campos de autoria, equipe e vínculo da tarefa não podem ser alterados.' USING ERRCODE = '42501';
  END IF;
  -- Responsável/colaborador sem papel de gestão: não redistribui nem muda o bloco.
  IF NOT (public.can_manage_group(OLD.group_id, _uid)
          OR (OLD.created_by = _uid AND public.is_group_member(OLD.group_id, _uid))) THEN
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
       OR NEW.section_id IS DISTINCT FROM OLD.section_id
       OR NEW.position IS DISTINCT FROM OLD.position THEN
      RAISE EXCEPTION 'Somente o autor da tarefa, o QA Líder ou o instrutor podem alterar responsáveis ou o bloco.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cafe_tasks_update_guard_trg ON public.cafe_tasks;
CREATE TRIGGER cafe_tasks_update_guard_trg BEFORE UPDATE ON public.cafe_tasks
FOR EACH ROW EXECUTE FUNCTION public.cafe_tasks_update_guard();

DROP POLICY IF EXISTS cafe_collab_write ON public.cafe_task_collaborators;
CREATE POLICY cafe_collab_insert ON public.cafe_task_collaborators FOR INSERT TO authenticated
WITH CHECK (
  public.cafe_task_can_manage(task_id, auth.uid())
  AND added_by = auth.uid()
  AND group_id = (SELECT t.group_id FROM public.cafe_tasks t WHERE t.id = task_id)
);
CREATE POLICY cafe_collab_update ON public.cafe_task_collaborators FOR UPDATE TO authenticated
USING (public.cafe_task_can_manage(task_id, auth.uid()))
WITH CHECK (public.cafe_task_can_manage(task_id, auth.uid())
  AND group_id = (SELECT t.group_id FROM public.cafe_tasks t WHERE t.id = task_id));
CREATE POLICY cafe_collab_delete ON public.cafe_task_collaborators FOR DELETE TO authenticated
USING (public.cafe_task_can_manage(task_id, auth.uid()));
