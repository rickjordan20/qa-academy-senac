CREATE TABLE public.google_classroom_coursework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.builder_missions(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  classroom_course_id text NOT NULL,
  coursework_id text NOT NULL,
  alternate_link text,
  published_by uuid NOT NULL,
  last_published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gccw_unique_mission_class UNIQUE (mission_id, class_id)
);
GRANT SELECT ON public.google_classroom_coursework TO authenticated;
GRANT ALL ON public.google_classroom_coursework TO service_role;
ALTER TABLE public.google_classroom_coursework ENABLE ROW LEVEL SECURITY;
CREATE POLICY gccw_instructor_select ON public.google_classroom_coursework
  FOR SELECT TO authenticated USING (public.is_class_instructor(class_id, auth.uid()));
CREATE TRIGGER gccw_updated_at BEFORE UPDATE ON public.google_classroom_coursework
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();