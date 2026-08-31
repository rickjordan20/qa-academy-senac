-- 1) feature_suggestions: impedir auto-aprovação
DROP POLICY IF EXISTS "Lead or instructor reviews suggestions" ON public.feature_suggestions;

CREATE OR REPLACE FUNCTION public.feature_suggestion_can_review(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'instructor')
      OR (_group_id IS NOT NULL AND public.can_manage_group(_group_id, _user_id));
$$;

REVOKE ALL ON FUNCTION public.feature_suggestion_can_review(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.feature_suggestion_can_review(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.feature_suggestions_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.feature_suggestion_can_review(NEW.group_id, auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- autor sem permissão de revisão: não pode mexer no resultado da revisão
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
    RAISE EXCEPTION 'Apenas o líder do grupo ou o instrutor podem revisar sugestões';
  END IF;
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Sugestão já revisada não pode ser alterada';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS feature_suggestions_guard_trg ON public.feature_suggestions;
CREATE TRIGGER feature_suggestions_guard_trg
BEFORE UPDATE ON public.feature_suggestions
FOR EACH ROW EXECUTE FUNCTION public.feature_suggestions_guard();

CREATE POLICY "Author or reviewer updates suggestions"
ON public.feature_suggestions
FOR UPDATE
TO authenticated
USING (
  author_id = auth.uid()
  OR public.feature_suggestion_can_review(group_id, auth.uid())
)
WITH CHECK (
  author_id = auth.uid()
  OR public.feature_suggestion_can_review(group_id, auth.uid())
);

-- 2) gam_xp_events: aluno não pode se conceder XP aprovado nem valor arbitrário
DROP POLICY IF EXISTS "gam_xp_events_insert" ON public.gam_xp_events;

CREATE POLICY "gam_xp_events_insert"
ON public.gam_xp_events
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'instructor')
  OR (student_id = auth.uid() AND status = 'pending')
);

CREATE OR REPLACE FUNCTION public.gam_enforce_xp_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  official integer;
BEGIN
  IF public.has_role(auth.uid(), 'instructor') THEN
    RETURN NEW;
  END IF;
  SELECT xp INTO official FROM public.gam_actions WHERE code = NEW.action_code;
  IF official IS NULL THEN
    RAISE EXCEPTION 'Ação de XP inválida';
  END IF;
  NEW.xp := official;
  NEW.status := 'pending';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gam_enforce_xp_insert_trg ON public.gam_xp_events;
CREATE TRIGGER gam_enforce_xp_insert_trg
BEFORE INSERT ON public.gam_xp_events
FOR EACH ROW EXECUTE FUNCTION public.gam_enforce_xp_insert();