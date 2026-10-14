CREATE OR REPLACE FUNCTION public.cafe_task_update_violation(_old public.cafe_tasks, _new public.cafe_tasks, _uid uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;
  IF _new.group_id IS DISTINCT FROM _old.group_id
     OR _new.created_by IS DISTINCT FROM _old.created_by
     OR _new.builder_run_id IS DISTINCT FROM _old.builder_run_id
     OR _new.run_id IS DISTINCT FROM _old.run_id
     OR _new.mission_id IS DISTINCT FROM _old.mission_id
     OR _new.created_at IS DISTINCT FROM _old.created_at THEN
    RETURN 'Campos de autoria, equipe e vínculo da tarefa não podem ser alterados.';
  END IF;
  IF NOT (public.can_manage_group(_old.group_id, _uid)
          OR (_old.created_by = _uid AND public.is_group_member(_old.group_id, _uid))) THEN
    IF _new.assignee_id IS DISTINCT FROM _old.assignee_id
       OR _new.section_id IS DISTINCT FROM _old.section_id
       OR _new.position IS DISTINCT FROM _old.position THEN
      RETURN 'Somente o autor da tarefa, o QA Líder ou o instrutor podem alterar responsáveis ou o bloco.';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cafe_task_update_violation(public.cafe_tasks, public.cafe_tasks, uuid) FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    GRANT EXECUTE ON FUNCTION public.cafe_task_update_violation(public.cafe_tasks, public.cafe_tasks, uuid) TO sandbox_exec;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cafe_tasks_update_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _msg text;
BEGIN
  _msg := public.cafe_task_update_violation(OLD, NEW, auth.uid());
  IF _msg IS NOT NULL THEN
    RAISE EXCEPTION '%', _msg USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;