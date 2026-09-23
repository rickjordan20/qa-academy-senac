-- 1. Autorização compartilhada: autor OU integrante do grupo OU líder/instrutor
CREATE OR REPLACE FUNCTION public.qa_can_edit(_author uuid, _group_id uuid, _viewer uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _viewer IS NOT NULL AND (
       _author = _viewer
    OR (_group_id IS NOT NULL AND public.is_group_member(_group_id, _viewer))
    OR (_group_id IS NOT NULL AND public.can_manage_group(_group_id, _viewer))
    OR public.has_role(_viewer, 'instructor')
  );
$$;

-- 2. Casos de teste: exclusão alinhada à edição
DROP POLICY IF EXISTS "qa_cases_delete" ON public.qa_test_cases;
CREATE POLICY "qa_cases_delete" ON public.qa_test_cases FOR DELETE TO authenticated
  USING (public.qa_can_edit(author_id, group_id, auth.uid()));

-- 3. Bugs: exclusão alinhada à edição
DROP POLICY IF EXISTS "qa_bugs_delete" ON public.qa_bugs;
CREATE POLICY "qa_bugs_delete" ON public.qa_bugs FOR DELETE TO authenticated
  USING (pairing_id IS NULL AND public.qa_can_edit(author_id, group_id, auth.uid()));

-- 4. Evidências: edição e exclusão pelo grupo
DROP POLICY IF EXISTS "qa_evidences_update" ON public.qa_evidences;
CREATE POLICY "qa_evidences_update" ON public.qa_evidences FOR UPDATE TO authenticated
  USING (public.qa_can_edit(author_id, group_id, auth.uid()))
  WITH CHECK (public.qa_can_edit(author_id, group_id, auth.uid()));
DROP POLICY IF EXISTS "qa_evidences_delete" ON public.qa_evidences;
CREATE POLICY "qa_evidences_delete" ON public.qa_evidences FOR DELETE TO authenticated
  USING (public.qa_can_edit(author_id, group_id, auth.uid()));

-- 5. Guardas de imutabilidade (autoria, propriedade e vínculos estruturais)
CREATE OR REPLACE FUNCTION public.qa_immutable_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.author_id := OLD.author_id;
  NEW.group_id := OLD.group_id;
  NEW.context := OLD.context;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS qa_cases_immutable ON public.qa_test_cases;
CREATE TRIGGER qa_cases_immutable BEFORE UPDATE ON public.qa_test_cases
  FOR EACH ROW EXECUTE FUNCTION public.qa_immutable_ownership();

DROP TRIGGER IF EXISTS qa_evidences_immutable ON public.qa_evidences;
CREATE TRIGGER qa_evidences_immutable BEFORE UPDATE ON public.qa_evidences
  FOR EACH ROW EXECUTE FUNCTION public.qa_immutable_ownership();

CREATE OR REPLACE FUNCTION public.qa_bugs_immutable_ownership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.author_id := OLD.author_id;
  NEW.group_id := OLD.group_id;
  NEW.context := OLD.context;
  NEW.created_at := OLD.created_at;
  NEW.pairing_id := OLD.pairing_id;
  NEW.developer_group_id := OLD.developer_group_id;
  NEW.section_id := OLD.section_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS qa_bugs_immutable ON public.qa_bugs;
CREATE TRIGGER qa_bugs_immutable BEFORE UPDATE ON public.qa_bugs
  FOR EACH ROW EXECUTE FUNCTION public.qa_bugs_immutable_ownership();

-- 6. Registros de missão: grupo da entrega pode editar/excluir
CREATE OR REPLACE FUNCTION public.builder_entry_can_edit(_author uuid, _group_id uuid, _run_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL
     AND public.builder_run_can_edit(_run_id, _user_id)
     AND (
          _author = _user_id
       OR (_group_id IS NOT NULL AND public.is_group_member(_group_id, _user_id))
     );
$$;

DROP POLICY IF EXISTS "Autor edita o proprio registro" ON public.builder_mission_entries;
CREATE POLICY "Autor ou grupo edita o registro" ON public.builder_mission_entries FOR UPDATE TO authenticated
  USING (public.builder_entry_can_edit(author_id, group_id, run_id, auth.uid()))
  WITH CHECK (public.builder_entry_can_edit(author_id, group_id, run_id, auth.uid()));

DROP POLICY IF EXISTS "Autor remove o proprio registro" ON public.builder_mission_entries;
CREATE POLICY "Autor ou grupo remove o registro" ON public.builder_mission_entries FOR DELETE TO authenticated
  USING (public.builder_entry_can_edit(author_id, group_id, run_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.builder_entries_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'instructor') THEN
    RETURN NEW;
  END IF;
  NEW.id := OLD.id;
  NEW.author_id := OLD.author_id;
  NEW.group_id := OLD.group_id;
  NEW.run_id := OLD.run_id;
  NEW.mission_id := OLD.mission_id;
  NEW.section_id := OLD.section_id;
  NEW.kind := OLD.kind;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS builder_entries_immutable_trg ON public.builder_mission_entries;
CREATE TRIGGER builder_entries_immutable_trg BEFORE UPDATE ON public.builder_mission_entries
  FOR EACH ROW EXECUTE FUNCTION public.builder_entries_immutable();

-- 7. Contribuições do Café Central: grupo pode editar/excluir
DROP POLICY IF EXISTS "cafe_contrib_update" ON public.cafe_contributions;
CREATE POLICY "cafe_contrib_update" ON public.cafe_contributions FOR UPDATE TO authenticated
  USING (student_id = auth.uid() OR public.can_view_group(group_id, auth.uid()))
  WITH CHECK (student_id = auth.uid() OR public.can_view_group(group_id, auth.uid()));
DROP POLICY IF EXISTS "cafe_contrib_delete" ON public.cafe_contributions;
CREATE POLICY "cafe_contrib_delete" ON public.cafe_contributions FOR DELETE TO authenticated
  USING (student_id = auth.uid() OR public.can_manage_group(group_id, auth.uid()) OR public.is_group_member(group_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.cafe_contrib_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.id := OLD.id;
  NEW.student_id := OLD.student_id;
  NEW.group_id := OLD.group_id;
  NEW.created_at := OLD.created_at;
  NEW.builder_run_id := OLD.builder_run_id;
  NEW.mission_id := OLD.mission_id;
  NEW.section_id := OLD.section_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS cafe_contrib_immutable_trg ON public.cafe_contributions;
CREATE TRIGGER cafe_contrib_immutable_trg BEFORE UPDATE ON public.cafe_contributions
  FOR EACH ROW EXECUTE FUNCTION public.cafe_contrib_immutable();

REVOKE EXECUTE ON FUNCTION public.qa_can_edit(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.builder_entry_can_edit(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_can_edit(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.builder_entry_can_edit(uuid, uuid, uuid, uuid) TO authenticated;