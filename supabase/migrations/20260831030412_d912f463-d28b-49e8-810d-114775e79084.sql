GRANT EXECUTE ON FUNCTION public.shares_class(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_class_instructor(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.group_class_id(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enroll_student_by_email(uuid, text) TO authenticated, service_role;