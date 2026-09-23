# CRUD completo dos registros de QA

## 1. Auditoria — o que existe hoje

| Registro | Onde é criado | Criar | Ver | Editar | Excluir |
|---|---|---|---|---|---|
| Caso de teste (qa_test_cases) | Módulo QA | sim | sim | **sim** | sim (só autor) |
| Bug (qa_bugs) | Módulo QA / teste cruzado | sim | sim | **sim** | sim (só autor) |
| Evidência (qa_evidences) | Módulo QA | sim | sim | **não** | sim (só autor) |
| Reteste (qa_retests) | Módulo QA / RPC cruzada | sim | sim | não (histórico) | só autor |
| Registros de missão (caso, execução, bug, evidência, checklist, reflexão…) em builder_mission_entries | Dentro da missão | sim | sim | **não** | sim (só autor) |
| Contribuição do Café Central (cafe_contributions) | Missão / painel do grupo | sim | sim | **não** | sim (só autor) |
| Tarefa do Café Central (cafe_tasks) | Missão | sim | sim | sim | sim |
| Inventário (módulos e funcionalidades) | Módulo QA | sim | sim | sim | sim |

## 2. Regras atuais de autoria e grupo

- `qa_test_cases` / `qa_bugs`: edição via `qa_can_edit` = autor **ou** quem gerencia o grupo (QA Líder / instrutor). Integrante comum do grupo **não** edita.
- `qa_evidences`, `cafe_contributions`: edição só do autor.
- `builder_mission_entries`: edição só do autor e enquanto a missão estiver publicada; instrutor edita tudo.
- Exclusões: quase sempre restritas ao autor.
- Todos os registros já guardam autor (`author_id` / `student_id`), grupo (`group_id`), `created_at` e `updated_at` com gatilho automático.

## 3. Lacunas

1. Integrante do grupo não consegue editar registros do próprio grupo (só o autor ou o líder).
2. Evidências do módulo QA não têm edição — nem no banco nem na tela.
3. Registros criados dentro da missão não têm edição nenhuma: só criar e excluir.
4. Contribuições do Café Central não têm edição.
5. Exclusão mais restrita que a edição, gerando comportamento inconsistente.

## 4. Plano

### Banco (uma migração, sem apagar nem alterar dados)
- Ampliar a função compartilhada de autorização para: autor **ou** integrante do mesmo grupo **ou** líder/instrutor. Isso já corrige casos de teste e bugs de uma vez, sem policies novas.
- Criar função equivalente para registros de missão (autor, integrante do grupo da entrega, instrutor) e aplicar nas regras de edição e exclusão de `builder_mission_entries`, mantendo a trava de "missão publicada".
- Alinhar edição/exclusão de evidências e contribuições à mesma regra.
- Regras que protegem o teste cruzado, o histórico de retestes e os campos de avaliação continuam como estão.
- Registros antigos sem autor ou sem grupo continuam visíveis e não recebem dono novo: quem não se encaixa na regra simplesmente não edita.

### Código
- Novo hook de atualização de evidência e de contribuição, reaproveitando o padrão já usado por casos e bugs.
- Novo hook de atualização de registro de missão; o formulário de registro do MissionPlayer ganha modo de edição (abre preenchido, salva no mesmo registro, mantém id, vínculos, autor e missão/seção).
- Botão **Editar** ao lado de **Excluir** nos pontos que hoje só têm excluir; confirmação antes de excluir; aviso "Registro atualizado com sucesso".
- Nada de estrutura paralela: missão e módulo QA continuam lendo o mesmo registro, então a edição aparece nas duas telas.

### Fora do escopo
- Nenhuma alteração em XP, avaliação, A/PA/NA, relatórios ou no fluxo de teste cruzado.
- Retestes continuam imutáveis (registro histórico).

## 5. Validação
Cenários 1 a 10 do pedido, testados como aluno autor, aluno do mesmo grupo, aluno de outro grupo e instrutor, incluindo tentativa direta no banco.
