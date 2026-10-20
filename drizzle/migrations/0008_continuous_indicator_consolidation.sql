-- Consolidação contínua por predominância: recalcula uma célula (aluno × indicador).
CREATE OR REPLACE FUNCTION public.consolidate_indicator_cell(
  _class_id uuid, _student_id uuid, _indicator_id uuid, _evaluation_id uuid, _actor uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _code text; a int; pa int; na int; _mode text; _outcome text;
  _row public.indicator_evaluations; _hom public.indicator_homologations; _newer boolean;
  _counts jsonb; _src_mission uuid; _src_run uuid;
BEGIN
  SELECT code INTO _code FROM indicators WHERE id = _indicator_id;
  WITH v AS (
    SELECT DISTINCT ON (e.mission_id) e.mission_id, e.created_at,
      coalesce(e.member_overrides->_student_id::text->>_code, e.indicator_finals->>_code) c
    FROM builder_run_evaluations e
    JOIN builder_mission_runs r ON r.id = e.run_id AND r.eval_status = 'evaluated'
    WHERE e.is_current AND _student_id = ANY(e.target_student_ids)
      AND coalesce(e.member_overrides->_student_id::text->>_code, e.indicator_finals->>_code) IN ('A','PA','NA')
    ORDER BY e.mission_id, e.version DESC)
  SELECT count(*) FILTER (WHERE c='A'), count(*) FILTER (WHERE c='PA'), count(*) FILTER (WHERE c='NA')
    INTO a, pa, na FROM v;
  IF a + pa + na = 0 THEN RETURN 'no_evidence'; END IF;
  _counts := jsonb_build_object('A', a, 'PA', pa, 'NA', na);
  _mode := CASE WHEN a>pa AND a>na THEN 'A' WHEN pa>a AND pa>na THEN 'PA'
                WHEN na>a AND na>pa THEN 'NA' ELSE 'tie' END;

  SELECT * INTO _row FROM indicator_evaluations
    WHERE class_id=_class_id AND student_id=_student_id AND indicator_id=_indicator_id;
  SELECT * INTO _hom FROM indicator_homologations
    WHERE is_current AND class_id=_class_id AND student_id=_student_id AND indicator_id=_indicator_id;
  SELECT mission_id, run_id INTO _src_mission, _src_run FROM builder_run_evaluations WHERE id = _evaluation_id;

  IF _hom.id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM builder_run_evaluations e
      WHERE e.is_current AND _student_id = ANY(e.target_student_ids) AND e.created_at > _hom.decided_at) INTO _newer;
    _outcome := CASE WHEN _newer AND _mode IS DISTINCT FROM _hom.concept::text
                     THEN 'divergent_after_homologation' ELSE 'homologated' END;
  ELSIF _mode = 'tie' THEN _outcome := 'tie_pending';
  ELSIF _row.concept = 'A' AND _mode <> 'A' THEN _outcome := 'reduction_review';
  ELSIF _row.id IS NOT NULL AND _row.concept::text = _mode THEN _outcome := 'unchanged';
  ELSE _outcome := 'applied';
  END IF;

  IF _row.id IS NULL THEN
    INSERT INTO indicator_evaluations(class_id, student_id, indicator_id, concept, stage, notes, evaluated_by,
      evaluated_at, source_mission_id, source_run_id, source_evaluation_id, consolidation_status, consolidation_counts)
    VALUES (_class_id, _student_id, _indicator_id,
      CASE WHEN _outcome='applied' THEN _mode::evaluation_concept END, 'regular',
      'Consolidação por predominância', _actor, now(), _src_mission, _src_run, _evaluation_id, _outcome, _counts);
  ELSIF _outcome = 'applied' THEN
    UPDATE indicator_evaluations SET concept=_mode::evaluation_concept,
      notes = 'Consolidação por predominância: ' || coalesce(_row.concept::text,'—') || ' → ' || _mode,
      evaluated_by=_actor, evaluated_at=now(), source_mission_id=_src_mission, source_run_id=_src_run,
      source_evaluation_id=_evaluation_id, invalidated_at=NULL, invalidation_reason='',
      consolidation_status=_outcome, consolidation_counts=_counts
    WHERE id=_row.id;
  ELSE
    -- Menção vigente preservada; apenas metadados de consolidação.
    UPDATE indicator_evaluations SET consolidation_status=_outcome, consolidation_counts=_counts WHERE id=_row.id;
  END IF;
  RETURN _outcome;
END $$;
REVOKE ALL ON FUNCTION public.consolidate_indicator_cell(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;

-- RPC chamada após avaliação definitiva: só o instrutor da turma.
CREATE OR REPLACE FUNCTION public.consolidate_evaluation(_evaluation_id uuid, _class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e builder_run_evaluations; _s uuid; _code text; _ind uuid; _res jsonb := '[]'::jsonb; _o text;
BEGIN
  IF NOT is_class_instructor(_class_id, auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF in_student_view(auth.uid()) THEN RAISE EXCEPTION 'read-only student view'; END IF;
  SELECT * INTO _e FROM builder_run_evaluations WHERE id=_evaluation_id;
  IF _e.id IS NULL OR NOT _e.is_current THEN RETURN _res; END IF;
  FOREACH _s IN ARRAY _e.target_student_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM enrollments WHERE class_id=_class_id AND student_id=_s) THEN CONTINUE; END IF;
    FOR _code IN SELECT DISTINCT k FROM (
        SELECT jsonb_object_keys(_e.indicator_finals) k
        UNION SELECT jsonb_object_keys(coalesce(_e.member_overrides->_s::text,'{}'::jsonb))) q LOOP
      SELECT id INTO _ind FROM indicators WHERE code=_code ORDER BY position LIMIT 1;
      IF _ind IS NULL THEN CONTINUE; END IF;
      _o := consolidate_indicator_cell(_class_id, _s, _ind, _evaluation_id, auth.uid());
      _res := _res || jsonb_build_object('student_id', _s, 'indicator', _code, 'outcome', _o);
    END LOOP;
  END LOOP;
  RETURN _res;
END $$;
REVOKE ALL ON FUNCTION public.consolidate_evaluation(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consolidate_evaluation(uuid,uuid) TO authenticated;

-- Restauração segura de um lote: só reverte células que ainda estão com o valor aplicado pelo lote.
CREATE OR REPLACE FUNCTION public.restore_consolidation_batch(_batch text, _class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE restored int := 0; skipped int := 0; r record;
BEGIN
  IF NOT is_class_instructor(_class_id, auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  FOR r IN SELECT s.*, ie.concept cur FROM indicator_consolidation_snapshots s
           JOIN indicator_evaluations ie ON ie.id = s.evaluation_id
           WHERE s.batch=_batch AND s.class_id=_class_id AND s.outcome='applied' LOOP
    IF r.cur IS DISTINCT FROM r.concept_after THEN skipped := skipped + 1; CONTINUE; END IF;
    UPDATE indicator_evaluations SET concept = r.concept_before,
      notes = r.row_before->>'notes', evaluated_by = (r.row_before->>'evaluated_by')::uuid,
      evaluated_at = (r.row_before->>'evaluated_at')::timestamptz,
      source_mission_id = (r.row_before->>'source_mission_id')::uuid,
      source_run_id = (r.row_before->>'source_run_id')::uuid,
      source_evaluation_id = (r.row_before->>'source_evaluation_id')::uuid,
      consolidation_status = 'restored'
    WHERE id = r.evaluation_id;
    restored := restored + 1;
  END LOOP;
  RETURN jsonb_build_object('restored', restored, 'skipped_changed_since', skipped);
END $$;
REVOKE ALL ON FUNCTION public.restore_consolidation_batch(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_consolidation_batch(text,uuid) TO authenticated;