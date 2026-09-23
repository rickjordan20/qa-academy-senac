
-- 1) Tabela de pareamentos
CREATE TABLE IF NOT EXISTS public.cross_test_pairings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.builder_missions(id) ON DELETE CASCADE,
  section_id text NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  tester_group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  developer_group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cross_test_pairings_unique_pair
  ON public.cross_test_pairings (mission_id, section_id, tester_group_id);
CREATE INDEX IF NOT EXISTS cross_test_pairings_dev_idx
  ON public.cross_test_pairings (developer_group_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cross_test_pairings TO authenticated;
GRANT ALL ON public.cross_test_pairings TO service_role;
ALTER TABLE public.cross_test_pairings ENABLE ROW LEVEL SECURITY;

CREATE POLICY cross_test_pairings_select ON public.cross_test_pairings
  FOR SELECT TO authenticated
  USING (
    public.is_class_instructor(class_id, auth.uid())
    OR public.is_group_member(tester_group_id, auth.uid())
    OR public.is_group_member(developer_group_id, auth.uid())
  );

CREATE POLICY cross_test_pairings_write ON public.cross_test_pairings
  FOR ALL TO authenticated
  USING (public.is_class_instructor(class_id, auth.uid()))
  WITH CHECK (public.is_class_instructor(class_id, auth.uid()));

CREATE TRIGGER cross_test_pairings_updated_at
  BEFORE UPDATE ON public.cross_test_pairings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- validação estrutural do pareamento
CREATE OR REPLACE FUNCTION public.cross_test_pairings_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_class uuid;
  d_class uuid;
BEGIN
  IF NEW.tester_group_id = NEW.developer_group_id THEN
    RAISE EXCEPTION 'A equipe testadora não pode ser a mesma equipe desenvolvedora';
  END IF;

  SELECT class_id INTO t_class FROM public.groups WHERE id = NEW.tester_group_id;
  SELECT class_id INTO d_class FROM public.groups WHERE id = NEW.developer_group_id;

  IF t_class IS NULL OR d_class IS NULL THEN
    RAISE EXCEPTION 'Grupo inexistente no pareamento';
  END IF;
  IF t_class <> d_class THEN
    RAISE EXCEPTION 'Os grupos do pareamento precisam ser da mesma turma';
  END IF;

  NEW.class_id := t_class;
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  RETURN NEW;
END; $$;

CREATE TRIGGER cross_test_pairings_guard_trg
  BEFORE INSERT OR UPDATE ON public.cross_test_pairings
  FOR EACH ROW EXECUTE FUNCTION public.cross_test_pairings_guard();

-- 2) Vínculos do teste cruzado nos bugs existentes
ALTER TABLE public.qa_bugs
  ADD COLUMN IF NOT EXISTS pairing_id uuid REFERENCES public.cross_test_pairings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS developer_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS section_id text;

CREATE INDEX IF NOT EXISTS qa_bugs_developer_group_idx ON public.qa_bugs (developer_group_id);

-- equipe desenvolvedora enxerga e trata os bugs recebidos
CREATE POLICY qa_bugs_select_cross_dev ON public.qa_bugs
  FOR SELECT TO authenticated
  USING (developer_group_id IS NOT NULL AND public.is_group_member(developer_group_id, auth.uid()));

CREATE POLICY qa_bugs_update_cross_dev ON public.qa_bugs
  FOR UPDATE TO authenticated
  USING (developer_group_id IS NOT NULL AND public.is_group_member(developer_group_id, auth.uid()))
  WITH CHECK (developer_group_id IS NOT NULL AND public.is_group_member(developer_group_id, auth.uid()));

CREATE POLICY qa_evidences_select_cross_dev ON public.qa_evidences
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_bugs b
    WHERE b.id = qa_evidences.bug_id
      AND b.developer_group_id IS NOT NULL
      AND public.is_group_member(b.developer_group_id, auth.uid())
  ));

CREATE POLICY qa_retests_select_cross_dev ON public.qa_retests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_bugs b
    WHERE b.id = qa_retests.bug_id
      AND b.developer_group_id IS NOT NULL
      AND public.is_group_member(b.developer_group_id, auth.uid())
  ));

-- reteste de teste cruzado só pela RPC transacional
DROP POLICY IF EXISTS qa_retests_insert ON public.qa_retests;
CREATE POLICY qa_retests_insert ON public.qa_retests
  FOR INSERT TO authenticated
  WITH CHECK (
    tester_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.qa_bugs b
      WHERE b.id = qa_retests.bug_id
        AND b.pairing_id IS NULL
        AND public.qa_can_view(b.author_id, b.group_id, auth.uid())
    )
  );

-- 3) Guardas de integridade dos bugs de teste cruzado
CREATE OR REPLACE FUNCTION public.cross_test_status_allowed(_from text, _to text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _from = _to THEN 'any'
    WHEN _from = 'aberto' AND _to IN ('em_analise','confirmado','descartado') THEN 'dev'
    WHEN _from = 'confirmado' AND _to IN ('em_analise','em_correcao','descartado') THEN 'dev'
    WHEN _from = 'em_analise' AND _to IN ('confirmado','em_correcao','pronto_reteste','descartado') THEN 'dev'
    WHEN _from = 'em_correcao' AND _to IN ('pronto_reteste','em_analise') THEN 'dev'
    WHEN _from = 'reaberto' AND _to IN ('em_analise','em_correcao','pronto_reteste') THEN 'dev'
    WHEN _from = 'pronto_reteste' AND _to IN ('resolvido','reaberto') THEN 'tester'
    WHEN _from = 'resolvido' AND _to = 'reaberto' THEN 'tester'
    WHEN _from = 'descartado' AND _to = 'aberto' THEN 'tester'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.cross_test_bugs_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.cross_test_pairings%ROWTYPE;
  is_instr boolean := public.has_role(auth.uid(), 'instructor');
  is_dev boolean;
  is_tester boolean;
  side text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.pairing_id IS NULL AND NEW.developer_group_id IS NULL THEN
      RETURN NEW;
    END IF;
    IF NEW.pairing_id IS NULL THEN
      RAISE EXCEPTION 'Bug de teste cruzado exige um pareamento válido';
    END IF;
    SELECT * INTO p FROM public.cross_test_pairings WHERE id = NEW.pairing_id;
    IF p.id IS NULL THEN
      RAISE EXCEPTION 'Pareamento inexistente';
    END IF;
    NEW.group_id := p.tester_group_id;
    NEW.developer_group_id := p.developer_group_id;
    NEW.section_id := p.section_id;
    IF NOT (is_instr OR public.is_group_member(p.tester_group_id, NEW.author_id)) THEN
      RAISE EXCEPTION 'Somente integrantes da equipe testadora podem registrar este bug';
    END IF;
    IF NEW.author_id <> auth.uid() AND NOT is_instr THEN
      RAISE EXCEPTION 'Autoria inválida';
    END IF;
    IF NEW.assignee_id IS NOT NULL
       AND NOT public.is_group_member(p.developer_group_id, NEW.assignee_id) THEN
      RAISE EXCEPTION 'O responsável precisa pertencer à equipe desenvolvedora';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.pairing_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO p FROM public.cross_test_pairings WHERE id = OLD.pairing_id;
  is_dev := public.is_group_member(OLD.developer_group_id, auth.uid());
  is_tester := public.is_group_member(OLD.group_id, auth.uid());

  IF NOT (is_instr OR is_dev OR is_tester) THEN
    RAISE EXCEPTION 'Sem autorização sobre este bug';
  END IF;

  -- campos de contexto são imutáveis
  NEW.id := OLD.id;
  NEW.author_id := OLD.author_id;
  NEW.group_id := OLD.group_id;
  NEW.context := OLD.context;
  NEW.pairing_id := OLD.pairing_id;
  NEW.developer_group_id := OLD.developer_group_id;
  NEW.section_id := OLD.section_id;

  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    IF NEW.assignee_id IS NOT NULL
       AND NOT public.is_group_member(OLD.developer_group_id, NEW.assignee_id) THEN
      RAISE EXCEPTION 'O responsável precisa pertencer à equipe desenvolvedora';
    END IF;
    IF NOT (is_instr OR is_dev OR is_tester) THEN
      RAISE EXCEPTION 'Sem autorização para definir o responsável';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    side := public.cross_test_status_allowed(OLD.status, NEW.status);
    IF side IS NULL THEN
      RAISE EXCEPTION 'Transição de situação não permitida: % -> %', OLD.status, NEW.status;
    END IF;
    IF NOT is_instr THEN
      IF side = 'dev' AND NOT is_dev THEN
        RAISE EXCEPTION 'Somente a equipe desenvolvedora pode aplicar esta mudança de situação';
      END IF;
      IF side = 'tester' AND NOT is_tester THEN
        RAISE EXCEPTION 'Somente a equipe testadora pode aplicar esta mudança de situação';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER cross_test_bugs_guard_trg
  BEFORE INSERT OR UPDATE ON public.qa_bugs
  FOR EACH ROW EXECUTE FUNCTION public.cross_test_bugs_guard();

-- 4) RPCs
CREATE OR REPLACE FUNCTION public.cross_test_report_bug(
  _pairing_id uuid,
  _title text,
  _description text,
  _environment text DEFAULT '',
  _steps text DEFAULT '',
  _expected_result text DEFAULT '',
  _obtained_result text DEFAULT '',
  _severity text DEFAULT 'media',
  _priority text DEFAULT 'media',
  _test_case_id uuid DEFAULT NULL,
  _feature_id uuid DEFAULT NULL,
  _assignee_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.cross_test_pairings%ROWTYPE;
  u uuid := auth.uid();
  new_id uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  SELECT * INTO p FROM public.cross_test_pairings WHERE id = _pairing_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Pareamento inexistente'; END IF;
  IF NOT public.is_group_member(p.tester_group_id, u) THEN
    RAISE EXCEPTION 'Você não pertence à equipe testadora deste pareamento';
  END IF;
  IF COALESCE(trim(_title), '') = '' THEN RAISE EXCEPTION 'Informe o título do bug'; END IF;
  IF _assignee_id IS NOT NULL AND NOT public.is_group_member(p.developer_group_id, _assignee_id) THEN
    RAISE EXCEPTION 'O responsável precisa pertencer à equipe desenvolvedora';
  END IF;
  IF _test_case_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.qa_test_cases c
    WHERE c.id = _test_case_id
      AND (c.author_id = u OR (c.group_id IS NOT NULL AND public.is_group_member(c.group_id, u)))
  ) THEN
    RAISE EXCEPTION 'Caso de teste inválido ou sem autorização';
  END IF;

  INSERT INTO public.qa_bugs (
    context, group_id, project, title, description, environment, steps,
    expected_result, obtained_result, severity, priority, status,
    author_id, assignee_id, test_case_id, feature_id,
    pairing_id, developer_group_id, section_id
  ) VALUES (
    'cafe', p.tester_group_id, 'cafe_central', trim(_title), COALESCE(_description, ''),
    COALESCE(_environment, ''), COALESCE(_steps, ''), COALESCE(_expected_result, ''),
    COALESCE(_obtained_result, ''), COALESCE(_severity, 'media'), COALESCE(_priority, 'media'),
    'aberto', u, _assignee_id, _test_case_id, _feature_id,
    p.id, p.developer_group_id, p.section_id
  ) RETURNING id INTO new_id;

  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cross_test_claim_bug(_bug_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.qa_bugs%ROWTYPE;
  u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  SELECT * INTO b FROM public.qa_bugs WHERE id = _bug_id FOR UPDATE;
  IF b.id IS NULL OR b.pairing_id IS NULL THEN
    RAISE EXCEPTION 'Bug de teste cruzado inexistente';
  END IF;
  IF NOT public.is_group_member(b.developer_group_id, u) THEN
    RAISE EXCEPTION 'Somente a equipe desenvolvedora responsável pode assumir este bug';
  END IF;
  IF b.assignee_id IS NOT NULL THEN
    IF b.assignee_id = u THEN RETURN b.assignee_id; END IF;
    RAISE EXCEPTION 'Este bug já possui responsável';
  END IF;
  IF b.status IN ('resolvido','descartado') THEN
    RAISE EXCEPTION 'Este bug não pode mais ser assumido';
  END IF;

  UPDATE public.qa_bugs SET assignee_id = u, updated_at = now() WHERE id = _bug_id;
  RETURN u;
END; $$;

CREATE OR REPLACE FUNCTION public.cross_test_set_assignee(_bug_id uuid, _assignee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.qa_bugs%ROWTYPE;
  u uuid := auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  SELECT * INTO b FROM public.qa_bugs WHERE id = _bug_id FOR UPDATE;
  IF b.id IS NULL OR b.pairing_id IS NULL THEN RAISE EXCEPTION 'Bug de teste cruzado inexistente'; END IF;
  IF NOT (public.has_role(u,'instructor')
          OR public.is_group_member(b.group_id, u)
          OR public.is_group_member(b.developer_group_id, u)) THEN
    RAISE EXCEPTION 'Sem autorização sobre este bug';
  END IF;
  IF _assignee_id IS NOT NULL AND NOT public.is_group_member(b.developer_group_id, _assignee_id) THEN
    RAISE EXCEPTION 'O responsável precisa pertencer à equipe desenvolvedora';
  END IF;
  UPDATE public.qa_bugs SET assignee_id = _assignee_id, updated_at = now() WHERE id = _bug_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cross_test_transition(_bug_id uuid, _status text, _note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b public.qa_bugs%ROWTYPE;
  u uuid := auth.uid();
  side text;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  SELECT * INTO b FROM public.qa_bugs WHERE id = _bug_id FOR UPDATE;
  IF b.id IS NULL OR b.pairing_id IS NULL THEN RAISE EXCEPTION 'Bug de teste cruzado inexistente'; END IF;
  side := public.cross_test_status_allowed(b.status, _status);
  IF side IS NULL THEN
    RAISE EXCEPTION 'Transição de situação não permitida: % -> %', b.status, _status;
  END IF;
  IF NOT public.has_role(u,'instructor') THEN
    IF side = 'dev' AND NOT public.is_group_member(b.developer_group_id, u) THEN
      RAISE EXCEPTION 'Somente a equipe desenvolvedora pode aplicar esta mudança';
    END IF;
    IF side = 'tester' AND NOT public.is_group_member(b.group_id, u) THEN
      RAISE EXCEPTION 'Somente a equipe testadora pode aplicar esta mudança';
    END IF;
  END IF;

  UPDATE public.qa_bugs
     SET status = _status,
         obtained_result = CASE
           WHEN COALESCE(trim(_note), '') = '' THEN obtained_result
           ELSE COALESCE(obtained_result, '') || E'\n\n[' || to_char(now(), 'DD/MM/YYYY HH24:MI') || '] ' || trim(_note)
         END,
         updated_at = now()
   WHERE id = _bug_id;
END; $$;

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
  next_status text;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF _result NOT IN ('aprovado','reprovado') THEN
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

  next_status := CASE WHEN _result = 'aprovado' THEN 'resolvido' ELSE 'reaberto' END;

  INSERT INTO public.qa_retests (bug_id, tester_id, result, notes)
  VALUES (_bug_id, u, _result, COALESCE(_notes, ''))
  RETURNING id INTO retest_id;

  UPDATE public.qa_bugs SET status = next_status, updated_at = now() WHERE id = _bug_id;

  RETURN retest_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.cross_test_report_bug(uuid,text,text,text,text,text,text,text,text,uuid,uuid,uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.cross_test_claim_bug(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.cross_test_set_assignee(uuid,uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.cross_test_transition(uuid,text,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.cross_test_retest(uuid,text,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.cross_test_status_allowed(text,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.cross_test_pairings_guard() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.cross_test_bugs_guard() FROM public, anon;

GRANT EXECUTE ON FUNCTION public.cross_test_report_bug(uuid,text,text,text,text,text,text,text,text,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cross_test_claim_bug(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cross_test_set_assignee(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cross_test_transition(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cross_test_retest(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cross_test_status_allowed(text,text) TO authenticated;
