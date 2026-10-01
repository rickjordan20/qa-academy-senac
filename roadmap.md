
- [x] Adicionar botão "Entrar com Google" na tela de login
- [x] Adicionar botão "Entrar com Microsoft" na tela de login
- [x] CRUD completo dos registros de QA (editar/excluir por autor, grupo e instrutor; autoria e vínculos protegidos no banco)
- [x] Exibir resultado e feedback específico da avaliação em cada bloco da entrega do aluno
- [x] Teste cruzado: listar casos de teste da missão e nomes reais dos desenvolvedores pareados no formulário de bug
- [x] UX dos blocos Usabilidade e Acessibilidade: placeholders didáticos, tempo mm:ss, participante do teste, guia recolhível de acessibilidade, método/critério padronizados, vínculo opcional com funcionalidade, evidência e bug
- [x] Data de abertura das missões como bloqueio real: antes do horário o aluno vê a missão agendada, mas não abre, preenche, grava nem entrega (bloqueio também no banco); prazo continua sinalizando atraso e a revisão do instrutor permanece liberada

## Google Classroom — Fase 1 (conciliação de identidades)
- [x] Migration: google_classroom_connections / _class_links / _student_links (RLS por instrutor da turma)
- [x] OAuth server-side com state assinado (HMAC) e callback /api/public/google-classroom/callback
- [x] Server Functions: iniciar conexão, listar cursos, vincular/desvincular turma, sincronizar, vincular/desvincular aluno, desconectar conta
- [x] Modal "Google Classroom" na tela da turma (integrantes)
- [x] Secrets GOOGLE_CLASSROOM_CLIENT_ID / GOOGLE_CLASSROOM_CLIENT_SECRET configurados
- [x] Estado "Ignorado" para alunos do Classroom sem conta no QA Academy (ignorar / reavaliar, contador no resumo)

## Google Classroom — Fase 2 (publicação de missões)
- [x] Tabela de publicações (UNIQUE missão+turma), scope coursework.me, publicar/atualizar, modal com turma de destino, returnTo seguro no login

## Controle de edição das missões pelo estado da avaliação
- [x] Banco: builder_run_can_edit e policy de UPDATE em builder_mission_runs — editável em NULL/none/awaiting/revision; bloqueado em in_review/evaluated/reeval
- [x] Tela da missão: readOnly por eval_status (não por submitted_at), avisos por estado e botão de entrega/atualização/reenvio
- [x] MissionTaskBoard, SectionAssign e contribuições respeitando o bloqueio
- [x] Central de QA (bugs, casos de teste, evidências) respeitando o estado da missão de origem
- [x] Testes dos estados e do ciclo completo, incluindo tentativas diretas no banco/API
