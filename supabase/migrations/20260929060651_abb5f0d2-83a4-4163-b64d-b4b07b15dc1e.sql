CREATE TABLE public.google_classroom_ignored_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  classroom_user_id TEXT NOT NULL,
  classroom_email TEXT NOT NULL DEFAULT '',
  classroom_name TEXT NOT NULL DEFAULT '',
  ignored_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gcis_unique_classroom_user UNIQUE (class_id, classroom_user_id)
);

GRANT SELECT ON public.google_classroom_ignored_students TO authenticated;
GRANT ALL ON public.google_classroom_ignored_students TO service_role;

ALTER TABLE public.google_classroom_ignored_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gcis_instructor_select" ON public.google_classroom_ignored_students
  FOR SELECT TO authenticated
  USING (public.is_class_instructor(class_id, auth.uid()));

CREATE TRIGGER gcis_updated_at BEFORE UPDATE ON public.google_classroom_ignored_students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX gcis_class_idx ON public.google_classroom_ignored_students (class_id);