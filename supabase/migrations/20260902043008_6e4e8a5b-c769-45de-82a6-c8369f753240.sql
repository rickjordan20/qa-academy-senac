CREATE UNIQUE INDEX IF NOT EXISTS cafe_task_collaborators_unique
  ON public.cafe_task_collaborators (task_id, student_id);

ALTER TABLE public.cafe_contributions
  ADD COLUMN IF NOT EXISTS section_id text,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'individual';

DROP POLICY IF EXISTS cafe_tasks_update ON public.cafe_tasks;
CREATE POLICY cafe_tasks_update ON public.cafe_tasks
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_group(group_id, auth.uid())
    OR assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.cafe_task_collaborators c
      WHERE c.task_id = cafe_tasks.id AND c.student_id = auth.uid()
    )
  )
  WITH CHECK (
    public.can_manage_group(group_id, auth.uid())
    OR assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.cafe_task_collaborators c
      WHERE c.task_id = cafe_tasks.id AND c.student_id = auth.uid()
    )
  );