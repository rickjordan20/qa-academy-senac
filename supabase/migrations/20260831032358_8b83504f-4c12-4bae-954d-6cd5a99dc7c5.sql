-- helper: instructor of a student's class
CREATE OR REPLACE FUNCTION public.qa_is_instructor_of(_student uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.classes c ON c.id = e.class_id
    WHERE e.student_id = _student AND c.instructor_id = _viewer
  );
$$;

CREATE OR REPLACE FUNCTION public.qa_can_view(_author uuid, _group_id uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _author = _viewer
      OR (_group_id IS NOT NULL AND public.can_view_group(_group_id, _viewer))
      OR public.qa_is_instructor_of(_author, _viewer);
$$;

CREATE OR REPLACE FUNCTION public.qa_can_edit(_author uuid, _group_id uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _author = _viewer
      OR (_group_id IS NOT NULL AND public.can_manage_group(_group_id, _viewer));
$$;

REVOKE ALL ON FUNCTION public.qa_is_instructor_of(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.qa_can_view(uuid, uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.qa_can_edit(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.qa_is_instructor_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_can_view(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_can_edit(uuid, uuid, uuid) TO authenticated;

-- 1. TEST CASES
CREATE TABLE public.qa_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context text NOT NULL DEFAULT 'techeduca' CHECK (context IN ('techeduca','cafe')),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.techeduca_missions(id) ON DELETE SET NULL,
  project text NOT NULL DEFAULT '',
  title text NOT NULL,
  feature text NOT NULL DEFAULT '',
  precondition text NOT NULL DEFAULT '',
  input_data text NOT NULL DEFAULT '',
  steps text NOT NULL DEFAULT '',
  expected_result text NOT NULL DEFAULT '',
  obtained_result text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'nao_executado'
    CHECK (status IN ('nao_executado','aprovado','reprovado','bloqueado')),
  author_id uuid NOT NULL,
  assignee_id uuid,
  executed_at timestamptz,
  executed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_test_cases TO authenticated;
GRANT ALL ON public.qa_test_cases TO service_role;
ALTER TABLE public.qa_test_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_cases_select" ON public.qa_test_cases FOR SELECT TO authenticated
  USING (public.qa_can_view(author_id, group_id, auth.uid()));
CREATE POLICY "qa_cases_insert" ON public.qa_test_cases FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (group_id IS NULL OR public.is_group_member(group_id, auth.uid())));
CREATE POLICY "qa_cases_update" ON public.qa_test_cases FOR UPDATE TO authenticated
  USING (public.qa_can_edit(author_id, group_id, auth.uid()))
  WITH CHECK (public.qa_can_edit(author_id, group_id, auth.uid()));
CREATE POLICY "qa_cases_delete" ON public.qa_test_cases FOR DELETE TO authenticated
  USING (author_id = auth.uid());
CREATE TRIGGER qa_test_cases_updated_at BEFORE UPDATE ON public.qa_test_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. BUGS
CREATE TABLE public.qa_bugs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context text NOT NULL DEFAULT 'techeduca' CHECK (context IN ('techeduca','cafe')),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.techeduca_missions(id) ON DELETE SET NULL,
  test_case_id uuid REFERENCES public.qa_test_cases(id) ON DELETE SET NULL,
  project text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  environment text NOT NULL DEFAULT '',
  steps text NOT NULL DEFAULT '',
  expected_result text NOT NULL DEFAULT '',
  obtained_result text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'media' CHECK (severity IN ('baixa','media','alta','critica')),
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta','urgente')),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN
    ('aberto','em_analise','confirmado','em_correcao','pronto_reteste','resolvido','reaberto','descartado')),
  author_id uuid NOT NULL,
  assignee_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_bugs TO authenticated;
GRANT ALL ON public.qa_bugs TO service_role;
ALTER TABLE public.qa_bugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_bugs_select" ON public.qa_bugs FOR SELECT TO authenticated
  USING (public.qa_can_view(author_id, group_id, auth.uid()));
CREATE POLICY "qa_bugs_insert" ON public.qa_bugs FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (group_id IS NULL OR public.is_group_member(group_id, auth.uid())));
CREATE POLICY "qa_bugs_update" ON public.qa_bugs FOR UPDATE TO authenticated
  USING (public.qa_can_edit(author_id, group_id, auth.uid()))
  WITH CHECK (public.qa_can_edit(author_id, group_id, auth.uid()));
CREATE POLICY "qa_bugs_delete" ON public.qa_bugs FOR DELETE TO authenticated
  USING (author_id = auth.uid());
CREATE TRIGGER qa_bugs_updated_at BEFORE UPDATE ON public.qa_bugs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. RETESTS
CREATE TABLE public.qa_retests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id uuid NOT NULL REFERENCES public.qa_bugs(id) ON DELETE CASCADE,
  tester_id uuid NOT NULL,
  result text NOT NULL CHECK (result IN ('resolvido','reaberto')),
  notes text NOT NULL DEFAULT '',
  tested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_retests TO authenticated;
GRANT ALL ON public.qa_retests TO service_role;
ALTER TABLE public.qa_retests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_retests_select" ON public.qa_retests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qa_bugs b WHERE b.id = bug_id
    AND public.qa_can_view(b.author_id, b.group_id, auth.uid())));
CREATE POLICY "qa_retests_insert" ON public.qa_retests FOR INSERT TO authenticated
  WITH CHECK (tester_id = auth.uid() AND EXISTS (SELECT 1 FROM public.qa_bugs b WHERE b.id = bug_id
    AND public.qa_can_view(b.author_id, b.group_id, auth.uid())));
CREATE POLICY "qa_retests_delete" ON public.qa_retests FOR DELETE TO authenticated
  USING (tester_id = auth.uid());

-- 4. EVIDENCES
CREATE TABLE public.qa_evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context text NOT NULL DEFAULT 'techeduca' CHECK (context IN ('techeduca','cafe')),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.techeduca_missions(id) ON DELETE SET NULL,
  test_case_id uuid REFERENCES public.qa_test_cases(id) ON DELETE CASCADE,
  bug_id uuid REFERENCES public.qa_bugs(id) ON DELETE CASCADE,
  retest_id uuid REFERENCES public.qa_retests(id) ON DELETE CASCADE,
  project text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'imagem'
    CHECK (kind IN ('imagem','documento','link','texto','video','log')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  content text,
  link text,
  file_path text,
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_evidences TO authenticated;
GRANT ALL ON public.qa_evidences TO service_role;
ALTER TABLE public.qa_evidences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa_evidences_select" ON public.qa_evidences FOR SELECT TO authenticated
  USING (public.qa_can_view(author_id, group_id, auth.uid()));
CREATE POLICY "qa_evidences_insert" ON public.qa_evidences FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (group_id IS NULL OR public.is_group_member(group_id, auth.uid())));
CREATE POLICY "qa_evidences_update" ON public.qa_evidences FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "qa_evidences_delete" ON public.qa_evidences FOR DELETE TO authenticated
  USING (author_id = auth.uid());
CREATE TRIGGER qa_evidences_updated_at BEFORE UPDATE ON public.qa_evidences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX qa_cases_author_idx ON public.qa_test_cases(author_id);
CREATE INDEX qa_cases_group_idx ON public.qa_test_cases(group_id);
CREATE INDEX qa_bugs_author_idx ON public.qa_bugs(author_id);
CREATE INDEX qa_bugs_group_idx ON public.qa_bugs(group_id);
CREATE INDEX qa_bugs_case_idx ON public.qa_bugs(test_case_id);
CREATE INDEX qa_evidences_author_idx ON public.qa_evidences(author_id);
CREATE INDEX qa_retests_bug_idx ON public.qa_retests(bug_id);