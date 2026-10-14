DROP POLICY IF EXISTS cafe_tasks_delete ON public.cafe_tasks;
CREATE POLICY cafe_tasks_delete ON public.cafe_tasks
  FOR DELETE TO authenticated
  USING (
    public.can_manage_group(group_id, auth.uid())
    OR (created_by = auth.uid() AND public.is_group_member(group_id, auth.uid()))
  );