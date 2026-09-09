# Bugs e Evidências das missões na consulta unificada

## Causa confirmada

Investiguei os registros reais e o código. O que acontece hoje:

1. O bug criado dentro da missão foi salvo em `builder_mission_entries` com `kind = 'bug'`, e a evidência com `kind = 'evidence'` — exatamente como os casos de teste. Os dados estão lá (71 bugs e 63 evidências de missão registrados).
2. A Central de Bugs (`BugsPanel.tsx`) lê **apenas** a tabela `qa_bugs`. A aba Evidências (`EvidencesPanel.tsx`) lê **apenas** `qa_evidences`. Nenhuma das duas foi ligada ao leitor unificado.
3. O leitor unificado (`src/lib/qa-unified.ts`) até busca os registros de missão dos tipos bug e evidência, mas descarta os bugs e só aproveita evidências que tenham um "pai" (`parent_id`) apontando para um caso ou execução. Na prática **nenhum** bug ou evidência de missão tem esse vínculo preenchido: os 71 bugs e as 63 evidências têm `parent_id` vazio. Por isso somem completamente.

Ou seja: não é filtro de grupo nem de contexto Café Central. É que bugs e evidências de missão nunca chegam às telas.

## Correção proposta

Ampliar o mesmo leitor unificado (sem criar uma terceira implementação) para entregar quatro coleções: casos, execuções, bugs e evidências.

**Central de Bugs** passa a mostrar, na mesma lista: bugs criados ali e bugs criados dentro das missões, com missão de origem, autor, data, status, severidade e prioridade, caso relacionado quando houver e evidências ligadas. Bugs vindos de missão ficam somente leitura, com o botão "Abrir missão de origem".

**Evidências** passa a mostrar as evidências das missões junto das cadastradas ali, com tipo, descrição, autor, data, missão de origem, link/conteúdo e o registro relacionado quando houver, mais o botão para abrir a missão de origem.

**Rastreabilidade** passa a montar a cadeia Funcionalidade → Caso → Execução → Bug → Evidência também para registros de missão, agrupando por missão. Como os vínculos diretos não existem nos registros antigos, o encadeamento usa, nesta ordem: vínculo explícito quando existir; senão a funcionalidade; senão a menção textual ao caso (vários bugs trazem o caso escrito, por exemplo "CT08"); e o que não encaixar aparece agrupado como "sem vínculo", nunca escondido.

O contexto de retorno ("Voltar para Revisão e Auditoria") continua funcionando nas novas abas.

## Detalhes técnicos

- `src/lib/qa-unified.ts`: extrair a busca comum (runs do escopo → entries → títulos das missões) para um hook base e expor `useUnifiedBugs(scope, userId)` e `useUnifiedEvidences(scope, userId)` além de `useUnifiedCases`. Mapear `data` das entries: bug → `titulo`, `descricao`, `funcionalidade`, `precondicao`, `passos`, `esperado`, `obtido`, `ambiente`, `severidade`, `prioridade`, `status`, `responsavel`, `caso`; evidência → `titulo`, `tipo`, `descricao`, `conteudo`, `url`/`link`, `funcionalidade`, `observacao`. Normalizar severidade/prioridade/status de texto livre para o vocabulário de `SEVERITIES`/`PRIORITIES`/`BUG_STATUSES`, com fallback de exibição ao valor original.
- Vínculo por heurística somente em memória (nada é gravado): `parent_id` quando existir; senão `feature_id`; senão `data.caso`/`data.funcionalidade` casando com título/código curto do caso.
- `src/components/qa/BugsPanel.tsx` e `src/components/qa/EvidencesPanel.tsx`: trocar a fonte de leitura pelo leitor unificado, manter formulário e ações CRUD apenas para itens `origin: 'qa'`, adicionar badge de origem e link para `/student/activities/$missionId` preservando `returnTo`/`returnLabel`.
- `src/components/qa/TraceabilityPanel.tsx`: consumir as novas coleções para completar a cadeia de missão.
- Sem migração: nenhuma tabela, coluna, policy ou trigger é alterada. RLS atual (`builder_run_can_view`, `qa_can_view`) já permite a leitura. XP, A/PA/NA, avaliações e permissões ficam intactos.
- Validação final: percorrer autenticado como aluno do Café Central o fluxo caso → execução → bug → evidência → Módulos QA → Rastreabilidade → missão de origem → volta para a Auditoria.
