
-- helpers
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = _group_id AND gm.student_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = _group_id AND g.qa_lead_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_group_qa_lead(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups g WHERE g.id = _group_id AND g.qa_lead_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_group(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_group_qa_lead(_group_id, _user_id)
      OR public.is_class_instructor(public.group_class_id(_group_id), _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_view_group(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_group_member(_group_id, _user_id)
      OR public.is_class_instructor(public.group_class_id(_group_id), _user_id);
$$;

REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_group_qa_lead(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_group(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_view_group(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_group_qa_lead(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_group(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_group(uuid, uuid) TO authenticated, service_role;

-- execuções coletivas
CREATE TABLE public.cafe_group_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.techeduca_missions(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress',
  deliverable text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  submitted_by uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, group_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafe_group_runs TO authenticated;
GRANT ALL ON public.cafe_group_runs TO service_role;
ALTER TABLE public.cafe_group_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY cafe_runs_select ON public.cafe_group_runs FOR SELECT TO authenticated
  USING (public.can_view_group(group_id, auth.uid()));
CREATE POLICY cafe_runs_insert ON public.cafe_group_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY cafe_runs_update ON public.cafe_group_runs FOR UPDATE TO authenticated
  USING (public.can_manage_group(group_id, auth.uid()))
  WITH CHECK (public.can_manage_group(group_id, auth.uid()));
CREATE TRIGGER cafe_runs_updated_at BEFORE UPDATE ON public.cafe_group_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- tarefas
CREATE TABLE public.cafe_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.cafe_group_runs(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  assignee_id uuid,
  status text NOT NULL DEFAULT 'todo',
  position integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cafe_tasks_status_check CHECK (status IN ('todo','doing','review','done','blocked'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafe_tasks TO authenticated;
GRANT ALL ON public.cafe_tasks TO service_role;
ALTER TABLE public.cafe_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY cafe_tasks_select ON public.cafe_tasks FOR SELECT TO authenticated
  USING (public.can_view_group(group_id, auth.uid()));
CREATE POLICY cafe_tasks_insert ON public.cafe_tasks FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_group(group_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY cafe_tasks_update ON public.cafe_tasks FOR UPDATE TO authenticated
  USING (public.can_manage_group(group_id, auth.uid()) OR assignee_id = auth.uid())
  WITH CHECK (public.can_manage_group(group_id, auth.uid()) OR assignee_id = auth.uid());
CREATE POLICY cafe_tasks_delete ON public.cafe_tasks FOR DELETE TO authenticated
  USING (public.can_manage_group(group_id, auth.uid()));
CREATE TRIGGER cafe_tasks_updated_at BEFORE UPDATE ON public.cafe_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- colaboradores da tarefa
CREATE TABLE public.cafe_task_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.cafe_tasks(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  added_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafe_task_collaborators TO authenticated;
GRANT ALL ON public.cafe_task_collaborators TO service_role;
ALTER TABLE public.cafe_task_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY cafe_collab_select ON public.cafe_task_collaborators FOR SELECT TO authenticated
  USING (public.can_view_group(group_id, auth.uid()));
CREATE POLICY cafe_collab_write ON public.cafe_task_collaborators FOR ALL TO authenticated
  USING (public.can_manage_group(group_id, auth.uid()))
  WITH CHECK (public.can_manage_group(group_id, auth.uid()));

-- contribuições individuais dentro do trabalho coletivo
CREATE TABLE public.cafe_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.cafe_group_runs(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.cafe_tasks(id) ON DELETE SET NULL,
  student_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'nota',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cafe_contrib_kind_check CHECK (kind IN ('caso','execucao','evidencia','analise','nota'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafe_contributions TO authenticated;
GRANT ALL ON public.cafe_contributions TO service_role;
ALTER TABLE public.cafe_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cafe_contrib_select ON public.cafe_contributions FOR SELECT TO authenticated
  USING (public.can_view_group(group_id, auth.uid()));
CREATE POLICY cafe_contrib_insert ON public.cafe_contributions FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY cafe_contrib_update ON public.cafe_contributions FOR UPDATE TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY cafe_contrib_delete ON public.cafe_contributions FOR DELETE TO authenticated
  USING (student_id = auth.uid());
CREATE TRIGGER cafe_contrib_updated_at BEFORE UPDATE ON public.cafe_contributions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- solicitações de evidência feitas pelo QA Lead
CREATE TABLE public.cafe_evidence_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.cafe_group_runs(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.cafe_tasks(id) ON DELETE SET NULL,
  requested_by uuid NOT NULL,
  requested_from uuid NOT NULL,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  fulfilled_contribution_id uuid REFERENCES public.cafe_contributions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cafe_evreq_status_check CHECK (status IN ('pending','fulfilled','cancelled'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafe_evidence_requests TO authenticated;
GRANT ALL ON public.cafe_evidence_requests TO service_role;
ALTER TABLE public.cafe_evidence_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY cafe_evreq_select ON public.cafe_evidence_requests FOR SELECT TO authenticated
  USING (public.can_view_group(group_id, auth.uid()));
CREATE POLICY cafe_evreq_insert ON public.cafe_evidence_requests FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_group(group_id, auth.uid()) AND requested_by = auth.uid());
CREATE POLICY cafe_evreq_update ON public.cafe_evidence_requests FOR UPDATE TO authenticated
  USING (public.can_manage_group(group_id, auth.uid()) OR requested_from = auth.uid())
  WITH CHECK (public.can_manage_group(group_id, auth.uid()) OR requested_from = auth.uid());
CREATE POLICY cafe_evreq_delete ON public.cafe_evidence_requests FOR DELETE TO authenticated
  USING (public.can_manage_group(group_id, auth.uid()));
CREATE TRIGGER cafe_evreq_updated_at BEFORE UPDATE ON public.cafe_evidence_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- missão modelo
INSERT INTO public.techeduca_missions (code, track, kind, title, objective, summary, indicator_codes, checklist, practice, checkpoint, position, published)
VALUES (
  'cafe-aula3',
  'cafe_central',
  'team_autonomous',
  'Aula 3 – Desafio QA – Café Central',
  'Em grupo, investigar de forma autônoma o sistema do Café Central, distribuir áreas de teste, registrar contribuições individuais e produzir uma entrega coletiva.',
  '[{"topic":"Contexto","text":"O Café Central lançou um sistema de pedidos online. O grupo assume o papel de time de QA contratado para avaliar a aplicação antes do lançamento."},{"topic":"Organização","text":"O QA Lead distribui as áreas de investigação entre os integrantes e acompanha o progresso das tarefas."},{"topic":"Autoria","text":"Toda contribuição registrada guarda o nome de quem a produziu: quem criou o caso, quem executou, quem anexou a evidência."},{"topic":"Entrega","text":"O grupo reúne os resultados em uma entrega coletiva, concluída pelo QA Lead."}]'::jsonb,
  ARRAY['I1','I2','I3','I4'],
  '[{"id":"c1","label":"QA Lead distribuiu as áreas de investigação"},{"id":"c2","label":"Todos os integrantes possuem ao menos uma tarefa"},{"id":"c3","label":"Cada integrante registrou pelo menos uma contribuição"},{"id":"c4","label":"Evidências solicitadas foram atendidas"},{"id":"c5","label":"Resultados reunidos no texto da entrega coletiva"}]'::jsonb,
  '{"title":"Investigação do sistema Café Central","instructions":"Dividam o sistema em áreas e investiguem cada uma delas. Registrem casos de teste, execuções, achados e evidências — sempre identificando o autor de cada contribuição.","areas":["Cardápio e busca de produtos","Carrinho e cálculo de valores","Cadastro e login do cliente","Checkout e pagamento","Acompanhamento do pedido","Área administrativa do café"],"tips":["Comecem pelas áreas mais críticas para o negócio","Descrevam passos claros para reproduzir cada achado","Anexem prints ou links como evidência"]}'::jsonb,
  '[{"id":"q1","question":"Quais áreas apresentaram maior risco e por quê?"},{"id":"q2","question":"Como o grupo organizou a divisão de trabalho?"},{"id":"q3","question":"O que o grupo entrega como resultado final?"}]'::jsonb,
  1,
  true
);
