-- =========================================================
-- Google Classroom — Fase 1 (somente conciliacao de identidades)
-- =========================================================

-- 1) Conexao OAuth do instrutor (SERVER-ONLY: sem GRANT para authenticated/anon)
CREATE TABLE public.google_classroom_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL UNIQUE,
  google_email TEXT NOT NULL,
  google_user_id TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.google_classroom_connections TO service_role;

ALTER TABLE public.google_classroom_connections ENABLE ROW LEVEL SECURITY;

-- Sem policies para authenticated/anon: tabela acessivel apenas server-side.
CREATE POLICY "gcc_service_role_only" ON public.google_classroom_connections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER gcc_updated_at BEFORE UPDATE ON public.google_classroom_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Vinculo turma QA Academy <-> turma Classroom
CREATE TABLE public.google_classroom_class_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL UNIQUE REFERENCES public.classes(id) ON DELETE CASCADE,
  classroom_course_id TEXT NOT NULL,
  classroom_course_name TEXT NOT NULL DEFAULT '',
  classroom_section TEXT,
  linked_by UUID NOT NULL,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.google_classroom_class_links TO authenticated;
GRANT ALL ON public.google_classroom_class_links TO service_role;

ALTER TABLE public.google_classroom_class_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gccl_instructor_select" ON public.google_classroom_class_links
  FOR SELECT TO authenticated
  USING (public.is_class_instructor(class_id, auth.uid()));

CREATE TRIGGER gccl_updated_at BEFORE UPDATE ON public.google_classroom_class_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Vinculo aluno QA Academy <-> aluno Classroom
CREATE TABLE public.google_classroom_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  classroom_user_id TEXT NOT NULL,
  classroom_email TEXT NOT NULL DEFAULT '',
  classroom_name TEXT NOT NULL DEFAULT '',
  match_type TEXT NOT NULL CHECK (match_type IN ('auto_email', 'manual')),
  linked_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gcsl_unique_student UNIQUE (class_id, student_id),
  CONSTRAINT gcsl_unique_classroom_user UNIQUE (class_id, classroom_user_id)
);

GRANT SELECT ON public.google_classroom_student_links TO authenticated;
GRANT ALL ON public.google_classroom_student_links TO service_role;

ALTER TABLE public.google_classroom_student_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gcsl_instructor_select" ON public.google_classroom_student_links
  FOR SELECT TO authenticated
  USING (public.is_class_instructor(class_id, auth.uid()));

CREATE TRIGGER gcsl_updated_at BEFORE UPDATE ON public.google_classroom_student_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX gcsl_class_idx ON public.google_classroom_student_links (class_id);