# Consulta unificada dos testes do Café Central

Objetivo: o aluno encontrar, em um único lugar, todos os casos de teste e execuções que o grupo já fez — inclusive os criados dentro de missões — e conseguir corrigir registros incompletos durante a atividade de Revisão e Auditoria, sem perder o caminho de volta.

Nada é migrado, apagado ou duplicado. Os registros continuam guardados onde estão hoje; a mudança é de leitura e de navegação. Avaliação, XP, A/PA/NA e permissões ficam exatamente como estão.

## Prioridade 1 — Consulta unificada

**Módulos QA passa a mostrar tudo.** Na aba "Casos de teste", além dos casos cadastrados ali, aparecem também os casos criados dentro das missões do grupo.

**Caso e Execução são coisas distintas.**
- O Caso de Teste mostra: funcionalidade, pré-condição, dados de teste, passos e **resultado esperado**.
- Cada Execução mostra: **resultado obtido, status, evidências, responsável e data**.
- As execuções aparecem listadas dentro do caso a que pertencem.

**Identificação de origem.** Cada registro exibe, quando disponível: missão de origem, autor e última atualização.

**Filtros e busca.** Por missão, funcionalidade, autor e status, mais busca por texto.

## Prioridade 2 — Navegação com contexto preservado

- **Dentro de uma missão comum:** CTA "Ver registros desta missão".
- **Na missão de Revisão e Auditoria:** CTA "Ver todos os testes do grupo", levando a Módulos QA já no contexto do grupo certo.
- **Volta garantida:** ao sair da missão de Auditoria por esse caminho, o aluno leva o contexto consigo. Em Módulos QA e na missão de origem que ele abrir para corrigir, aparece um botão fixo "Voltar para Revisão e Auditoria", que o leva direto de volta à atividade — sem procurar de novo.

## Prioridade 3 (secundária) — Entregas antigas mais legíveis

Exibir os registros da tela de entrega concluída com rótulos (Funcionalidade, Pré-condição, Passos, Resultado esperado / Resultado obtido, Status) em vez de campos crus. Só é feito se não aumentar o risco das prioridades 1 e 2; caso contrário fica para depois.

## Caminho final

Início do aluno → Missões da Turma → Revisão e Auditoria → "Ver todos os testes do grupo" → Módulos QA (contexto Café Central — [grupo]) → abrir caso → ver execuções → "Abrir missão de origem" → corrigir → "Voltar para Revisão e Auditoria".

## Detalhes técnicos

- Leitor unificado somente leitura (`src/lib/qa-unified.ts`), combinando:
  - `qa_test_cases` / `qa_bugs` / `qa_evidences` via hooks atuais de `src/lib/qa.ts`;
  - `builder_mission_entries` com `kind in ('test_case','execution','bug','evidence','retest')`, filtradas pelos `run_id` das `builder_mission_runs` do `group_id` do escopo, reutilizando as consultas de `src/lib/mission-builder.ts`.
- Modelo normalizado com separação explícita:
  - `UnifiedTestCase`: `funcionalidade`, `precondicao`, `dados`, `passos`, `esperado`, `origin: 'qa' | 'mission'`, `missionId`, `missionTitle`, `runId`, `authorId`, `authorName`, `updatedAt`, `featureId`.
  - `UnifiedExecution`: `caseId` (de `parent_id`, ou `test_case_id` nos registros `qa_*`), `obtido`, `status`, `evidencias`, `authorId`, `authorName`, `executedAt`, `updatedAt`, mesma marcação de origem.
- Execuções sem caso identificável entram em um agrupamento "Sem caso vinculado", para não sumirem da auditoria.
- `src/components/qa/TestCasesPanel.tsx`: lista consome o leitor unificado; itens `origin: 'mission'` são somente leitura no painel, com badge de missão/autor/última atualização e botão para `/student/activities/$missionId`. Formulário de criação/edição permanece inalterado para itens `origin: 'qa'`.
- `src/components/qa/TraceabilityPanel.tsx`: mesma fonte, agrupando execuções, bugs e evidências sob o caso.
- Contexto de retorno: parâmetro de busca (`returnTo` + `returnLabel`) propagado de `/student/activities/$missionId` → `/student/qa` → `/student/activities/$missionId` (missão de origem), renderizando a barra "Voltar para Revisão e Auditoria". Nenhuma rota nova, nenhum caminho renomeado.
- CTA por tipo de missão: "Ver registros desta missão" em missões comuns; "Ver todos os testes do grupo" quando a missão for de auditoria/revisão (identificada por `template`/`activity_kind`/código da missão, sem cadastro manual).
- Prioridade 3: rótulos derivados do `BLOCK_CATALOG` de `src/lib/mission-builder.ts` em `src/routes/student/missions.$runId.tsx`.
- Sem migração: nenhuma tabela, coluna, policy ou trigger é alterada. A RLS atual já permite ao integrante ler as entries do grupo (`builder_run_can_view`) e os registros do grupo (`qa_can_view`). A edição continua acontecendo onde já é permitida hoje — dentro da missão de origem.
- Validação final: percorrer o fluxo completo autenticado como aluno do Café Central.

## Fora deste plano

- Migrar registros de missão para as tabelas `qa_*`.
- Travar edição após a correção do instrutor.
- Unificar `/student/records` e `/student/evidences` (acervos legados TechEduca).
