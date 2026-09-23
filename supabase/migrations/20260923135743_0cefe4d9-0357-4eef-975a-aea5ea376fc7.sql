-- 1) Leitura de perfil entre equipes pareadas no teste cruzado (menor privilégio)
CREATE OR REPLACE FUNCTION public.shares_cross_test_pairing(_viewer uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select exists (
    select 1
    from public.cross_test_pairings p
    join public.group_members a
      on a.group_id in (p.tester_group_id, p.developer_group_id)
    join public.group_members b
      on b.group_id in (p.tester_group_id, p.developer_group_id)
     and b.group_id <> a.group_id
    where a.student_id = _viewer
      and b.student_id = _target
  );
$$;

REVOKE EXECUTE ON FUNCTION public.shares_cross_test_pairing(uuid, uuid) FROM anon;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT
USING (
  id = auth.uid()
  OR public.is_student_instructor(auth.uid(), id)
  OR public.shares_group(auth.uid(), id)
  OR public.shares_cross_test_pairing(auth.uid(), id)
);

-- 2) Origem explícita do caso de teste vinculado ao bug
ALTER TABLE public.qa_bugs
  ADD COLUMN IF NOT EXISTS test_case_entry_id uuid
    REFERENCES public.builder_mission_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS test_case_source text;

UPDATE public.qa_bugs
   SET test_case_source = 'qa'
 WHERE test_case_id IS NOT NULL AND test_case_source IS NULL;

ALTER TABLE public.qa_bugs
  DROP CONSTRAINT IF EXISTS qa_bugs_test_case_source_chk;
ALTER TABLE public.qa_bugs
  ADD CONSTRAINT qa_bugs_test_case_source_chk CHECK (
    (test_case_id IS NULL AND test_case_entry_id IS NULL AND test_case_source IS NULL)
    OR (test_case_id IS NOT NULL AND test_case_entry_id IS NULL AND test_case_source = 'qa')
    OR (test_case_entry_id IS NOT NULL AND test_case_id IS NULL AND test_case_source = 'mission')
  );

-- 3) RPC valida a origem antes de gravar o vínculo
CREATE OR REPLACE FUNCTION public.cross_test_report_bug(
  _pairing_id uuid,
  _title text,
  _description text,
  _environment text DEFAULT ''::text,
  _steps text DEFAULT ''::text,
  _expected_result text DEFAULT ''::text,
  _obtained_result text DEFAULT ''::text,
  _severity text DEFAULT 'media'::text,
  _priority text DEFAULT 'media'::text,
  _test_case_id uuid DEFAULT NULL::uuid,
  _feature_id uuid DEFAULT NULL::uuid,
  _assignee_id uuid DEFAULT NULL::uuid,
  _test_case_source text DEFAULT 'qa'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p public.cross_test_pairings%ROWTYPE;
  u uuid := auth.uid();
  new_id uuid;
  src text := COALESCE(NULLIF(trim(_test_case_source), ''), 'qa');
  qa_case uuid := NULL;
  entry_case uuid := NULL;
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

  IF _test_case_id IS NOT NULL THEN
    IF src NOT IN ('qa', 'mission') THEN
      RAISE EXCEPTION 'Origem de caso de teste inválida';
    END IF;

    IF src = 'qa' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.qa_test_cases c
        WHERE c.id = _test_case_id
          AND (c.author_id = u OR (c.group_id IS NOT NULL AND public.is_group_member(c.group_id, u)))
      ) THEN
        RAISE EXCEPTION 'Caso de teste inválido ou sem autorização';
      END IF;
      qa_case := _test_case_id;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.builder_mission_entries e
        WHERE e.id = _test_case_id
          AND e.kind = 'test_case'
          AND e.mission_id = p.mission_id
          AND (e.author_id = u OR e.group_id = p.tester_group_id)
      ) THEN
        RAISE EXCEPTION 'Caso de teste inválido ou sem autorização';
      END IF;
      entry_case := _test_case_id;
    END IF;
  END IF;

  INSERT INTO public.qa_bugs (
    context, group_id, project, title, description, environment, steps,
    expected_result, obtained_result, severity, priority, status,
    author_id, assignee_id, test_case_id, test_case_entry_id, test_case_source, feature_id,
    pairing_id, developer_group_id, section_id
  ) VALUES (
    'cafe', p.tester_group_id, 'cafe_central', trim(_title), COALESCE(_description, ''),
    COALESCE(_environment, ''), COALESCE(_steps, ''), COALESCE(_expected_result, ''),
    COALESCE(_obtained_result, ''), COALESCE(_severity, 'media'), COALESCE(_priority, 'media'),
    'aberto', u, _assignee_id, qa_case, entry_case,
    CASE WHEN qa_case IS NULL AND entry_case IS NULL THEN NULL WHEN qa_case IS NOT NULL THEN 'qa' ELSE 'mission' END,
    _feature_id, p.id, p.developer_group_id, p.section_id
  ) RETURNING id INTO new_id;

  RETURN new_id;
END; $function$;