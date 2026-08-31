-- MISSIONS
CREATE TABLE public.techeduca_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  track text NOT NULL DEFAULT 'techeduca',
  kind text NOT NULL DEFAULT 'guided_individual',
  title text NOT NULL,
  objective text NOT NULL,
  summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  indicator_codes text[] NOT NULL DEFAULT '{}',
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  practice jsonb NOT NULL DEFAULT '{}'::jsonb,
  checkpoint jsonb NOT NULL DEFAULT '[]'::jsonb,
  position integer NOT NULL DEFAULT 1,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.techeduca_missions TO authenticated;
GRANT ALL ON public.techeduca_missions TO service_role;
ALTER TABLE public.techeduca_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY techeduca_missions_select ON public.techeduca_missions
  FOR SELECT TO authenticated USING (published);
CREATE TRIGGER techeduca_missions_updated_at BEFORE UPDATE ON public.techeduca_missions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RUNS (execução individual: o autor é sempre o aluno logado)
CREATE TABLE public.techeduca_mission_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.techeduca_missions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress',
  checklist_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  checkpoint_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  reflection text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mission_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.techeduca_mission_runs TO authenticated;
GRANT ALL ON public.techeduca_mission_runs TO service_role;
ALTER TABLE public.techeduca_mission_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY techeduca_runs_select_own ON public.techeduca_mission_runs
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.shares_class(auth.uid(), student_id));
CREATE POLICY techeduca_runs_insert_own ON public.techeduca_mission_runs
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY techeduca_runs_update_own ON public.techeduca_mission_runs
  FOR UPDATE TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY techeduca_runs_delete_own ON public.techeduca_mission_runs
  FOR DELETE TO authenticated USING (student_id = auth.uid());
CREATE TRIGGER techeduca_runs_updated_at BEFORE UPDATE ON public.techeduca_mission_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BUG REPORTS (Meus Registros)
CREATE TABLE public.techeduca_bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.techeduca_mission_runs(id) ON DELETE CASCADE,
  mission_id uuid REFERENCES public.techeduca_missions(id) ON DELETE SET NULL,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  problem text NOT NULL,
  classification text NOT NULL DEFAULT 'defeito',
  steps text NOT NULL DEFAULT '',
  expected_result text NOT NULL DEFAULT '',
  obtained_result text NOT NULL DEFAULT '',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.techeduca_bug_reports TO authenticated;
GRANT ALL ON public.techeduca_bug_reports TO service_role;
ALTER TABLE public.techeduca_bug_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY techeduca_bugs_select_own ON public.techeduca_bug_reports
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.shares_class(auth.uid(), student_id));
CREATE POLICY techeduca_bugs_insert_own ON public.techeduca_bug_reports
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY techeduca_bugs_update_own ON public.techeduca_bug_reports
  FOR UPDATE TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY techeduca_bugs_delete_own ON public.techeduca_bug_reports
  FOR DELETE TO authenticated USING (student_id = auth.uid());
CREATE TRIGGER techeduca_bugs_updated_at BEFORE UPDATE ON public.techeduca_bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- EVIDENCES (Minhas Evidências)
CREATE TABLE public.techeduca_evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.techeduca_mission_runs(id) ON DELETE CASCADE,
  bug_report_id uuid REFERENCES public.techeduca_bug_reports(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  link text,
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.techeduca_evidences TO authenticated;
GRANT ALL ON public.techeduca_evidences TO service_role;
ALTER TABLE public.techeduca_evidences ENABLE ROW LEVEL SECURITY;
CREATE POLICY techeduca_evidences_select_own ON public.techeduca_evidences
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.shares_class(auth.uid(), student_id));
CREATE POLICY techeduca_evidences_insert_own ON public.techeduca_evidences
  FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY techeduca_evidences_update_own ON public.techeduca_evidences
  FOR UPDATE TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY techeduca_evidences_delete_own ON public.techeduca_evidences
  FOR DELETE TO authenticated USING (student_id = auth.uid());
CREATE TRIGGER techeduca_evidences_updated_at BEFORE UPDATE ON public.techeduca_evidences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX techeduca_runs_student_idx ON public.techeduca_mission_runs(student_id);
CREATE INDEX techeduca_bugs_student_idx ON public.techeduca_bug_reports(student_id);
CREATE INDEX techeduca_evidences_student_idx ON public.techeduca_evidences(student_id);

-- MISSÃO MODELO
INSERT INTO public.techeduca_missions (code, title, objective, summary, indicator_codes, checklist, practice, checkpoint, position)
VALUES (
  'TECHEDUCA-AULA2',
  'Aula 2 – Fundamentos de Testes e Caça aos Bugs',
  'Compreender os fundamentos de qualidade de software e o papel do QA, diferenciar falha, erro e defeito, e registrar bugs com reprodução e evidência no TechEduca.',
  '[
    {"topic":"Qualidade de software","text":"Qualidade é o grau em que o software atende às necessidades reais de quem o usa: funciona, é confiável, é usável e pode ser mantido."},
    {"topic":"Papel do QA","text":"O QA não apenas encontra bugs: previne problemas, questiona requisitos, cria cenários de teste e comunica riscos com clareza."},
    {"topic":"Falha","text":"Falha é o comportamento incorreto percebido durante a execução do sistema."},
    {"topic":"Erro","text":"Erro é a ação humana equivocada (interpretação, lógica, digitação) que origina o problema."},
    {"topic":"Defeito","text":"Defeito é a imperfeição no código ou na documentação, causada por um erro, que pode gerar uma falha."},
    {"topic":"Resultado esperado","text":"É o comportamento correto definido pelo requisito ou pela regra de negócio."},
    {"topic":"Resultado obtido","text":"É o que realmente aconteceu ao executar o teste."},
    {"topic":"Reprodução","text":"São os passos claros e numerados que permitem a qualquer pessoa reproduzir o problema."},
    {"topic":"Evidência","text":"É a prova do problema: captura de tela, vídeo, log ou link que sustenta o registro."}
  ]'::jsonb,
  ARRAY['I1','I2'],
  '[
    {"id":"c1","label":"Li o conteúdo sobre qualidade de software e papel do QA"},
    {"id":"c2","label":"Sei diferenciar falha, erro e defeito"},
    {"id":"c3","label":"Explorei o TechEduca procurando problemas"},
    {"id":"c4","label":"Registrei pelo menos 1 bug com passos de reprodução"},
    {"id":"c5","label":"Anexei ou vinculei ao menos 1 evidência"},
    {"id":"c6","label":"Respondi o checkpoint"},
    {"id":"c7","label":"Escrevi minha reflexão final"}
  ]'::jsonb,
  '{
    "title":"Caça aos Bugs no TechEduca",
    "instructions":"Explore o TechEduca no seu próprio computador e procure comportamentos que fogem do esperado. Para cada problema encontrado, crie um registro descrevendo funcionalidade, problema, classificação, passos de reprodução, resultado esperado, resultado obtido, evidência e observação.",
    "tips":["Teste também caminhos inválidos (campos vazios, dados errados)","Descreva passos numerados e curtos","Uma evidência vale mais que uma descrição longa"]
  }'::jsonb,
  '[
    {"id":"q1","question":"Com suas palavras, qual a diferença entre erro, defeito e falha?"},
    {"id":"q2","question":"Por que o resultado esperado precisa ser descrito antes do resultado obtido?"},
    {"id":"q3","question":"O que torna um passo de reprodução realmente útil?"},
    {"id":"q4","question":"Qual evidência você produziu e por que ela comprova o problema?"}
  ]'::jsonb,
  1
);