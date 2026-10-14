DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    GRANT EXECUTE ON FUNCTION public.cafe_task_write_open(uuid, uuid, uuid, uuid) TO sandbox_exec;
    GRANT EXECUTE ON FUNCTION public.cafe_task_can_manage(uuid, uuid) TO sandbox_exec;
  END IF;
END $$;