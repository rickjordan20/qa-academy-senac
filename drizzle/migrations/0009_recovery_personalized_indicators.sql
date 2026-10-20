ALTER TABLE public.builder_missions ADD COLUMN IF NOT EXISTS personalize_by_pending_indicators boolean NOT NULL DEFAULT false;
ALTER TABLE public.builder_mission_runs ADD COLUMN IF NOT EXISTS target_indicator_codes text[];
COMMENT ON COLUMN public.builder_mission_runs.target_indicator_codes IS 'Indicadores PA/NA congelados no início da tentativa (missões personalizadas). NULL = missão comum.';

-- Menção efetiva (homologação vigente > matriz) por indicador UC10 vinculado à missão.
CREATE OR REPLACE FUNCTION public.recovery_indicator_targets(_mission_id uuid, _student_id uuid)
RETURNS TABLE(code text, concept text, shown boolean, needs_review boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _class uuid; _codes text[];
BEGIN
  IF NOT (auth.uid() = _student_id OR is_student_instructor(auth.uid(), _student_id)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT e.class_id INTO _class FROM enrollments e
    JOIN builder_mission_assignments a ON a.class_id = e.class_id AND a.mission_id = _mission_id
   WHERE e.student_id = _student_id ORDER BY e.created_at LIMIT 1;
  IF _class IS NULL THEN
    SELECT e.class_id INTO _class FROM enrollments e WHERE e.student_id = _student_id ORDER BY e.created_at LIMIT 1;
  END IF;
  SELECT array_agg(DISTINCT c) INTO _codes FROM builder_missions m,
    jsonb_array_elements(m.sections) s, jsonb_array_elements_text(coalesce(s->'indicator_codes','[]'::jsonb)) c
   WHERE m.id = _mission_id;
  RETURN QUERY
  SELECT i.code,
         coalesce(h.concept::text, ev.concept::text),
         coalesce(h.concept::text, ev.concept::text) IN ('PA','NA'),
         coalesce(h.concept::text, ev.concept::text) IS NULL
    FROM indicators i
    LEFT JOIN indicator_evaluations ev ON ev.indicator_id = i.id AND ev.student_id = _student_id AND ev.class_id = _class
    LEFT JOIN indicator_homologations h ON h.indicator_id = i.id AND h.student_id = _student_id AND h.class_id = _class AND h.is_current
   WHERE i.uc_code = 'UC10' AND i.code = ANY(coalesce(_codes, '{}'))
   ORDER BY i.position;
END $$;
GRANT EXECUTE ON FUNCTION public.recovery_indicator_targets(uuid, uuid) TO authenticated;

-- Prévia do instrutor: todos os alunos das turmas atribuídas.
CREATE OR REPLACE FUNCTION public.recovery_mission_preview(_mission_id uuid)
RETURNS TABLE(student_id uuid, full_name text, code text, concept text, shown boolean, needs_review boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _s record;
BEGIN
  IF NOT has_role(auth.uid(), 'instructor') THEN RAISE EXCEPTION 'not authorized'; END IF;
  FOR _s IN SELECT DISTINCT e.student_id sid, coalesce(nullif(p.full_name,''), p.email) nm
      FROM builder_mission_assignments a JOIN enrollments e ON e.class_id = a.class_id
      JOIN classes c ON c.id = a.class_id AND c.instructor_id = auth.uid()
      LEFT JOIN profiles p ON p.id = e.student_id
     WHERE a.mission_id = _mission_id LOOP
    RETURN QUERY SELECT _s.sid, _s.nm, t.code, t.concept, t.shown, t.needs_review
      FROM recovery_indicator_targets(_mission_id, _s.sid) t;
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.recovery_mission_preview(uuid) TO authenticated;

-- Congela o conjunto ao iniciar; aluno não altera depois.
CREATE OR REPLACE FUNCTION public.builder_runs_recovery_targets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.target_indicator_codes := NULL;
    IF NEW.student_id IS NOT NULL AND EXISTS (SELECT 1 FROM builder_missions WHERE id = NEW.mission_id AND personalize_by_pending_indicators) THEN
      SELECT coalesce(array_agg(t.code), '{}') INTO NEW.target_indicator_codes
        FROM recovery_indicator_targets(NEW.mission_id, NEW.student_id) t WHERE t.shown;
    END IF;
  ELSIF NEW.target_indicator_codes IS DISTINCT FROM OLD.target_indicator_codes
        AND NOT has_role(auth.uid(), 'instructor') THEN
    RAISE EXCEPTION 'Somente o instrutor pode alterar os indicadores da recuperação';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER builder_runs_recovery_targets_trg BEFORE INSERT OR UPDATE ON public.builder_mission_runs
  FOR EACH ROW EXECUTE FUNCTION public.builder_runs_recovery_targets();

-- Aluno não grava registros em blocos de indicadores fora do conjunto.
CREATE OR REPLACE FUNCTION public.builder_entries_recovery_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t text[]; _codes text[];
BEGIN
  IF has_role(auth.uid(), 'instructor') THEN RETURN NEW; END IF;
  SELECT target_indicator_codes INTO _t FROM builder_mission_runs WHERE id = NEW.run_id;
  IF _t IS NULL THEN RETURN NEW; END IF;
  SELECT array(SELECT jsonb_array_elements_text(coalesce(s->'indicator_codes','[]'::jsonb)))
    INTO _codes FROM builder_missions m, jsonb_array_elements(m.sections) s
   WHERE m.id = NEW.mission_id AND s->>'id' = NEW.section_id;
  IF coalesce(array_length(_codes,1),0) > 0 AND NOT (_codes && _t) THEN
    RAISE EXCEPTION 'Este bloco não faz parte da sua recuperação';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER builder_entries_recovery_guard_trg BEFORE INSERT ON public.builder_mission_entries
  FOR EACH ROW EXECUTE FUNCTION public.builder_entries_recovery_guard();

-- Avaliação da recuperação só registra menções dos indicadores do conjunto
-- (impede votos indevidos na consolidação de outros indicadores).
CREATE OR REPLACE FUNCTION public.builder_evaluations_recovery_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t text[]; _k text; _s text; _ov jsonb := '{}'::jsonb; _f jsonb := '{}'::jsonb;
BEGIN
  SELECT target_indicator_codes INTO _t FROM builder_mission_runs WHERE id = NEW.run_id;
  IF _t IS NULL THEN RETURN NEW; END IF;
  FOR _k IN SELECT jsonb_object_keys(coalesce(NEW.indicator_finals,'{}')) LOOP
    IF _k = ANY(_t) THEN _f := _f || jsonb_build_object(_k, NEW.indicator_finals->_k); END IF;
  END LOOP;
  NEW.indicator_finals := _f;
  FOR _s IN SELECT jsonb_object_keys(coalesce(NEW.member_overrides,'{}')) LOOP
    _ov := _ov || jsonb_build_object(_s, (SELECT coalesce(jsonb_object_agg(k, v), '{}') FROM jsonb_each(NEW.member_overrides->_s) x(k,v) WHERE k = ANY(_t)));
  END LOOP;
  NEW.member_overrides := _ov;
  RETURN NEW;
END $$;
CREATE TRIGGER builder_evaluations_recovery_scope_trg BEFORE INSERT OR UPDATE ON public.builder_run_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.builder_evaluations_recovery_scope();