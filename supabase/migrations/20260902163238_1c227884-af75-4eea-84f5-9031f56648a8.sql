DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', f.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
  -- gatilho interno: não deve ser chamável pela API
  REVOKE EXECUTE ON FUNCTION public.builder_runs_eval_guard() FROM authenticated;
END $$;