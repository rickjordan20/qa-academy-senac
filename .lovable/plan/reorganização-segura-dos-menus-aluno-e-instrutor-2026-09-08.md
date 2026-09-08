# Reorganização segura dos menus (Aluno e Instrutor)

## Escopo

Alterar apenas os arrays de configuração `groups` (dados de navegação) em dois arquivos:

- `src/routes/student/route.tsx`
- `src/routes/instructor/route.tsx`

Nenhuma rota, URL, página, componente, guard, autenticação ou banco de dados é alterado. O `AppShell.tsx` (menus suspensos no desktop, acordeão no mobile, menu do usuário com Perfil/Sair, indicador de rota ativa) permanece intacto — ele já renderiza qualquer estrutura de `NavGroup`.

## Área do Aluno — nova hierarquia

```text
Início                    → /student/dashboard
Minha Jornada          ▾    Como serei avaliado · Minha Jornada · Módulos QA · Minhas Missões · Atividades Assíncronas
Projeto Café Central   ▾    Missões da Turma · Café Central · Inventário da Aplicação
Meu Trabalho           ▾    Meus Registros · Minhas Evidências · Meu Portfólio
Meu Desempenho         ▾    Meu Progresso · Minha Avaliação · Ranking
[Nome do aluno]        ▾    Perfil (/student/profile) · Sair
```

Mudança real: **Inventário da Aplicação** sai de "Meu Aprendizado" e entra em "Projeto Café Central" (rota `/student/inventory` inalterada). Renomeações de grupo: "Meu Aprendizado" → "Minha Jornada", "Café Central" → "Projeto Café Central", "Meus Registros" → "Meu Trabalho".

## Área do Instrutor — nova hierarquia

```text
Dashboard                 → /instructor/dashboard
Planejamento e Ensino  ▾    Missões · Atividades Assíncronas · Módulos QA · Gamificação · Badges
Projeto Café Central   ▾    Café Central · Inventário · Funcionalidades
Avaliação              ▾    Central de Avaliação · Matriz de Avaliação · Dossiê do Aluno · Avaliação Final · Recuperação
Resultados e Relatórios ▾   Portfólios · Relatórios · Entregas por Missão · Fechamento da UC10
Gestão                 ▾    Turmas · Alunos · Grupos
[Nome do instrutor]    ▾    Perfil (/instructor/profile) · Sair
```

Mudanças reais: **Módulos QA** sai de "Aplicações & QA" para "Planejamento e Ensino"; **Inventário** e **Funcionalidades** vão para "Projeto Café Central"; grupo "Relatórios" vira "Resultados e Relatórios" e passa a incluir Portfólios; Recuperação sai do grupo de relatórios para "Avaliação". Todas as rotas permanecem idênticas.

## Validação

1. `bunx tsgo --noEmit -p tsconfig.json` — confirma que todos os `to` apontam para rotas existentes (erro `FileRoutesByPath` apareceria se alguma rota fosse perdida).
2. Comparar lista de rotas antes/depois: as 22 rotas do instrutor e as 15 do aluno continuam presentes nos arrays (nenhuma página fica inacessível).
3. Verificar no preview: desktop abre/fecha dropdowns, mobile abre/fecha acordeões, rota ativa destacada, Perfil no menu do usuário, login redireciona via `/dashboard`.

## Arquivos alterados

- `src/routes/student/route.tsx` — apenas arrays `groups` (labels, ordem, realocação do Inventário).
- `src/routes/instructor/route.tsx` — apenas arrays `groups` (labels, ordem, realocações).

## Não será tocado

Rotas públicas (`/`, `/login`, `/reset-password`, `/auth/callback`, `/dashboard`), `AppShell.tsx`, `RoleGate.tsx`, páginas, RLS, banco, XP, avaliações.
