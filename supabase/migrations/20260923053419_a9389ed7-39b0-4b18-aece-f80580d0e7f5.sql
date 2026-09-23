CREATE OR REPLACE FUNCTION public.techeduca_evidences_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.student_id := OLD.student_id;
  NEW.created_at := OLD.created_at;
  NEW.run_id := OLD.run_id;
  NEW.bug_report_id := OLD.bug_report_id;
  IF NEW.file_path IS NULL THEN
    NEW.file_path := OLD.file_path;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS techeduca_evidences_immutable_trg ON public.techeduca_evidences;
CREATE TRIGGER techeduca_evidences_immutable_trg
BEFORE UPDATE ON public.techeduca_evidences
FOR EACH ROW EXECUTE FUNCTION public.techeduca_evidences_immutable();

DROP POLICY IF EXISTS techeduca_evidences_update_own ON public.techeduca_evidences;
CREATE POLICY techeduca_evidences_update_own ON public.techeduca_evidences
FOR UPDATE TO authenticated
USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'instructor'))
WITH CHECK (student_id = auth.uid() OR public.has_role(auth.uid(), 'instructor'));

REVOKE EXECUTE ON FUNCTION public.techeduca_evidences_immutable() FROM anon, public;