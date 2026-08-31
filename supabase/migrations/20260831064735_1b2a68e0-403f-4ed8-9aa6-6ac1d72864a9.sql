CREATE TABLE public.app_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project text NOT NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_modules TO authenticated;
GRANT ALL ON public.app_modules TO service_role;

ALTER TABLE public.app_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY modules_select ON public.app_modules FOR SELECT TO authenticated
USING (group_id IS NULL OR public.can_view_group(group_id, auth.uid()) OR public.has_role(auth.uid(), 'instructor'));

CREATE POLICY modules_insert ON public.app_modules FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'instructor')
  OR (group_id IS NOT NULL AND public.can_manage_group(group_id, auth.uid()))
);

CREATE POLICY modules_update ON public.app_modules FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'instructor')
  OR (group_id IS NOT NULL AND public.can_manage_group(group_id, auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'instructor')
  OR (group_id IS NOT NULL AND public.can_manage_group(group_id, auth.uid()))
);

CREATE POLICY modules_delete ON public.app_modules FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'instructor')
  OR (group_id IS NOT NULL AND public.can_manage_group(group_id, auth.uid()))
);

CREATE TRIGGER app_modules_updated_at BEFORE UPDATE ON public.app_modules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER app_modules_audit AFTER INSERT OR UPDATE OR DELETE ON public.app_modules
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

ALTER TABLE public.app_features ADD COLUMN module_id uuid REFERENCES public.app_modules(id) ON DELETE SET NULL;

CREATE INDEX app_features_module_id_idx ON public.app_features(module_id);
CREATE INDEX app_modules_project_idx ON public.app_modules(project, group_id);

-- Instrutor com acesso completo ao inventário (antes só o QA Lead do grupo escrevia)
CREATE POLICY features_instructor_all ON public.app_features FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'instructor'))
WITH CHECK (public.has_role(auth.uid(), 'instructor'));

-- Migração segura: cada funcionalidade atual representa uma tela.
WITH novos AS (
  INSERT INTO public.app_modules (project, group_id, name, description, status, position, created_by)
  SELECT f.project, f.group_id, f.name, f.description, f.status, f.position, f.created_by
  FROM public.app_features f
  WHERE f.module_id IS NULL
  RETURNING id, project, group_id, name, position
)
UPDATE public.app_features f
SET module_id = n.id
FROM novos n
WHERE f.module_id IS NULL
  AND f.project = n.project
  AND f.name = n.name
  AND f.position = n.position
  AND f.group_id IS NOT DISTINCT FROM n.group_id;
