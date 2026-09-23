
CREATE OR REPLACE FUNCTION public.cross_test_retest(_bug_id uuid, _result text, _notes text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.qa_bugs%ROWTYPE;
  u uuid := auth.uid();
  retest_id uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF _result NOT IN ('resolvido','reaberto') THEN
    RAISE EXCEPTION 'Resultado do reteste inválido';
  END IF;

  SELECT * INTO b FROM public.qa_bugs WHERE id = _bug_id FOR UPDATE;
  IF b.id IS NULL OR b.pairing_id IS NULL THEN RAISE EXCEPTION 'Bug de teste cruzado inexistente'; END IF;
  IF NOT (public.has_role(u,'instructor') OR public.is_group_member(b.group_id, u)) THEN
    RAISE EXCEPTION 'Somente a equipe testadora realiza o reteste';
  END IF;
  IF b.status <> 'pronto_reteste' THEN
    RAISE EXCEPTION 'O bug precisa estar em "Pronto para reteste"';
  END IF;

  INSERT INTO public.qa_retests (bug_id, tester_id, result, notes)
  VALUES (_bug_id, u, _result, COALESCE(_notes, ''))
  RETURNING id INTO retest_id;

  UPDATE public.qa_bugs SET status = _result, updated_at = now() WHERE id = _bug_id;

  RETURN retest_id;
END; $$;
