-- Módulos/Telas: integrantes do grupo podem criar e editar; exclusão continua restrita ao QA Lead/instrutor
DROP POLICY IF EXISTS modules_insert ON public.app_modules;
CREATE POLICY modules_insert ON public.app_modules
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'instructor'::app_role)
  OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()))
);

DROP POLICY IF EXISTS modules_update ON public.app_modules;
CREATE POLICY modules_update ON public.app_modules
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'instructor'::app_role)
  OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'instructor'::app_role)
  OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()))
);

-- Funcionalidades do grupo: integrantes podem criar e editar
DROP POLICY IF EXISTS features_insert ON public.app_features;
CREATE POLICY features_insert ON public.app_features
FOR INSERT TO authenticated
WITH CHECK (
  kind = 'additional'
  AND group_id IS NOT NULL
  AND public.is_group_member(group_id, auth.uid())
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS features_update ON public.app_features;
CREATE POLICY features_update ON public.app_features
FOR UPDATE TO authenticated
USING (
  kind = 'additional'
  AND group_id IS NOT NULL
  AND public.is_group_member(group_id, auth.uid())
)
WITH CHECK (
  kind = 'additional'
  AND group_id IS NOT NULL
  AND public.is_group_member(group_id, auth.uid())
);
