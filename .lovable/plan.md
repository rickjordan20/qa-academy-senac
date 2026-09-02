# Melhoria do sistema de Badges

Reutiliza `gam_badges`, `gam_student_badges` e os critérios já existentes em `gamification.ts`. Nenhum badge é apagado, duplicado ou renomeado, e nenhum critério automático muda.

## 1. Banco de dados (migração)

- Adicionar a `gam_badges` as colunas `enabled boolean not null default true` e `updated_at`.
- Permitir que o instrutor edite o catálogo: nova política de atualização em `gam_badges` restrita a instrutores (nome, descrição, critério, posição, status). Criação/exclusão continuam bloqueadas para preservar os 10 badges.
- `gam_student_badges`: remover a permissão de inserção direta pelo aluno. O aluno continua lendo os próprios badges; o instrutor continua vendo os badges dos alunos das suas turmas.
- Concessão passa a ocorrer por função segura no servidor, que só grava badges cujo critério foi realmente atingido e ignora duplicados.

## 2. Concessão segura (server-side)

- Criar `src/lib/gamification.functions.ts` com um server function autenticado (`requireSupabaseAuth`).
- Mover o cálculo de estatísticas (`collect`) e `earnedBadges` para um módulo compartilhado, de modo que a mesma regra rode no servidor com o cliente autenticado do usuário (RLS aplicada) — critérios idênticos aos atuais.
- Fluxo do server function: identifica o usuário pela sessão → recalcula estatísticas reais → aplica `earnedBadges()` → concede apenas os badges faltantes → devolve os badges concedidos. `awarded_at` é preservado para badges já existentes.
- `useSyncGamification()` deixa de inserir badges no client e passa a chamar esse server function; a sincronização de XP permanece como está.

## 3. Painel do instrutor — Badges

Nova rota `/instructor/badges`, dentro do grupo "Ensino" do menu do instrutor.

Topo com três indicadores: Badges cadastrados, Conquistas realizadas, Alunos com badges.

Lista em cards (mesmo visual do aluno) com dados administrativos: nome, descrição, critério, código, status (ativo/inativo), quantidade de alunos que conquistaram e quantidade de missões relacionadas (`builder_missions.badge_code`).

Ações por badge:
- editar nome, descrição, texto do critério e posição (edição inline);
- ativar/desativar;
- ver a lista de alunos que conquistaram (nome + data);
- ver as missões relacionadas.

Aviso fixo na tela: o texto do critério é apenas descritivo — a regra automática de concessão está definida no código e não muda ao editar esse texto.

## 4. Badge nas missões

- Em `src/routes/instructor/missions.$missionId.tsx`, o input de texto de `badge_code` vira um select carregado de `gam_badges`, rotulado "Badge relacionado (opcional)", com a opção "Nenhum badge relacionado" e itens no formato `Nome — Critério`. Salva o `code` real.
- Na visão do aluno da missão, quando houver `badge_code`, exibir um bloco "🏅 Badge relacionado: Nome" e "Critério: ...", com nota de que concluir a missão não concede o badge automaticamente.

## 5. Visão do aluno

O painel "Badges (X/10)" com conquistados e pendentes permanece igual; muda apenas a forma como a conquista é gravada (server-side).

## 6. Validação

Typecheck e verificação no preview: catálogo completo para o instrutor, edição descritiva funcionando, lista de alunos por badge, select de badge na missão (salvando com e sem badge), badges já conquistados preservados, sem duplicação, insert direto pelo aluno bloqueado e XP/avaliação inalterados.

## Notas técnicas

- Sem alteração em rotas existentes, XP, avaliação (A/PA/NA/D/ND) ou dados históricos.
- Migração é aditiva; nenhum `DELETE` em `gam_badges` ou `gam_student_badges`.
- A gravação de badges usa acesso privilegiado apenas dentro do handler, após validar sessão e recalcular critérios.
