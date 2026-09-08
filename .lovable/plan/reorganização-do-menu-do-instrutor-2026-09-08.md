# Reorganização do menu do Instrutor

## Estado atual (levantamento)

O menu do instrutor vive em `src/routes/instructor/route.tsx`, no array `groups` (tipo `NavGroup`), renderizado pelo `AppShell.tsx`: dropdowns no desktop, acordeão no mobile, Perfil/Sair no menu do usuário. Estrutura atual:

```text
Dashboard                 → /instructor/dashboard
Planejamento e Ensino  ▾    Missões · Atividades Assíncronas · Módulos QA · Gamificação · Badges
Projeto Café Central   ▾    Café Central · Inventário · Funcionalidades
Avaliação              ▾    Central de Avaliação · Matriz · Dossiê · Avaliação Final · Recuperação
Resultados e Relatórios ▾   Portfólios · Relatórios · Entregas por Missão · Fechamento da UC10
Gestão                 ▾    Turmas · Alunos · Grupos
```

Pontos fracos identificados: Gamificação e Badges estão misturados com conteúdo de ensino; Módulos QA (conteúdo técnico) está separado de Inventário/Funcionalidades, que também são QA; "Planejamento e Ensino" ficou sobrecarregado (5 itens de naturezas diferentes).

## Proposta de nova hierarquia

```text
Dashboard               → /instructor/dashboard
Ensino               ▾    Missões · Atividades Assíncronas · Café Central
Projeto e QA         ▾    Módulos QA · Inventário · Funcionalidades
Avaliação            ▾    Central de Avaliação · Matriz de Avaliação · Dossiê do Aluno · Avaliação Final · Recuperação
Resultados           ▾    Portfólios · Relatórios · Entregas por Missão · Fechamento da UC10
Engajamento          ▾    Gamificação · Badges
Gestão               ▾    Turmas · Alunos · Grupos
[Usuário]            ▾    Perfil (/instructor/profile) · Sair
```

Lógica da reorganização:

- **Ensino**: apenas o que o instrutor cria e conduz em aula (missões, assíncronas, Café Central).
- **Projeto e QA**: tudo que descreve a aplicação sob teste (módulos, inventário, funcionalidades) reunido num só lugar.
- **Engajamento**: Gamificação e Badges ganham grupo próprio, fora do Ensino.
- **Avaliação** e **Resultados** permanecem como estão (já bem agrupados); "Resultados e Relatórios" encurta para "Resultados".
- Ícones (todos já existem no lucide-react): Ensino `BookOpen`, Projeto e QA `TestTube2`, Avaliação `ClipboardCheck`, Resultados `BarChart3`, Engajamento `Trophy`, Gestão `Settings`.

## Implementação

Único arquivo alterado: `src/routes/instructor/route.tsx` — somente o array `groups` e a linha de import de ícones. Nenhuma rota, página, guard ou banco é tocado.

## Validação

1. `bunx tsgo --noEmit -p tsconfig.json` — garante que todos os `to` apontam para rotas existentes.
2. Conferir que as 22 rotas do instrutor continuam presentes no menu (nenhuma órfã).
3. Curl nas rotas principais confirmando HTTP 200.
