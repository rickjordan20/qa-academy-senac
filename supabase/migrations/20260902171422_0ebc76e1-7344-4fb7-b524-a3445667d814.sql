ALTER TABLE public.gam_badges
  ADD COLUMN IF NOT EXISTS rule_config jsonb NOT NULL DEFAULT '{"all": []}'::jsonb;

UPDATE public.gam_badges SET rule_config = r.cfg
FROM (VALUES
  ('primeira_evidencia', '{"all":[{"metric":"evidences","op":">=","value":1}]}'::jsonb),
  ('cacador_de_bugs',    '{"all":[{"metric":"bugs","op":">=","value":5}]}'::jsonb),
  ('tester_funcional',   '{"all":[{"metric":"executions","op":">=","value":5}]}'::jsonb),
  ('ux_detective',       '{"all":[{"metric":"uxBugs","op":">=","value":3}]}'::jsonb),
  ('code_inspector',     '{"all":[{"metric":"cases","op":">=","value":10}]}'::jsonb),
  ('stress_tester',      '{"all":[{"metric":"severeBugs","op":">=","value":3}]}'::jsonb),
  ('mestre_do_reteste',  '{"all":[{"metric":"retests","op":">=","value":5}]}'::jsonb),
  ('qa_lead',            '{"all":[{"metric":"isQaLead","op":">=","value":1}]}'::jsonb),
  ('trabalho_em_equipe', '{"all":[{"metric":"contributions","op":">=","value":1}]}'::jsonb),
  ('qa_360',             '{"all":[{"metric":"cases","op":">=","value":1},{"metric":"executions","op":">=","value":1},{"metric":"bugs","op":">=","value":1},{"metric":"evidences","op":">=","value":1},{"metric":"retests","op":">=","value":1}]}'::jsonb)
) AS r(code, cfg)
WHERE public.gam_badges.code = r.code;

CREATE POLICY "Instrutor cria badges" ON public.gam_badges
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'instructor'));

CREATE POLICY "Instrutor exclui badges" ON public.gam_badges
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'instructor'));

GRANT INSERT, DELETE ON public.gam_badges TO authenticated;

CREATE OR REPLACE FUNCTION public.gam_sync_my_badges()
 RETURNS TABLE(badge_code text, awarded_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  u uuid := auth.uid();
  v_cases int; v_exec int; v_bugs int; v_ux int; v_severe int;
  v_ev int; v_retests int; v_contribs int; v_lead boolean;
  stats jsonb;
  b record;
  cond jsonb;
  ok boolean;
  lhs numeric;
  rhs numeric;
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

  stats := jsonb_build_object(
    'cases', v_cases, 'executions', v_exec, 'bugs', v_bugs, 'uxBugs', v_ux,
    'severeBugs', v_severe, 'evidences', v_ev, 'retests', v_retests,
    'contributions', v_contribs, 'isQaLead', CASE WHEN v_lead THEN 1 ELSE 0 END
  );

  FOR b IN SELECT code, rule_config FROM public.gam_badges WHERE enabled LOOP
    IF jsonb_typeof(b.rule_config -> 'all') <> 'array'
       OR jsonb_array_length(b.rule_config -> 'all') = 0 THEN
      CONTINUE;
    END IF;
    ok := true;
    FOR cond IN SELECT * FROM jsonb_array_elements(b.rule_config -> 'all') LOOP
      lhs := COALESCE((stats ->> (cond ->> 'metric'))::numeric, 0);
      rhs := COALESCE((cond ->> 'value')::numeric, 0);
      ok := ok AND CASE cond ->> 'op'
        WHEN '>=' THEN lhs >= rhs
        WHEN '>'  THEN lhs > rhs
        WHEN '='  THEN lhs = rhs
        WHEN '<=' THEN lhs <= rhs
        WHEN '<'  THEN lhs < rhs
        ELSE false END;
      EXIT WHEN NOT ok;
    END LOOP;

    IF ok THEN
      INSERT INTO public.gam_student_badges (student_id, badge_code)
      VALUES (u, b.code)
      ON CONFLICT (student_id, badge_code) DO NOTHING;
    END IF;
  END LOOP;

  RETURN QUERY
    SELECT s.badge_code, s.awarded_at
      FROM public.gam_student_badges s
     WHERE s.student_id = u;
END;
$function$;