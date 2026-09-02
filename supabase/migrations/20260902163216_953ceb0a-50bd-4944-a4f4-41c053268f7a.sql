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
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', f.sig);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.builder_runs_eval_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF public.has_role(auth.uid(), 'instructor') THEN
    RETURN NEW;
  END IF;

  IF NEW.xp_awarded IS DISTINCT FROM OLD.xp_awarded
     OR NEW.feedback IS DISTINCT FROM OLD.feedback
     OR NEW.evaluated_by IS DISTINCT FROM OLD.evaluated_by
     OR NEW.evaluated_at IS DISTINCT FROM OLD.evaluated_at THEN
    RAISE EXCEPTION 'Somente o instrutor pode alterar os campos de avaliação';
  END IF;

  IF NEW.eval_status IS DISTINCT FROM OLD.eval_status
     AND NEW.eval_status <> 'awaiting' THEN
    RAISE EXCEPTION 'Somente o instrutor pode alterar o status de avaliação';
  END IF;

  RETURN NEW;
END;
$func$;

REVOKE EXECUTE ON FUNCTION public.builder_runs_eval_guard() FROM anon, authenticated;

DROP TRIGGER IF EXISTS builder_runs_eval_guard_trg ON public.builder_mission_runs;
CREATE TRIGGER builder_runs_eval_guard_trg
BEFORE UPDATE ON public.builder_mission_runs
FOR EACH ROW EXECUTE FUNCTION public.builder_runs_eval_guard();