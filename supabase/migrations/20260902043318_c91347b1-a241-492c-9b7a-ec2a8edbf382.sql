DROP POLICY IF EXISTS gam_xp_events_insert ON public.gam_xp_events;
CREATE POLICY gam_xp_events_insert ON public.gam_xp_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'instructor'::public.app_role)
    OR (student_id = auth.uid() AND status = 'pending')
    OR (
      student_id IS NULL
      AND group_id IS NOT NULL
      AND status = 'pending'
      AND public.is_group_member(group_id, auth.uid())
    )
  );