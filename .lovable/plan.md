# Feedback por bloco na avaliação das missões

## Objetivo
Mostrar ao aluno, na página de detalhes da própria entrega, o resultado A/PA/NA e o comentário que o instrutor já registrou para cada bloco avaliado.

## Implementação
- Reutilizar `builder_run_evaluations.block_results`; nenhuma tabela ou migração nova será criada.
- Carregar o histórico já disponível por `useRunEvaluations(runId)` e selecionar somente a avaliação vigente (`is_current = true`).
- Em cada bloco avaliado, apresentar nesta ordem: nome do bloco, resultados A/PA/NA, feedback específico quando preenchido e conteúdo entregue pelo aluno.
- Dar maior destaque visual aos resultados PA e NA; manter A com apresentação discreta.
- Não renderizar resultado nem caixa de feedback para bloco ainda não avaliado, nem caixa vazia quando não houver comentário.
- Manter o resumo final atual com resultado geral, XP e feedback geral.

## Segurança e escopo
- Preservar a política atual que limita a leitura às próprias entregas ou às entregas do grupo do aluno.
- Interface exclusivamente de leitura para o aluno.
- Não alterar cálculo, indicadores, XP, avaliação, reavaliação ou regras A/PA/NA.

## Validação
- Cobrir avaliação vigente, bloco com PA/NA e comentário, bloco sem comentário e bloco sem avaliação.
- Confirmar que avaliações antigas não aparecem como vigentes e que o feedback geral permanece no final.
