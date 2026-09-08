# Evolução dos Relatórios da QA Academy

Objetivo: alinhar a área de Relatórios ao novo modelo de avaliação da UC10 (formativa A/PA/NA → Avaliação Final A/NA → Recuperação Final → D/ND), sem alterar avaliações, entregas, XP ou histórico.

## 1. Corrigir o índice de Relatórios (`/instructor/reports`)

- Usar a mesma regra de situação da Avaliação Final: pendência de recuperação passa a considerar apenas indicadores **NA no fechamento final**, não mais PA.
- Coluna "Situação" passa a exibir os status oficiais: Em avaliação, Avaliação Final, Necessita Recuperação Final, Em Recuperação Final, Desenvolvido, Não Desenvolvido.
- Relatório de recuperação passa a listar somente indicadores NA do fechamento.
- Novo relatório **Reavaliações necessárias**: aluno/grupo, missão, turma, tentativa, data original, indicadores envolvidos.
- Novo relatório **XP e badges** (informativo, separado da avaliação): XP total, XP pendente, badges conquistados.

## 2. Novo relatório: Fechamento por Aluno (PDF)

Rota nova: `/instructor/reports/closure`.

- Filtros: turma e aluno (ou "todos os alunos da turma" em um único PDF).
- Conteúdo por aluno:
  - identificação, turma, grupo e função no grupo;
  - **Parte 1 — Histórico formativo**: por indicador I1–I6, a lista das missões que geraram menção e o conceito de cada uma (evolução NA → PA → A), sem média;
  - **Parte 2 — Avaliação Final**: conceito A/NA de cada indicador, avaliador e data;
  - **Parte 3 — Recuperação Final**: indicadores recuperados, nova evidência e novo conceito, quando houver;
  - **Resultado**: D, ND ou "Necessita Recuperação Final", com os indicadores pendentes nomeados;
  - **Evidências e feedbacks**: registros, links e feedbacks por indicador;
  - **XP e badges** em bloco separado, com aviso explícito de que não influenciam o conceito.
- Somente leitura: nenhum dado é criado ou alterado ao gerar o PDF.

## 3. Enriquecer o relatório de Entregas por Missão

- Incluir os novos status ("Reavaliação necessária", "Em reavaliação") no resumo e por entrega.
- Em missões de grupo, incluir a seção **Divisão de tarefas e participação** já existente: tarefas, responsáveis, quem realmente produziu, registros, contribuições, evidências e autoria.
- Indicar quando a menção de um integrante difere da menção do grupo, com a justificativa registrada.
- Mostrar histórico de versões da avaliação (versão vigente + anteriores identificadas como histórico).

## 4. Padronização

- Todos os relatórios passam a usar a função única de situação já existente, evitando textos divergentes entre telas.
- Todos ganham exportação consistente: CSV nas tabelas e PDF nos relatórios consolidados.
- Reorganizar o índice em três grupos: **Acompanhamento** (alunos, indicadores, turma, grupos), **Avaliação** (reavaliações, recuperação, fechamento por aluno) e **Entregas** (por missão).

## Detalhes técnicos

- Sem mudanças de banco: tudo é leitura de `indicator_evaluations` (com `stage` e campos de origem), `eval_history`, `uc_results`, `recovery_plans`, `builder_mission_runs`, `builder_run_evaluations`, `builder_mission_entries`, `gam_xp_events`, `gam_student_badges` e das tabelas de grupo.
- Reaproveitar `src/lib/mission-report.ts`, `src/lib/mission-report-pdf.ts` (jsPDF), `useIndicatorOrigins`, `src/lib/mission-participation.ts`, `GroupParticipation` e `downloadCsv`.
- Novo módulo `src/lib/closure-report.ts` + `src/lib/closure-report-pdf.ts` para o PDF de fechamento, seguindo o padrão do relatório de entregas.
- Regras de status centralizadas em `src/lib/assessment.ts`; nenhuma regra nova é duplicada nas telas.
- Nenhuma mutação: os relatórios só consultam. XP, badges, avaliações, entregas e histórico permanecem intactos.
