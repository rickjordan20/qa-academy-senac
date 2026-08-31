-- =========================================================
-- MOTOR DE MISSÕES (CONSTRUTOR UNIVERSAL)
-- =========================================================

CREATE TABLE public.builder_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_number integer,
  code text,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  project text NOT NULL DEFAULT 'techeduca',
  template text NOT NULL DEFAULT 'techeduca',
  modality text NOT NULL DEFAULT 'individual',
  workload text NOT NULL DEFAULT '',
  objective text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  opens_at timestamptz,
  due_at timestamptz,
  base_xp integer NOT NULL DEFAULT 0,
  badge_code text,
  indicator_codes text[] NOT NULL DEFAULT '{}',
  feature_ids uuid[] NOT NULL DEFAULT '{}',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_library_template boolean NOT NULL DEFAULT false,
  library_name text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.builder_mission_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.builder_missions(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, class_id)
);

CREATE TABLE public.builder_mission_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.builder_missions(id) ON DELETE CASCADE,
  student_id uuid,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress',
  progress integer NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  checklist_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  submitted_by uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX builder_runs_student_uk
  ON public.builder_mission_runs (mission_id, student_id) WHERE student_id IS NOT NULL;
CREATE UNIQUE INDEX builder_runs_group_uk
  ON public.builder_mission_runs (mission_id, group_id) WHERE group_id IS NOT NULL;

CREATE TABLE public.builder_mission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.builder_mission_runs(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES public.builder_missions(id) ON DELETE CASCADE,
  section_id text NOT NULL,
  kind text NOT NULL,
  author_id uuid NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.builder_mission_entries(id) ON DELETE SET NULL,
  feature_id uuid REFERENCES public.app_features(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_path text,
  link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX builder_entries_run_idx ON public.builder_mission_entries (run_id, section_id);

-- GRANTS -------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.builder_missions TO authenticated;
GRANT ALL ON public.builder_missions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.builder_mission_assignments TO authenticated;
GRANT ALL ON public.builder_mission_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.builder_mission_runs TO authenticated;
GRANT ALL ON public.builder_mission_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.builder_mission_entries TO authenticated;
GRANT ALL ON public.builder_mission_entries TO service_role;

-- FUNÇÕES DE SEGURANÇA -----------------------------------
CREATE OR REPLACE FUNCTION public.builder_mission_visible(_mission_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.builder_missions m
    WHERE m.id = _mission_id
      AND m.is_library_template = false
      AND m.status IN ('published','closed')
      AND (
        NOT EXISTS (SELECT 1 FROM public.builder_mission_assignments a WHERE a.mission_id = m.id)
        OR EXISTS (
          SELECT 1 FROM public.builder_mission_assignments a
          JOIN public.enrollments e ON e.class_id = a.class_id
          WHERE a.mission_id = m.id AND e.student_id = _user_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.builder_mission_open(_mission_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.builder_missions m WHERE m.id = _mission_id AND m.status = 'published');
$$;

CREATE OR REPLACE FUNCTION public.builder_run_can_view(_run_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.builder_mission_runs r
    WHERE r.id = _run_id
      AND (r.student_id = _user_id OR (r.group_id IS NOT NULL AND public.can_view_group(r.group_id, _user_id)))
  );
$$;

CREATE OR REPLACE FUNCTION public.builder_run_can_edit(_run_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.builder_mission_runs r
    JOIN public.builder_missions m ON m.id = r.mission_id
    WHERE r.id = _run_id
      AND m.status = 'published'
      AND (r.student_id = _user_id OR (r.group_id IS NOT NULL AND public.is_group_member(r.group_id, _user_id)))
  );
$$;

GRANT EXECUTE ON FUNCTION public.builder_mission_visible(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.builder_mission_open(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.builder_run_can_view(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.builder_run_can_edit(uuid, uuid) TO authenticated;

-- RLS ----------------------------------------------------
ALTER TABLE public.builder_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instrutor gerencia missoes" ON public.builder_missions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'instructor'))
  WITH CHECK (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Aluno ve missoes publicadas da turma" ON public.builder_missions
  FOR SELECT TO authenticated
  USING (public.builder_mission_visible(id, auth.uid()));

ALTER TABLE public.builder_mission_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instrutor gerencia turmas da missao" ON public.builder_mission_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'instructor'))
  WITH CHECK (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Aluno ve turmas das missoes visiveis" ON public.builder_mission_assignments
  FOR SELECT TO authenticated
  USING (public.builder_mission_visible(mission_id, auth.uid()));

ALTER TABLE public.builder_mission_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instrutor ve todas as execucoes" ON public.builder_mission_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Participante ve a propria execucao" ON public.builder_mission_runs
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR (group_id IS NOT NULL AND public.can_view_group(group_id, auth.uid())));

CREATE POLICY "Participante cria execucao" ON public.builder_mission_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.builder_mission_open(mission_id)
    AND public.builder_mission_visible(mission_id, auth.uid())
    AND (
      (student_id = auth.uid() AND group_id IS NULL)
      OR (group_id IS NOT NULL AND student_id IS NULL AND public.is_group_member(group_id, auth.uid()))
    )
  );

CREATE POLICY "Participante atualiza execucao aberta" ON public.builder_mission_runs
  FOR UPDATE TO authenticated
  USING (
    public.builder_mission_open(mission_id)
    AND (student_id = auth.uid() OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())))
  )
  WITH CHECK (
    public.builder_mission_open(mission_id)
    AND (student_id = auth.uid() OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid())))
  );

ALTER TABLE public.builder_mission_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instrutor ve todos os registros" ON public.builder_mission_entries
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Participante ve registros da execucao" ON public.builder_mission_entries
  FOR SELECT TO authenticated
  USING (public.builder_run_can_view(run_id, auth.uid()));

CREATE POLICY "Autor cria registro" ON public.builder_mission_entries
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.builder_run_can_edit(run_id, auth.uid()));

CREATE POLICY "Autor edita o proprio registro" ON public.builder_mission_entries
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND public.builder_run_can_edit(run_id, auth.uid()))
  WITH CHECK (author_id = auth.uid() AND public.builder_run_can_edit(run_id, auth.uid()));

CREATE POLICY "Autor remove o proprio registro" ON public.builder_mission_entries
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() AND public.builder_run_can_edit(run_id, auth.uid()));

CREATE POLICY "Instrutor edita registros" ON public.builder_mission_entries
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'instructor'))
  WITH CHECK (public.has_role(auth.uid(), 'instructor'));

-- TRIGGERS updated_at ------------------------------------
CREATE TRIGGER builder_missions_updated_at BEFORE UPDATE ON public.builder_missions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER builder_runs_updated_at BEFORE UPDATE ON public.builder_mission_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER builder_entries_updated_at BEFORE UPDATE ON public.builder_mission_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AÇÕES DE XP DO MOTOR -----------------------------------
INSERT INTO public.gam_actions (code, label, description, xp, kind, context, requires_validation, enabled, position)
VALUES
  ('builder_mission_complete', 'Missão concluída (construtor)', 'Conclusão de uma missão criada no construtor.', 50, 'individual', 'both', false, true, 90),
  ('builder_block_submit', 'Entrega de bloco da missão', 'Registro enviado em um bloco de missão, sujeito à validação do instrutor.', 10, 'individual', 'both', true, true, 91)
ON CONFLICT (code) DO NOTHING;