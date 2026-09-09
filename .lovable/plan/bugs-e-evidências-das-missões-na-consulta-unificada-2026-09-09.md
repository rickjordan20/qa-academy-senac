# Bugs e Evidências das missões na consulta unificada

## Causa confirmada

1. O bug criado dentro da missão foi salvo em `builder_mission_entries` com `kind = 'bug'`, e a evidência com `kind = 'evidence'`. Os dados estão lá: 71 bugs e 63 evidências de missão.
2. A Central de Bugs (`BugsPanel.tsx`) lê **apenas** `qa_bugs`; a aba Evidências (`EvidencesPanel.tsx`) lê **apenas** `qa_evidences`. Nenhuma das duas foi ligada ao leitor unificado.
3. O leitor unificado até busca os registros de missão desses tipos, mas descarta os bugs e só aproveita evidências que tenham "pai" (`parent_id`). Todos os 71 bugs e 63 evidências têm esse campo vazio, então somem.

Não é filtro de grupo nem de contexto Café Central.

**Por que o `parent_id` vem vazio:** ele foi projetado exatamente para esse vínculo e já é gravado hoje — mas só o bloco Execução oferece o seletor "Caso relacionado" que o preenche. Os blocos Bug e Evidência não têm esse seletor; o bloco Bug tem apenas um campo de texto livre "Caso relacionado". Ou seja, o aluno nunca teve como declarar o vínculo.

## Correção

Ampliar `qa-unified.ts` para entregar quatro coleções unificadas: Casos, Execuções, Bugs e Evidências. Sem terceira implementação paralela.

**Central de Bugs** passa a listar bugs criados ali e os 71 vindos das missões, com missão de origem, autor, data, status, severidade, prioridade, funcionalidade e os demais dados. Bugs de missão ficam somente leitura, com "Abrir missão de origem".

**Evidências** passa a listar as 63 evidências de missão junto das cadastradas ali, com tipo, descrição, autor, data, missão de origem, link/conteúdo e "Abrir missão de origem".

Nenhum registro histórico é escondido por falta de vínculo.

## Regra de vínculo (rastreabilidade)

Três níveis, sinalizados na tela:

1. **Vinculado** — existe `parent_id` explícito. Apresentado como relação confirmada.
2. **Vinculado (identificado pelo registro)** — o vínculo é inequívoco a partir dos próprios dados, por exemplo o campo "Caso relacionado" do bug contendo um código/título que corresponde a **exatamente um** caso do mesmo run. Apresentado como vinculado, com a indicação de como foi identificado.
3. **Não vinculado** — qualquer outra situação. Semelhança por missão, funcionalidade, autor, data ou contexto **não** conta como vínculo e não é apresentada como relação.

Registros do nível 3 aparecem normalmente, sob "🐞 Bug não vinculado a um caso de teste" ou "📎 Evidência não vinculada", mostrando missão de origem, autor, data, funcionalidade quando houver, demais dados e "Abrir missão de origem".

Nenhum registro histórico é alterado, migrado ou reescrito.

## Registros futuros

Adicionar aos blocos Bug e Evidência o mesmo seletor opcional de caso/execução relacionada que a Execução já usa, gravando `parent_id`. Fica opcional e não muda missões existentes nem invalida registros antigos.

## Detalhes técnicos

- `src/lib/qa-unified.ts`: extrair a busca comum (runs do escopo → entries → títulos de missão) para um hook base e expor `useUnifiedBugs` e `useUnifiedEvidences` além de `useUnifiedCases`. Mapear `data`: bug → `titulo`, `descricao`, `funcionalidade`, `precondicao`, `passos`, `esperado`, `obtido`, `ambiente`, `severidade`, `prioridade`, `status`, `responsavel`, `caso`; evidência → `titulo`, `tipo`, `descricao`, `conteudo`, `url`, `funcionalidade`, `observacao`. Normalizar severidade/prioridade/status para `SEVERITIES`/`PRIORITIES`/`BUG_STATUSES` com fallback ao texto original.
- Campo `linkKind: 'explicit' | 'derived' | 'none'` em cada bug/evidência unificado. `derived` só quando `data.caso` casa com exatamente um `test_case` do mesmo `run_id` (match único por título ou código curto); empate ou zero → `none`. Tudo em memória, nada é gravado.
- `BugsPanel.tsx` / `EvidencesPanel.tsx`: trocar a fonte pelo leitor unificado; formulário e ações CRUD só para `origin: 'qa'`; badge de origem e link para `/student/activities/$missionId` preservando `returnTo`/`returnLabel`.
- `TraceabilityPanel.tsx`: cadeia Funcionalidade → Caso → Execução → Bug → Evidência usando apenas `explicit` e `derived`; seção final "Sem vínculo" para o restante.
- `mission-builder.ts` + `DynamicFields.tsx`: seletor opcional de caso/execução nos blocos `bug` e `evidence`, gravando `parent_id` pelo caminho já existente (`values["case_id"]` em `addEntry`).
- Sem migração: nenhuma tabela, coluna, policy ou trigger alterada. RLS atual já permite a leitura. XP, A/PA/NA, avaliações e permissões intactos.
- Validação final autenticada como aluno do Café Central: missão → caso → execução → bug → evidência; depois Módulos QA (Casos, Bugs, Evidências, Rastreabilidade); conferir os 71 bugs e 63 evidências, ausência de duplicatas, marcação de não vinculados, "Abrir missão de origem" e "Voltar para Revisão e Auditoria".
