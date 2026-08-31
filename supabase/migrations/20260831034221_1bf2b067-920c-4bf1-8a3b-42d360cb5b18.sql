-- ============ Configurações de gamificação ============
CREATE TABLE public.gam_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  ranking_individual_enabled boolean NOT NULL DEFAULT true,
  ranking_teams_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gam_settings TO authenticated;
GRANT ALL ON public.gam_settings TO service_role;
ALTER TABLE public.gam_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gam_settings_read" ON public.gam_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "gam_settings_instructor_write" ON public.gam_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'instructor')) WITH CHECK (public.has_role(auth.uid(), 'instructor'));
CREATE TRIGGER gam_settings_updated_at BEFORE UPDATE ON public.gam_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.gam_settings (id) VALUES (true);

-- ============ Ações de XP configuráveis ============
CREATE TABLE public.gam_actions (
  code text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  xp integer NOT NULL DEFAULT 10,
  kind text NOT NULL DEFAULT 'individual' CHECK (kind IN ('individual','collective')),
  context text NOT NULL DEFAULT 'both' CHECK (context IN ('techeduca','cafe','both')),
  requires_validation boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gam_actions TO authenticated;
GRANT ALL ON public.gam_actions TO service_role;
ALTER TABLE public.gam_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gam_actions_read" ON public.gam_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "gam_actions_instructor_write" ON public.gam_actions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'instructor')) WITH CHECK (public.has_role(auth.uid(), 'instructor'));
CREATE TRIGGER gam_actions_updated_at BEFORE UPDATE ON public.gam_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.gam_actions (code, label, description, xp, kind, context, requires_validation, position) VALUES
  ('mission_completed','Missão concluída','Conclusão de uma missão guiada individual',50,'individual','both',false,1),
  ('test_case_created','Caso de teste criado','Criação de um caso de teste',15,'individual','both',false,2),
  ('test_execution','Execução de teste','Execução registrada de um caso de teste',20,'individual','both',false,3),
  ('evidence_added','Evidência registrada','Registro de uma evidência',10,'individual','both',false,4),
  ('bug_confirmed','Bug confirmado','Bug reportado e confirmado pelo professor',40,'individual','both',true,5),
  ('retest_done','Reteste realizado','Reteste de um bug corrigido',25,'individual','both',false,6),
  ('checkpoint_done','Checkpoint respondido','Checkpoint de missão respondido',10,'individual','both',false,7),
  ('reflection_done','Reflexão registrada','Reflexão final da missão',15,'individual','both',false,8),
  ('cafe_mission_delivered','Missão coletiva entregue','Entrega coletiva do grupo no Café Central',80,'collective','cafe',true,9),
  ('cafe_collaboration','Colaboração','Colaboração entre integrantes do grupo',30,'collective','cafe',true,10),
  ('cafe_delivery_quality','Qualidade da entrega','Qualidade avaliada da entrega coletiva',40,'collective','cafe',true,11),
  ('cafe_full_participation','Participação de todos','Todos os integrantes contribuíram',40,'collective','cafe',true,12);

-- ============ Eventos de XP ============
CREATE TABLE public.gam_xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  context text NOT NULL CHECK (context IN ('techeduca','cafe')),
  kind text NOT NULL DEFAULT 'individual' CHECK (kind IN ('individual','collective')),
  action_code text NOT NULL REFERENCES public.gam_actions(code),
  xp integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','rejected')),
  ref_kind text,
  ref_id uuid,
  note text NOT NULL DEFAULT '',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind = 'collective' OR student_id IS NOT NULL),
  CHECK (kind = 'individual' OR group_id IS NOT NULL)
);
CREATE UNIQUE INDEX gam_xp_events_unique_ref
  ON public.gam_xp_events (COALESCE(student_id, group_id), action_code, ref_id)
  WHERE ref_id IS NOT NULL;
CREATE INDEX gam_xp_events_student_idx ON public.gam_xp_events (student_id, status);
CREATE INDEX gam_xp_events_group_idx ON public.gam_xp_events (group_id, status);

GRANT SELECT, INSERT, UPDATE ON public.gam_xp_events TO authenticated;
GRANT ALL ON public.gam_xp_events TO service_role;
ALTER TABLE public.gam_xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gam_xp_events_select" ON public.gam_xp_events FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR (group_id IS NOT NULL AND public.can_view_group(group_id, auth.uid()))
    OR (student_id IS NOT NULL AND public.qa_is_instructor_of(student_id, auth.uid()))
  );

CREATE POLICY "gam_xp_events_insert" ON public.gam_xp_events FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    OR (group_id IS NOT NULL AND public.can_manage_group(group_id, auth.uid()))
  );

CREATE POLICY "gam_xp_events_instructor_update" ON public.gam_xp_events FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'instructor')
    AND (
      (student_id IS NOT NULL AND public.qa_is_instructor_of(student_id, auth.uid()))
      OR (group_id IS NOT NULL AND public.can_manage_group(group_id, auth.uid()))
    )
  )
  WITH CHECK (public.has_role(auth.uid(), 'instructor'));

CREATE TRIGGER gam_xp_events_updated_at BEFORE UPDATE ON public.gam_xp_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- XP e status vêm sempre da configuração da ação, nunca do cliente
CREATE OR REPLACE FUNCTION public.gam_apply_action_config()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a public.gam_actions%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.gam_actions WHERE code = NEW.action_code;
  IF a.code IS NULL OR NOT a.enabled THEN
    RAISE EXCEPTION 'Ação de XP inválida ou desativada: %', NEW.action_code;
  END IF;
  NEW.xp := a.xp;
  NEW.kind := a.kind;
  IF NOT public.has_role(auth.uid(), 'instructor') THEN
    NEW.status := CASE WHEN a.requires_validation THEN 'pending' ELSE 'approved' END;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER gam_xp_events_apply_config BEFORE INSERT ON public.gam_xp_events
  FOR EACH ROW EXECUTE FUNCTION public.gam_apply_action_config();

-- Alunos não podem alterar eventos já criados; professor registra a revisão
CREATE OR REPLACE FUNCTION public.gam_protect_xp_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'instructor') THEN
    RAISE EXCEPTION 'Somente o instrutor pode alterar eventos de XP';
  END IF;
  NEW.id := OLD.id;
  NEW.student_id := OLD.student_id;
  NEW.group_id := OLD.group_id;
  NEW.action_code := OLD.action_code;
  NEW.ref_id := OLD.ref_id;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER gam_xp_events_protect BEFORE UPDATE ON public.gam_xp_events
  FOR EACH ROW EXECUTE FUNCTION public.gam_protect_xp_update();

-- ============ Badges ============
CREATE TABLE public.gam_badges (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'award',
  criteria text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gam_badges TO authenticated;
GRANT ALL ON public.gam_badges TO service_role;
ALTER TABLE public.gam_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gam_badges_read" ON public.gam_badges FOR SELECT TO authenticated USING (true);

INSERT INTO public.gam_badges (code, name, description, icon, criteria, position) VALUES
  ('primeira_evidencia','Primeira Evidência','Registrou sua primeira evidência de teste.','camera','1 evidência registrada',1),
  ('cacador_de_bugs','Caçador de Bugs','Reportou 5 bugs.','bug','5 bugs registrados',2),
  ('tester_funcional','Tester Funcional','Executou 5 casos de teste.','check-check','5 execuções de casos',3),
  ('ux_detective','UX Detective','Reportou 3 problemas de usabilidade ou interface.','search','3 bugs de UX/interface',4),
  ('code_inspector','Code Inspector','Criou 10 casos de teste.','file-code','10 casos de teste criados',5),
  ('stress_tester','Stress Tester','Registrou bugs de severidade alta ou crítica.','flame','3 bugs de severidade alta/crítica',6),
  ('mestre_do_reteste','Mestre do Reteste','Concluiu 5 retestes.','refresh-ccw','5 retestes realizados',7),
  ('qa_lead','QA Lead','Atuou como QA Lead de um grupo.','crown','Ser QA Lead de um grupo',8),
  ('trabalho_em_equipe','Trabalho em Equipe','Contribuiu em uma entrega coletiva do Café Central.','users','1 contribuição coletiva',9),
  ('qa_360','QA 360°','Passou por todas as etapas: caso, execução, bug, evidência e reteste.','globe','Ciclo completo de QA',10);

CREATE TABLE public.gam_student_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_code text NOT NULL REFERENCES public.gam_badges(code) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, badge_code)
);
CREATE INDEX gam_student_badges_student_idx ON public.gam_student_badges (student_id);
GRANT SELECT, INSERT ON public.gam_student_badges TO authenticated;
GRANT ALL ON public.gam_student_badges TO service_role;
ALTER TABLE public.gam_student_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gam_student_badges_select" ON public.gam_student_badges FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.qa_is_instructor_of(student_id, auth.uid()));
CREATE POLICY "gam_student_badges_insert" ON public.gam_student_badges FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- ============ Ranking (somente XP, nunca conceitos) ============
CREATE OR REPLACE FUNCTION public.gam_ranking_individual()
RETURNS TABLE (student_id uuid, full_name text, xp bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
         COALESCE(NULLIF(trim(p.full_name), ''), split_part(p.email, '@', 1)) AS full_name,
         COALESCE(SUM(e.xp), 0)::bigint AS xp
  FROM public.profiles p
  JOIN public.gam_xp_events e
    ON e.student_id = p.id AND e.status = 'approved'
  WHERE (SELECT ranking_individual_enabled FROM public.gam_settings LIMIT 1)
    AND (p.id = auth.uid() OR public.shares_class(auth.uid(), p.id) OR public.shares_class(p.id, auth.uid()))
  GROUP BY p.id, p.full_name, p.email
  ORDER BY xp DESC
$$;
REVOKE ALL ON FUNCTION public.gam_ranking_individual() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gam_ranking_individual() TO authenticated;

CREATE OR REPLACE FUNCTION public.gam_ranking_teams()
RETURNS TABLE (group_id uuid, group_name text, xp bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.name, COALESCE(SUM(e.xp), 0)::bigint AS xp
  FROM public.groups g
  JOIN public.gam_xp_events e ON e.group_id = g.id AND e.status = 'approved'
  WHERE (SELECT ranking_teams_enabled FROM public.gam_settings LIMIT 1)
    AND (public.can_view_group(g.id, auth.uid())
         OR public.is_class_instructor(g.class_id, auth.uid())
         OR public.is_class_member(g.class_id, auth.uid()))
  GROUP BY g.id, g.name
  ORDER BY xp DESC
$$;
REVOKE ALL ON FUNCTION public.gam_ranking_teams() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gam_ranking_teams() TO authenticated;

GRANT EXECUTE ON FUNCTION public.gam_apply_action_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gam_protect_xp_update() TO authenticated;