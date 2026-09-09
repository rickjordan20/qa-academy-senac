# Consulta unificada dos testes do Café Central

Objetivo: o aluno encontrar, em um único lugar, todos os casos de teste e execuções que o grupo já fez — inclusive os criados dentro de missões — e conseguir corrigir registros incompletos durante a atividade de Revisão e Auditoria.

Nada é apagado, movido ou reescrito. Os registros continuam guardados onde estão hoje; a mudança é de leitura e de navegação.

## O que muda para o aluno

1. **Módulos QA passa a mostrar tudo**
   Na aba "Casos de teste", além dos casos cadastrados ali, aparecem também os casos criados dentro das missões do grupo, cada um com uma etiqueta indicando a missão de origem e o autor.

2. **Cada caso mostra suas execuções**
   Ao abrir um caso, o aluno vê as execuções ligadas a ele: resultado esperado, resultado obtido, status, evidências e quem executou.

3. **Filtros e busca**
   Filtrar por missão, funcionalidade, autor e status, além de busca por texto no título/funcionalidade.

4. **Links nos dois sentidos**
   - Do caso ou execução vindo de uma missão: botão "Abrir missão de origem".
   - Da missão: link "Ver todos os testes do grupo" apontando para Módulos QA já no contexto do grupo.

5. **Entrega concluída legível**
   Na tela da entrega, os registros deixam de aparecer como lista crua de campos e passam a ter rótulos (Funcionalidade, Pré-condição, Passos, Resultado esperado, Resultado obtido, Status), separados por tipo.

6. **Correção de registros**
   Registros criados dentro de missões continuam sendo corrigidos na própria missão (é lá que a edição existe e é permitida). O botão de origem leva o aluno direto ao ponto certo, fechando o ciclo da auditoria.

## Caminho final

Início do aluno → Minha Jornada → Módulos QA → contexto "Café Central — [grupo]" → aba Casos de teste → filtrar por missão → abrir caso → ver execuções → "Abrir missão de origem" → corrigir → voltar para a missão de auditoria.

## Detalhes técnicos

- Novo leitor em `src/lib/qa.ts` (ou módulo irmão `src/lib/qa-unified.ts`) que combina, apenas para leitura:
  - `qa_test_cases` / `qa_bugs` / `qa_evidences` (via hooks atuais `useTestCases`, `useBugs`, `useQaEvidences`);
  - `builder_mission_entries` filtradas por `kind in ('test_case','execution','bug','evidence','retest')` e pelos `run_id` das execuções do grupo (`builder_mission_runs` com `group_id` do escopo), reutilizando `useRunEntries`/consulta equivalente de `src/lib/mission-builder.ts`.
- Tipo normalizado comum (`UnifiedTestCase`, `UnifiedExecution`) com `origin: 'qa' | 'mission'`, `missionId`, `runId`, `authorId`, `featureId`, `parentId`, campos de conteúdo.
- Vínculo execução → caso: `parent_id` das entries; para os registros `qa_*`, o vínculo já existente por `test_case_id`.
- `src/components/qa/TestCasesPanel.tsx`: lista passa a consumir o leitor unificado; itens com `origin: 'mission'` são somente leitura no painel e exibem badge da missão + botão para `/student/activities/$missionId`. Formulário de criação/edição permanece exatamente como está para itens `origin: 'qa'`.
- `src/components/qa/TraceabilityPanel.tsx`: mesma fonte unificada, agrupando execuções/bugs/evidências sob o caso.
- `src/routes/student/missions.$runId.tsx`: renderização por `kind` usando o `BLOCK_CATALOG` de `src/lib/mission-builder.ts` para obter rótulos dos campos, no lugar de `Object.entries(e.data)`.
- Sem migração: nenhuma tabela, coluna, policy ou trigger é alterada. RLS atual já permite ao integrante ler as entries do grupo (`builder_run_can_view`) e os registros do grupo (`qa_can_view`).
- Sem mudança de rotas, menu, autenticação, guards, XP, badges, avaliações ou entregas.

## Fora deste plano

- Migrar registros de missão para as tabelas `qa_*` (duplicaria dados).
- Travar edição após a correção do instrutor (decisão pedagógica separada).
- Unificar `/student/records` e `/student/evidences` (acervos legados TechEduca).
