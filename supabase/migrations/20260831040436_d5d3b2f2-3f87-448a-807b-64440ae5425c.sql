CREATE TABLE public.app_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project text NOT NULL CHECK (project IN ('techeduca','cafe_central')),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'base' CHECK (kind IN ('base','additional')),
  origin text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_features_base_no_group CHECK (
    (kind = 'base' AND group_id IS NULL) OR (kind = 'additional' AND group_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX app_features_base_code_key
  ON public.app_features (project, code) WHERE group_id IS NULL;
CREATE UNIQUE INDEX app_features_group_code_key
  ON public.app_features (group_id, code) WHERE group_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_features TO authenticated;
GRANT ALL ON public.app_features TO service_role;

ALTER TABLE public.app_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "features_select" ON public.app_features FOR SELECT TO authenticated
USING (
  group_id IS NULL
  OR public.can_view_group(group_id, auth.uid())
  OR public.has_role(auth.uid(), 'instructor')
);

CREATE POLICY "features_insert" ON public.app_features FOR INSERT TO authenticated
WITH CHECK (
  kind = 'additional' AND group_id IS NOT NULL
  AND public.can_manage_group(group_id, auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "features_update" ON public.app_features FOR UPDATE TO authenticated
USING (kind = 'additional' AND group_id IS NOT NULL AND public.can_manage_group(group_id, auth.uid()))
WITH CHECK (kind = 'additional' AND group_id IS NOT NULL AND public.can_manage_group(group_id, auth.uid()));

CREATE POLICY "features_delete" ON public.app_features FOR DELETE TO authenticated
USING (kind = 'additional' AND group_id IS NOT NULL AND public.can_manage_group(group_id, auth.uid()));

CREATE TRIGGER app_features_updated_at BEFORE UPDATE ON public.app_features
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_features (project, code, name, description, kind, position) VALUES
('techeduca','TE-01','Início','Página inicial do TechEduca.','base',1),
('techeduca','TE-02','Sobre','Página institucional sobre o TechEduca.','base',2),
('techeduca','TE-03','Cursos','Listagem de cursos disponíveis.','base',3),
('techeduca','TE-04','Contato','Formulário de contato.','base',4),
('techeduca','TE-05','Login','Autenticação de usuário existente.','base',5),
('techeduca','TE-06','Cadastro','Criação de conta de usuário.','base',6),
('techeduca','TE-07','Detalhes do curso','Página de detalhes de um curso.','base',7),
('cafe_central','CF-01','Início','Página inicial do Café Central.','base',1),
('cafe_central','CF-02','Sobre','Página institucional sobre o Café Central.','base',2),
('cafe_central','CF-03','Cardápio','Listagem dos itens do cardápio.','base',3),
('cafe_central','CF-04','Contato','Formulário de contato.','base',4),
('cafe_central','CF-05','Login','Autenticação de usuário existente.','base',5),
('cafe_central','CF-06','Cadastro','Criação de conta de usuário.','base',6),
('cafe_central','CF-07','Detalhes do item','Página de detalhes de um item do cardápio.','base',7);

ALTER TABLE public.qa_test_cases
  ADD COLUMN feature_id uuid REFERENCES public.app_features(id) ON DELETE SET NULL,
  ADD COLUMN test_type text NOT NULL DEFAULT 'funcional';

ALTER TABLE public.qa_bugs
  ADD COLUMN feature_id uuid REFERENCES public.app_features(id) ON DELETE SET NULL;
