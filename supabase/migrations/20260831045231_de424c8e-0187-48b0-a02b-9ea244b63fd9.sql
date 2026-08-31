-- ============ TURMAS ============
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS course text,
  ADD COLUMN IF NOT EXISTS uc_code text NOT NULL DEFAULT 'UC10',
  ADD COLUMN IF NOT EXISTS workload text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS shift text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';

-- ============ ALUNOS NA TURMA ============
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS student_code text,
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS enrollments_updated_at ON public.enrollments;
CREATE TRIGGER enrollments_updated_at BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "Instructor updates enrollments" ON public.enrollments;
CREATE POLICY "Instructor updates enrollments" ON public.enrollments
  FOR UPDATE TO authenticated
  USING (public.is_class_instructor(class_id, auth.uid()))
  WITH CHECK (public.is_class_instructor(class_id, auth.uid()));

-- ============ GRUPOS ============
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- ============ FUNCIONALIDADES ============
ALTER TABLE public.app_features
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS app_features_base_code_idx
  ON public.app_features (project, code) WHERE group_id IS NULL;

-- funcionalidades iniciais editáveis
INSERT INTO public.app_features (project, group_id, code, name, description, kind, origin, position, category, status)
SELECT v.project, NULL, v.code, v.name, v.description, 'base', 'base_inicial', v.position, v.category, 'active'
FROM (VALUES
  ('techeduca','F01','Início','Página inicial do TechEduca.',1,'navegacao'),
  ('techeduca','F02','Sobre','Página institucional Sobre.',2,'conteudo'),
  ('techeduca','F03','Cursos','Listagem de cursos.',3,'conteudo'),
  ('techeduca','F04','Contato','Formulário/página de contato.',4,'formulario'),
  ('techeduca','F05','Login','Acesso de usuário.',5,'autenticacao'),
  ('techeduca','F06','Cadastro','Registro de novo usuário.',6,'autenticacao'),
  ('techeduca','F07','Detalhes do curso','Página de detalhes de um curso.',7,'conteudo'),
  ('cafe_central','F01','Início','Página inicial do Café Central.',1,'navegacao'),
  ('cafe_central','F02','Sobre','Página institucional Sobre.',2,'conteudo'),
  ('cafe_central','F03','Cardápio','Listagem de itens do cardápio.',3,'conteudo'),
  ('cafe_central','F04','Contato','Formulário/página de contato.',4,'formulario'),
  ('cafe_central','F05','Login','Acesso de usuário.',5,'autenticacao'),
  ('cafe_central','F06','Cadastro','Registro de novo usuário.',6,'autenticacao'),
  ('cafe_central','F07','Detalhes do item','Página de detalhes de um item do cardápio.',7,'conteudo')
) AS v(project, code, name, description, position, category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_features f
  WHERE f.project = v.project AND f.group_id IS NULL AND lower(f.name) = lower(v.name)
);

-- ============ SUGESTÕES DE FUNCIONALIDADE ============
CREATE TABLE IF NOT EXISTS public.feature_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project text NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  justification text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  author_id uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_suggestions TO authenticated;
GRANT ALL ON public.feature_suggestions TO service_role;
ALTER TABLE public.feature_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suggestions viewable by group and instructor" ON public.feature_suggestions
  FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR (group_id IS NOT NULL AND public.can_view_group(group_id, auth.uid())) OR public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Students create suggestions" ON public.feature_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "Lead or instructor reviews suggestions" ON public.feature_suggestions
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR (group_id IS NOT NULL AND public.can_manage_group(group_id, auth.uid())) OR public.has_role(auth.uid(), 'instructor'))
  WITH CHECK (true);
CREATE POLICY "Author or instructor deletes suggestions" ON public.feature_suggestions
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'instructor'));

DROP TRIGGER IF EXISTS feature_suggestions_updated_at ON public.feature_suggestions;
CREATE TRIGGER feature_suggestions_updated_at BEFORE UPDATE ON public.feature_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ AUDITORIA ============
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  actor_id uuid,
  old_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructor reads audit" ON public.audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "Authenticated writes audit" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON public.audit_log (entity, entity_id, created_at DESC);

-- trigger genérico de auditoria
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (entity, entity_id, action, actor_id, old_value, new_value)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    lower(TG_OP),
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS audit_classes ON public.classes;
CREATE TRIGGER audit_classes AFTER INSERT OR UPDATE OR DELETE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
DROP TRIGGER IF EXISTS audit_enrollments ON public.enrollments;
CREATE TRIGGER audit_enrollments AFTER INSERT OR UPDATE OR DELETE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
DROP TRIGGER IF EXISTS audit_groups ON public.groups;
CREATE TRIGGER audit_groups AFTER INSERT OR UPDATE OR DELETE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
DROP TRIGGER IF EXISTS audit_group_members ON public.group_members;
CREATE TRIGGER audit_group_members AFTER INSERT OR UPDATE OR DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
DROP TRIGGER IF EXISTS audit_app_features ON public.app_features;
CREATE TRIGGER audit_app_features AFTER INSERT OR UPDATE OR DELETE ON public.app_features
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM anon;