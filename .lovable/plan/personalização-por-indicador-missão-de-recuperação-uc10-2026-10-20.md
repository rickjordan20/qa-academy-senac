# Personalização por indicador – Missão de Recuperação UC10

Missão alvo: `3577c41a-…` (rascunho, XP base 0, sem atribuições). Nada é publicado ou alterado em dados reais nesta etapa.

## O que foi verificado
- A missão tem 7 blocos, cada um com `indicator_codes` próprio (I1…I5, I6 em dois blocos: Caso de teste + Evidência). O vínculo bloco→indicador já existe.
- O player do aluno filtra apenas por `visible` (fixo para todos). Não há filtro por aluno.
- A matriz oficial é `indicator_evaluations.concept` (A/PA/NA/nulo) por turma × aluno × indicador; homologações vigentes ficam em `indicator_homologations`.
- `consolidate_evaluation` registra voto para **todo** indicador presente em `indicator_finals` ou nas diferenciações individuais. **Risco real:** se o instrutor preencher I3 numa recuperação de aluno que só tinha I2 pendente, I3 recebe um voto novo e pode mudar.

## Regra de exibição (proposta)
Para cada aluno, a menção efetiva por indicador = homologação vigente, senão matriz:
- A → bloco oculto
- PA ou NA → bloco exibido
- sem menção → bloco oculto e aluno sinalizado para "revisão docente" (o instrutor decide incluir manualmente)
- Blocos com o mesmo indicador (I6) aparecem juntos, na ordem original.

**Congelamento:** ao iniciar a tentativa, o conjunto de indicadores é gravado na própria execução (`run.answers` meta ou nova coluna `target_indicator_codes`). Mudanças de menção durante a tentativa não somem com blocos já respondidos; o instrutor vê um aviso "menção mudou desde o início".

## Solução mínima
1. **Configuração na missão:** flag `personalize_by_pending_indicators` (opção no cadastro, padrão desligado → missões atuais inalteradas).
2. **Função no banco** `recovery_target_indicators(mission, student)` (security definer, só aluno próprio ou instrutor da turma) que devolve códigos PA/NA + lista "sem menção".
3. **Congelamento na tentativa:** coluna nullable `target_indicator_codes text[]` em `builder_mission_runs`, preenchida por gatilho na criação da execução; aluno não pode alterá-la (guarda de colunas existente).
4. **Player do aluno:** filtra blocos por `target_indicator_codes` além de `visible`.
5. **Segurança no envio:** gatilho rejeita respostas/entradas de blocos de indicadores fora do conjunto congelado.
6. **Correção/consolidação:** na ficha de avaliação só aparecem indicadores do conjunto; `consolidate_evaluation` passa a ignorar códigos fora de `target_indicator_codes` quando ele existir (retrocompatível: nulo = comportamento atual).
7. **Prévia do instrutor:** na página da missão, tabela aluno × I1–I6 com "Exibido / Oculto (A) / Revisão (sem menção)" e quais blocos cada um verá.
8. **"Ver como aluno"** usa a mesma função, respeitando o modo somente leitura.

XP permanece 0; histórico continua via fluxo oficial (`eval_history`, `builder_run_evaluations` versionado).

## Testes
- Unitários: regra A/PA/NA/nulo, homologação prevalecendo, agrupamento I6.
- Banco (transação com rollback): aluno não vê/grava bloco de indicador A; aluno não altera `target_indicator_codes`; consolidação não toca indicador fora do conjunto; missão sem flag inalterada.
- Navegador: prévia do instrutor e "Ver como aluno" com dois alunos de perfis diferentes, sem enviar avaliação real.

## Viabilidade, riscos e esforço
- Viável com 1 migração aditiva (1 coluna nullable em missões ou chave em `sections` meta, 1 em execuções, 1 função, ajuste de 1 gatilho e da consolidação) e ajustes em player, ficha e página da missão. Esforço: médio (~1 ciclo de implementação + testes).
- Riscos: alterar `consolidate_evaluation` (mitigado por condição só quando o conjunto existir + testes de regressão); missão grupal não se aplica — deve ser individual (já é).
- Limite pedagógico: pela moda, um único voto A de recuperação pode não superar NA/PA anteriores; e reduções/empates continuam pendentes.

## Perguntas necessárias
1. Recuperação deve contar como **mais um voto** na moda (regra atual) ou o resultado da recuperação deve **prevalecer** para o indicador (exigiria homologação docente justificada, já existente)?
2. Aluno "sem menção" em um indicador: ocultar e alertar (proposto) ou exibir o bloco?
3. Indicadores em "empate/redução de A pendente": usar a menção atual da matriz (proposto) ou exibir sempre?
4. Congelar o conjunto no início da tentativa (proposto) ou recalcular até o envio?
