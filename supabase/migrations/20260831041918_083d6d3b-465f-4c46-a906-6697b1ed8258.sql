REVOKE EXECUTE ON FUNCTION public.builder_mission_visible(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.builder_mission_open(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.builder_run_can_view(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.builder_run_can_edit(uuid, uuid) FROM PUBLIC, anon;