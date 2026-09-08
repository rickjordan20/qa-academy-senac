# Dashboard do instrutor mais completo

Hoje o painel inicial mostra apenas três números (turmas, alunos, grupos), a lista de turmas e a contagem bruta de A/PA/NA por indicador. Ele não responde às perguntas do dia a dia: quem está em risco, o que falta corrigir, quem sumiu.

A proposta é transformar a página inicial em um painel de acompanhamento, reaproveitando tudo o que já existe (situação da UC, próxima ação, entregas, XP, participação) — sem criar tabelas novas, sem alterar avaliações, entregas, XP ou permissões.

## O que passa a aparecer

**1. Seletor de turma**
Filtro no topo (todas as turmas ou uma específica). Todos os blocos abaixo respeitam esse filtro.

**2. Faixa de números que importam**
- Alunos ativos na turma
- Entregas aguardando avaliação
- Entregas devolvidas para correção
- XP pendente de aprovação
- Alunos sem nenhuma entrega
- Alunos que já podem receber resultado final

**3. Alunos em risco (bloco principal)**
Lista ordenada por gravidade, com o motivo escrito em texto claro e link direto para o aluno. Um aluno entra na lista quando:
- tem indicador NA no fechamento (precisa de recuperação)
- não entregou nenhuma missão aberta ou tem missões vencidas sem entrega
- está com poucos indicadores avaliados perto do fim
- não registrou nenhuma participação no grupo do Café Central
- ainda não deu ciência de como será avaliado

Cada linha mostra o nome, o motivo, quantos indicadores já tem avaliados e a próxima ação sugerida (mesma regra já usada nos relatórios).

**4. O que precisa da sua atenção agora**
Fila curta de pendências do instrutor: entregas aguardando avaliação (mais antigas primeiro), XP pendente, planos de recuperação em aberto e resultados finais prontos para confirmar. Cada item leva à tela correspondente.

**5. Progresso da turma nos indicadores I1–I6**
Barra por indicador mostrando quantos alunos já estão em A, PA, NA e quantos ainda não foram avaliados (hoje o "não avaliado" simplesmente não aparece, o que engana a leitura).

**6. Situação da UC na turma**
Resumo visual: não avaliados, em andamento, avaliação final aberta, em recuperação, prontos para D, prontos para ND, D e ND confirmados.

**7. Missões em andamento**
Últimas missões com prazo próximo ou vencido e o percentual de entrega de cada uma.

**8. Ranking e engajamento (informativo)**
Top de XP individual e por equipe, deixando explícito que XP não define A/PA/NA.

## Detalhes técnicos

- Arquivo alterado: `src/routes/instructor/dashboard.tsx`. Novo arquivo de leitura de dados: `src/lib/instructor-overview.ts` (hooks React Query somente de leitura) e componentes de apresentação em `src/components/dashboard/`.
- Reutiliza sem modificar: `ucSituation()`, `nextAction()`, `studentSituation()`, `useClassStudents`, `useClassEvaluations`, `useRecoveryPlans`, `useUcResults` (`src/lib/assessment.ts`); `useAllSubmissions`, `runSituation`, `EVAL_LABEL` (`src/lib/mission-submissions.ts`); `temporalStatus`, `fmtMissionDateTimeShort` (`src/lib/mission-schedule.ts`); `usePendingXpQueue`, `useIndividualRanking`, `useTeamRanking` (`src/lib/gamification.ts`); participação real do Café Central (`src/lib/mission-participation.ts`); `ConceptBadge`.
- Regra de risco isolada em uma função pura `riskFlags()` com testes em `src/lib/__tests__/`, para que os critérios fiquem auditáveis e consistentes com o fluxo de avaliação atual.
- Somente SELECT: nenhuma migração, nenhuma alteração de RLS, nenhuma escrita. Sem recálculo de XP, badges ou conceitos.
- Consultas agregadas por turma e limitadas em quantidade, com carregamento por blocos para não pesar a abertura da página.
- Responsivo (cartões empilham no celular) e navegação por teclado nos links das listas.

## Fora de escopo

Nenhuma mudança em rotas, menus, permissões, telas de avaliação, relatórios, missões ou dados existentes.
