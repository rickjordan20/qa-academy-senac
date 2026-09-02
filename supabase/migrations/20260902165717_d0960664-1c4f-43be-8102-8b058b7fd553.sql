-- 1. Catálogo: status e updated_at
ALTER TABLE public.gam_badges
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS gam_badges_updated_at ON public.gam_badges;
CREATE TRIGGER gam_badges_updated_at
BEFORE UPDATE ON public.gam_badges
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT UPDATE ON public.gam_badges TO authenticated;
GRANT ALL ON public.gam_badges TO service_role;

DROP POLICY IF EXISTS gam_badges_update_instructor ON public.gam_badges;
CREATE POLICY gam_badges_update_instructor ON public.gam_badges
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'instructor'))
WITH CHECK (public.has_role(auth.uid(), 'instructor'));

-- 2. Concessão de badges: apenas via função segura
DROP POLICY IF EXISTS gam_student_badges_insert ON public.gam_student_badges;
REVOKE INSERT, UPDATE, DELETE ON public.gam_student_badges FROM authenticated;
GRANT SELECT ON public.gam_student_badges TO authenticated;
GRANT ALL ON public.gam_student_badges TO service_role;

CREATE OR REPLACE FUNCTION public.gam_sync_my_badges()
RETURNS TABLE(badge_code text, awarded_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  u uuid := auth.uid();
  v_cases int; v_exec int; v_bugs int; v_ux int; v_severe int;
  v_ev int; v_retests int; v_contribs int; v_lead boolean;
  earned text[] := '{}';
BEGIN
  IF u IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT count(*), count(*) FILTER (WHERE executed_at IS NOT NULL)
    INTO v_cases, v_exec
    FROM public.qa_test_cases WHERE author_id = u;

  SELECT count(*),
         count(*) FILTER (WHERE lower(coalesce(title,'') || ' ' || coalesce(description,''))
                            ~ '(ux|usabilidade|interface|layout|design)'),
         count(*) FILTER (WHERE severity IN ('alta','critica'))
    INTO v_bugs, v_ux, v_severe
    FROM public.qa_bugs WHERE author_id = u;

  SELECT (SELECT count(*) FROM public.qa_evidences WHERE author_id = u)
       + (SELECT count(*) FROM public.techeduca_evidences WHERE student_id = u)
    INTO v_ev;

  SELECT count(*) INTO v_retests FROM public.qa_retests WHERE tester_id = u;
  SELECT count(*) INTO v_contribs FROM public.cafe_contributions WHERE student_id = u;
  SELECT EXISTS (SELECT 1 FROM public.groups WHERE qa_lead_id = u) INTO v_lead;

  IF v_ev >= 1 THEN earned := earned || 'primeira_evidencia'; END IF;
  IF v_bugs >= 5 THEN earned := earned || 'cacador_de_bugs'; END IF;
  IF v_exec >= 5 THEN earned := earned || 'tester_funcional'; END IF;
  IF v_ux >= 3 THEN earned := earned || 'ux_detective'; END IF;
  IF v_cases >= 10 THEN earned := earned || 'code_inspector'; END IF;
  IF v_severe >= 3 THEN earned := earned || 'stress_tester'; END IF;
  IF v_retests >= 5 THEN earned := earned || 'mestre_do_reteste'; END IF;
  IF v_lead THEN earned := earned || 'qa_lead'; END IF;
  IF v_contribs >= 1 THEN earned := earned || 'trabalho_em_equipe'; END IF;
  IF v_cases >= 1 AND v_exec >= 1 AND v_bugs >= 1 AND v_ev >= 1 AND v_retests >= 1
    THEN earned := earned || 'qa_360'; END IF;

  INSERT INTO public.gam_student_badges (student_id, badge_code)
  SELECT u, b.code
    FROM public.gam_badges b
   WHERE b.code = ANY(earned)
     AND b.enabled
     AND NOT EXISTS (
       SELECT 1 FROM public.gam_student_badges s
        WHERE s.student_id = u AND s.badge_code = b.code
     );

  RETURN QUERY
    SELECT s.badge_code, s.awarded_at
      FROM public.gam_student_badges s
     WHERE s.student_id = u;
END;
$$;

REVOKE ALL ON FUNCTION public.gam_sync_my_badges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gam_sync_my_badges() TO authenticated, service_role;