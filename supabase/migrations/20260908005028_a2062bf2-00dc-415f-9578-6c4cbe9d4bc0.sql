CREATE TABLE public.evaluation_acknowledgments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_version text NOT NULL DEFAULT 'uc10-avaliacao-v1',
  acknowledged_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (student_id, content_version)
);
GRANT SELECT, INSERT ON public.evaluation_acknowledgments TO authenticated;
GRANT ALL ON public.evaluation_acknowledgments TO service_role;
ALTER TABLE public.evaluation_acknowledgments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Aluno lê a própria ciência" ON public.evaluation_acknowledgments FOR SELECT TO authenticated USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Aluno registra a própria ciência" ON public.evaluation_acknowledgments FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id AND public.has_role(auth.uid(), 'student'));