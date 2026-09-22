# Aula 9 — Desenvolvedor × Tester | Café Central

## Objetivo
Implementar teste cruzado entre equipes com tickets reproduzíveis, encaminhamento, análise, correção, reteste e histórico auditável, sem perder registros anteriores nem alterar produção durante o desenvolvimento.

## Diagnóstico inicial (branch de origem: main, commit 62ef394)
- `src/components/qa/BugsPanel.tsx` já apresenta bugs unificados de `qa_bugs` e `builder_mission_entries`, porém retestes são consultados somente para IDs de `qa_bugs`.
- `src/lib/qa.ts` já possui `useCreateRetest` e atualiza o status do bug após registrar reteste.
- `src/lib/qa-unified.ts` reúne bugs das missões e registros QA; os bugs de missão remetem ao formulário de origem para edição.
- É necessário verificar regras de autorização, políticas RLS e a associação real entre equipes antes de permitir edição cruzada. Não considerar a simples presença de um ID de equipe no cliente como autorização.

## Fluxo de trabalho desejado
1. Tester cria ticket com título, ambiente, passos, esperado, obtido, evidência e vínculo ao caso/funcionalidade.
2. Ticket é encaminhado à equipe proprietária do sistema; responsável e data de encaminhamento ficam registrados.
3. Desenvolvedor confirma reprodução, pede informações ou justifica não reprodução; registra análise.
4. Desenvolvedor registra correção e encaminha para reteste; não fecha o ticket unilateralmente.
5. Tester executa reteste com resultado, observações e evidência; encerra quando resolvido ou reabre quando persiste.
6. Histórico imutável registra ator, momento, status anterior/novo e comentário; relatórios distinguem pendências e correções validadas.

## Regras de segurança e compatibilidade
- Nenhuma migração deve ser aplicada diretamente ao banco de produção durante o desenvolvimento.
- Validar tabelas, constraints e RLS existentes antes de adicionar colunas ou políticas; permissões devem ser verificadas no servidor/banco.
- Preservar dados de `qa_bugs`, `qa_retests` e `builder_mission_entries`, incluindo bugs sem `parent_id`; não duplicar bugs de missão em `qa_bugs` sem estratégia explícita de identidade e rastreabilidade.
- Se a origem do registro for missão, implementar reteste no mesmo modelo ou criar vínculo canônico verificável; não exibir botão de reteste que falhe para essa origem.
- Evitar permitir alteração livre de status sem transições validadas; validar também a autoria do reteste.
- Exigir evidências acessíveis e descrições de resultados; não exigir quantidade mínima de defeitos.

## Critérios de aceite
- Duas equipes distintas conseguem encaminhar e receber tickets autorizados sem visualizar registros de equipes não participantes.
- O ticket mantém autor, responsável, equipe testadora, equipe proprietária, histórico e evidências.
- Um bug de missão e um bug QA podem ser retestados sem perda de dados ou duplicação.
- Reteste resolvido fecha somente após validação pelo tester; reteste falho reabre.
- Testes de permissões negativas, regressão, build e lint passam antes do PR.
- PR separado para revisão; nenhum merge na main ou publicação automática nesta etapa.

## Aula (240 min)
Teoria e demonstração 30 min; organização 20 min; teste cruzado 50 min; análise 40 min; reteste 50 min; consolidação 30 min; fechamento 20 min.

## Entrega
Links dos tickets e evidências, análises/correções, retestes e resumo dos estados finais. Avaliar qualidade e rastreabilidade, não quantidade de bugs.

## Estado da implementação
Este documento registra o escopo e os bloqueios técnicos identificados; **não representa a funcionalidade concluída**. Próximos passos: auditar schema/RLS e hooks existentes, implementar na branch, testar e abrir PR.
