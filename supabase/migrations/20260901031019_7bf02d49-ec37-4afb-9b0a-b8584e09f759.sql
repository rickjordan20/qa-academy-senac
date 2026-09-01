DROP POLICY IF EXISTS groups_update ON public.groups;
CREATE POLICY groups_update ON public.groups
FOR UPDATE TO authenticated
USING (public.is_class_instructor(class_id, auth.uid()) OR public.is_group_qa_lead(id, auth.uid()))
WITH CHECK (public.is_class_instructor(class_id, auth.uid()) OR public.is_group_qa_lead(id, auth.uid()));

CREATE OR REPLACE FUNCTION public.groups_qa_lead_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_class_instructor(NEW.class_id, auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.class_id IS DISTINCT FROM OLD.class_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.qa_lead_id IS DISTINCT FROM OLD.qa_lead_id THEN
    RAISE EXCEPTION 'O QA Lead pode alterar apenas o nome e a descricao do grupo.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS groups_qa_lead_guard_trg ON public.groups;
CREATE TRIGGER groups_qa_lead_guard_trg
BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.groups_qa_lead_guard();

DROP POLICY IF EXISTS group_members_write ON public.group_members;
CREATE POLICY group_members_write ON public.group_members
FOR ALL TO authenticated
USING (
  public.is_class_instructor(public.group_class_id(group_id), auth.uid())
  OR public.is_group_qa_lead(group_id, auth.uid())
)
WITH CHECK (
  public.is_class_instructor(public.group_class_id(group_id), auth.uid())
  OR (
    public.is_group_qa_lead(group_id, auth.uid())
    AND public.is_class_member(public.group_class_id(group_id), student_id)
  )
);