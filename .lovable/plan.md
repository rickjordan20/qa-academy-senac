# Plano — Página "Como você será avaliado?" com ciência do aluno

## Objetivo
Dar visibilidade permanente às regras de avaliação da UC10 (infográfico enviado) na área do aluno e registrar a ciência de que cada aluno leu e compreendeu.

## O que será construído

### 1. Nova página do aluno: `/student/how-evaluated` ("Como serei avaliado")
- Reproduz o conteúdo do infográfico em HTML/Tailwind nativo (não apenas a imagem), mantendo os mesmos 6 blocos:
  1. Você realiza a missão
  2. O instrutor avalia sua entrega (conceitos A / PA / NA)
  3. Como é calculada a nota (qualquer NA → NA; tudo A → A; demais casos → PA), com o exemplo de blocos
  4. Missões em grupo (mesma nota, participação individual registrada; atribuição ≠ execução)
  5. Avaliação Final e Recuperação (D / ND; resultado final manual do instrutor)
  6. XP e badges (níveis QA Rookie → QA Master; XP não influencia a nota)
  - Mais os blocos finais: "O que você pode acompanhar", objetivo e resumo.
- O infográfico original também será exibido como imagem (asset via lovable-assets), com opção de ampliar.
- Layout responsivo, seguindo os tokens de design atuais.

### 2. Registro de ciência (banco de dados)
- Nova tabela `evaluation_acknowledgments` (student_id, acknowledged_at, versão do conteúdo) com GRANTs, RLS: aluno lê/insere o próprio registro; instrutor lê todos (para saber quem deu ciência).
- Botão na página: **"Li e compreendi como serei avaliado"** — grava data/hora; depois de confirmado, mostra "Ciência registrada em DD/MM/AAAA" e desabilita o botão.

### 3. Visibilidade
- **Banner no Início do aluno** (`/student/dashboard`): se ainda não deu ciência, banner em destaque "Entenda como você será avaliado" com botão para a página; some após o registro (vira link discreto).
- **Item no menu do aluno** em "Meu Aprendizado": "Como serei avaliado".

### 4. Visão do instrutor (simples)
- Na ficha 360° do aluno (`/instructor/students/$studentId`), indicador "Ciência da avaliação: registrada em …" ou "pendente".

## Arquivos principais
- Nova migração SQL (tabela + grants + RLS)
- `src/routes/student/how-evaluated.tsx` (novo)
- `src/lib/assessment.ts` (hooks `useMyEvaluationAck`, `useAcknowledgeEvaluation`)
- `src/routes/student/dashboard.tsx` (banner)
- `src/components/AppShell.tsx` (item de menu)
- `src/routes/instructor/students.$studentId.tsx` (indicador)
- `src/assets/` (asset do infográfico)

## Não será alterado
Fluxo de avaliação, XP, badges, missões, RLS existente, conteúdo pedagógico das regras (a página apenas comunica as regras já implementadas).

## Verificação
- Typecheck; abrir a página no preview; confirmar que o banner aparece antes da ciência e some depois; confirmar botão registra e fica desabilitado.
