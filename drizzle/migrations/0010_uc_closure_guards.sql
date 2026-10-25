CREATE OR REPLACE FUNCTION public.uc_results_closure_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uc text; _total int; _evaluated int; _not_a int; _pending_not_recovered int;
BEGIN
  IF NEW.final_result IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.final_result IS NOT DISTINCT FROM NEW.final_result
     AND OLD.confirmed_at IS NOT DISTINCT FROM NEW.confirmed_at THEN RETURN NEW; END IF;
  SELECT nullif(trim(uc_code), '') INTO _uc FROM public.classes WHERE id = NEW.class_id;
  IF _uc IS NULL THEN RAISE EXCEPTION 'UC da turma não identificada: fechamento bloqueado.' USING ERRCODE = '23514'; END IF;
  SELECT count(*) INTO _total FROM public.indicators WHERE uc_code = _uc;
  IF _total = 0 THEN RAISE EXCEPTION 'A UC % não possui indicadores cadastrados: fechamento bloqueado.', _uc USING ERRCODE = '23514'; END IF;
  SELECT count(*) FILTER (WHERE e.concept IS NOT NULL),
         count(*) FILTER (WHERE e.concept IS NOT NULL AND e.concept <> 'A'),
         count(*) FILTER (WHERE e.concept IN ('PA','NA') AND e.stage <> 'recuperacao')
    INTO _evaluated, _not_a, _pending_not_recovered
    FROM public.indicators i
    LEFT JOIN public.indicator_evaluations e
      ON e.indicator_id = i.id AND e.class_id = NEW.class_id AND e.student_id = NEW.student_id
   WHERE i.uc_code = _uc;
  IF _evaluated < _total THEN RAISE EXCEPTION 'Há indicadores sem menção: fechamento bloqueado.' USING ERRCODE = '23514'; END IF;
  IF NEW.final_result = 'D' AND _not_a > 0 THEN RAISE EXCEPTION 'D exige A em todos os indicadores da UC.' USING ERRCODE = '23514'; END IF;
  IF NEW.final_result = 'ND' AND _not_a = 0 THEN RAISE EXCEPTION 'Todos os indicadores estão em A: ND não é compatível com as menções.' USING ERRCODE = '23514'; END IF;
  IF NEW.final_result = 'ND' AND _pending_not_recovered > 0 AND length(trim(coalesce(NEW.notes,''))) < 20 THEN
    RAISE EXCEPTION 'Encerramento antecipado em ND exige justificativa pedagógica (mín. 20 caracteres).' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS uc_results_closure_guard_trg ON public.uc_results;
CREATE TRIGGER uc_results_closure_guard_trg BEFORE INSERT OR UPDATE ON public.uc_results
  FOR EACH ROW EXECUTE FUNCTION public.uc_results_closure_guard();

DROP TRIGGER IF EXISTS uc_results_audit ON public.uc_results;
CREATE TRIGGER uc_results_audit AFTER INSERT OR UPDATE OR DELETE ON public.uc_results
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();