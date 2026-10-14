DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    GRANT EXECUTE ON FUNCTION public.can_manage_group(uuid, uuid) TO sandbox_exec;
    GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO sandbox_exec;
    GRANT EXECUTE ON FUNCTION public.builder_run_can_edit(uuid, uuid) TO sandbox_exec;
  END IF;
END $$;