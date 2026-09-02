import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuleFeatureSelect, featureTrace } from "@/components/qa/ModuleFeatureSelect";
import { NativeSelect } from "@/components/qa/TestCasesPanel";
import { useFeatures, useModules } from "@/lib/inventory";
import {
  CONTRIBUTION_KINDS,
  contributionKindLabel,
  taskStatusLabel,
  useCreateMissionContribution,
  useCreateMissionTask,
  useDeleteMissionContribution,
  useDeleteMissionTask,
  useMissionContributions,
  useMissionTasks,
  useUpdateMissionTask,
  type CafeGroup,
  type MissionTask,
  type TaskStatus,
} from "@/lib/cafe";

/** Colunas simples do quadro: A fazer · Em andamento · Concluída. */
const COLUMNS: { key: TaskStatus; label: string; accepts: string[] }[] = [
  { key: "todo", label: "A fazer", accepts: ["todo"] },
  { key: "doing", label: "Em andamento", accepts: ["doing", "review", "blocked"] },
  { key: "done", label: "Concluída", accepts: ["done"] },
];

const BOARD_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "A fazer" },
  { value: "doing", label: "Em andamento" },
  { value: "done", label: "Concluída" },
];

const emptyTask = {
  title: "",
  description: "",
  module_id: "",
  feature_id: "",
  assignee_id: "",
  status: "todo" as TaskStatus,
};

const emptyContribution = {
  task_id: "",
  kind: "execucao",
  title: "",
  description: "",
  link: "",
  reflection: "",
};

function memberLabel(group: CafeGroup, id: string | null) {
  const m = group.members.find((x) => x.student_id === id);
  if (!m) return { name: id ? "Integrante" : "Sem responsável", role: "" };
  return { name: m.full_name, role: m.is_qa_lead ? "QA Líder" : m.member_function || "Integrante" };
}

export function MissionTaskBoard({
  missionId,
  runId,
  group,
  userId,
}: {
  missionId: string;
  runId: string;
  group: CafeGroup;
  userId: string | null;
}) {
  const isLead = group.qa_lead_id === userId;
  const { data: tasks } = useMissionTasks(runId);
  const { data: contributions } = useMissionContributions(runId);
  const { data: modules } = useModules("cafe_central", group.id);
  const { data: features } = useFeatures("cafe_central", group.id);

  const createTask = useCreateMissionTask(runId, missionId, group.id, userId);
  const updateTask = useUpdateMissionTask(runId);
  const deleteTask = useDeleteMissionTask(runId);

  const [form, setForm] = useState(emptyTask);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MissionTask | null>(null);

  const list = tasks ?? [];
  const myTasks = useMemo(() => list.filter((t) => t.assignee_id === userId), [list, userId]);
  const myRole = memberLabel(group, userId).role;

  const areaOf = (t: MissionTask) =>
    t.feature_id ? featureTrace(modules, features, t.feature_id) : t.area || "—";

  async function submitTask() {
    if (!form.title.trim()) {
      toast.error("Informe o título da tarefa.");
      return;
    }
    const area = form.feature_id ? featureTrace(modules, features, form.feature_id) : "";
    try {
      if (editing) {
        await updateTask.mutateAsync({
          id: editing.id,
          patch: {
            title: form.title.trim(),
            description: form.description.trim(),
            area,
            module_id: form.module_id || null,
            feature_id: form.feature_id || null,
            assignee_id: form.assignee_id || null,
            status: form.status,
          },
        });
        toast.success("Tarefa atualizada.");
      } else {
        await createTask.mutateAsync({
          title: form.title.trim(),
          description: form.description.trim(),
          area,
          module_id: form.module_id || null,
          feature_id: form.feature_id || null,
          assignee_id: form.assignee_id || null,
          status: form.status,
        });
        toast.success("Tarefa distribuída para o grupo.");
      }
      setForm(emptyTask);
      setEditing(null);
      setOpen(false);
    } catch (err) {
      console.error("[café] falha ao salvar tarefa:", err);
      toast.error("Não foi possível salvar a tarefa. Apenas o QA Líder pode distribuir tarefas.");
    }
  }

  function startEdit(t: MissionTask) {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description ?? "",
      module_id: t.module_id ?? "",
      feature_id: t.feature_id ?? "",
      assignee_id: t.assignee_id ?? "",
      status: (COLUMNS.find((c) => c.accepts.includes(t.status))?.key ?? "todo") as TaskStatus,
    });
    setOpen(true);
  }

  const memberOptions = [
    { value: "", label: "Sem responsável" },
    ...group.members.map((m) => ({
      value: m.student_id,
      label: `${m.full_name} — ${m.is_qa_lead ? "QA Líder" : m.member_function || "Integrante"}`,
    })),
  ];

  function TaskCard({ t }: { t: MissionTask }) {
    const who = memberLabel(group, t.assignee_id);
    const mine = t.assignee_id === userId;
    return (
      <div
        className={`rounded-lg border p-3 text-sm ${mine ? "border-accent bg-accent/5" : "border-border bg-background"}`}
      >
        <p className="font-medium">{t.title}</p>
        {t.description ? <p className="mt-1 text-xs text-muted-foreground">{t.description}</p> : null}
        <dl className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          <div>
            <span className="font-semibold">Responsável: </span>
            {who.name}
            {mine ? " (você)" : ""}
          </div>
          <div>
            <span className="font-semibold">Função: </span>
            {who.role || "—"}
          </div>
          <div>
            <span className="font-semibold">Área: </span>
            {areaOf(t)}
          </div>
          <div>
            <span className="font-semibold">Status: </span>
            {taskStatusLabel(t.status)}
          </div>
        </dl>
        {isLead || mine ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <NativeSelect
              id={`st-${t.id}`}
              value={COLUMNS.find((c) => c.accepts.includes(t.status))?.key ?? "todo"}
              onChange={(v) => updateTask.mutate({ id: t.id, patch: { status: v as TaskStatus } })}
              options={BOARD_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
            {isLead ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => startEdit(t)}>
                  Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteTask.mutate(t.id)}>
                  Excluir
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">🧩 Quadro de Tarefas da Equipe</CardTitle>
          <span className="text-xs text-muted-foreground">
            Grupo {group.name} · Sua função: {myRole || "Integrante"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          A distribuição de tarefas é feita pelo QA Líder dentro desta missão. Os demais integrantes
          acompanham o quadro e atualizam o andamento das próprias tarefas.
        </p>

        {isLead ? (
          open ? (
            <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="task-title">Título da tarefa</Label>
                  <Input
                    id="task-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Ex.: Testar formulário de login"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="task-desc">Descrição</Label>
                  <Textarea
                    id="task-desc"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="O que precisa ser investigado ou executado."
                  />
                </div>
                <ModuleFeatureSelect
                  project="cafe_central"
                  groupId={group.id}
                  moduleId={form.module_id}
                  featureId={form.feature_id}
                  idPrefix="task-area"
                  onChange={(v) => setForm((f) => ({ ...f, module_id: v.moduleId, feature_id: v.featureId }))}
                />
                <div>
                  <Label htmlFor="task-assignee">Responsável</Label>
                  <NativeSelect
                    id="task-assignee"
                    value={form.assignee_id}
                    onChange={(v) => setForm((f) => ({ ...f, assignee_id: v }))}
                    options={memberOptions}
                  />
                </div>
                <div>
                  <Label htmlFor="task-status">Status</Label>
                  <NativeSelect
                    id="task-status"
                    value={form.status}
                    onChange={(v) => setForm((f) => ({ ...f, status: v as TaskStatus }))}
                    options={BOARD_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                  />
                </div>
              </div>
              {(modules ?? []).length === 0 ? (
                <p className="text-xs text-warning">
                  Nenhuma tela cadastrada no Inventário do Café Central deste grupo. Cadastre as telas
                  e funcionalidades no Inventário para usá-las como área de investigação.
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button size="sm" onClick={submitTask} disabled={createTask.isPending || updateTask.isPending}>
                  {editing ? "Salvar alterações" : "Distribuir tarefa"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setOpen(false);
                    setEditing(null);
                    setForm(emptyTask);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" onClick={() => setOpen(true)}>
              + Nova tarefa
            </Button>
          )
        ) : null}

        <Tabs defaultValue="quadro">
          <TabsList>
            <TabsTrigger value="quadro">Quadro do grupo ({list.length})</TabsTrigger>
            <TabsTrigger value="minhas">Minhas tarefas ({myTasks.length})</TabsTrigger>
            <TabsTrigger value="contrib">Minhas contribuições</TabsTrigger>
          </TabsList>

          <TabsContent value="quadro" className="pt-4">
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma tarefa distribuída ainda nesta missão.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {COLUMNS.map((col) => (
                  <div key={col.key} className="space-y-2 rounded-lg bg-secondary/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {col.label} ({list.filter((t) => col.accepts.includes(t.status)).length})
                    </p>
                    {list
                      .filter((t) => col.accepts.includes(t.status))
                      .map((t) => (
                        <TaskCard key={t.id} t={t} />
                      ))}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="minhas" className="space-y-2 pt-4">
            {myTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Você ainda não tem tarefas atribuídas nesta missão.
              </p>
            ) : (
              myTasks.map((t) => <TaskCard key={t.id} t={t} />)
            )}
          </TabsContent>

          <TabsContent value="contrib" className="pt-4">
            <ContributionsPanel
              runId={runId}
              missionId={missionId}
              group={group}
              userId={userId}
              myTasks={myTasks}
              contributions={contributions ?? []}
              areaOf={areaOf}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ContributionsPanel({
  runId,
  missionId,
  group,
  userId,
  myTasks,
  contributions,
  areaOf,
}: {
  runId: string;
  missionId: string;
  group: CafeGroup;
  userId: string | null;
  myTasks: MissionTask[];
  contributions: { id: string; student_id: string; task_id: string | null; kind: string; title: string; description: string; link: string | null; reflection: string; created_at: string }[];
  areaOf: (t: MissionTask) => string;
}) {
  const create = useCreateMissionContribution(runId, missionId, group.id, userId);
  const remove = useDeleteMissionContribution(runId);
  const [form, setForm] = useState(emptyContribution);

  const mine = contributions.filter((c) => c.student_id === userId);
  const taskById = (id: string | null) => myTasks.find((t) => t.id === id) ?? null;
  const role = memberLabel(group, userId).role;

  async function submit() {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Informe o título e descreva o que você fez.");
      return;
    }
    if (form.link.trim() && !/^https:\/\//i.test(form.link.trim())) {
      toast.error("A evidência deve ser um link https válido.");
      return;
    }
    try {
      await create.mutateAsync({
        task_id: form.task_id || null,
        kind: form.kind,
        title: form.title.trim(),
        description: form.description.trim(),
        link: form.link.trim() || null,
        reflection: form.reflection.trim(),
      });
      setForm(emptyContribution);
      toast.success("Contribuição registrada com sua autoria.");
    } catch (err) {
      console.error("[café] falha ao registrar contribuição:", err);
      toast.error("Não foi possível registrar a contribuição.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
        <p className="text-xs text-muted-foreground">
          Registre aqui o que você <span className="font-semibold">já executou</span>. A distribuição de
          tarefas é feita pelo QA Líder no quadro acima.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="c-task">Tarefa relacionada</Label>
            <NativeSelect
              id="c-task"
              value={form.task_id}
              onChange={(v) => setForm((f) => ({ ...f, task_id: v }))}
              options={[
                { value: "", label: myTasks.length ? "Sem tarefa vinculada" : "Nenhuma tarefa atribuída a você" },
                ...myTasks.map((t) => ({ value: t.id, label: `${t.title} — ${areaOf(t)}` })),
              ]}
            />
          </div>
          <div>
            <Label htmlFor="c-kind">Tipo de contribuição</Label>
            <NativeSelect
              id="c-kind"
              value={form.kind}
              onChange={(v) => setForm((f) => ({ ...f, kind: v }))}
              options={CONTRIBUTION_KINDS.map((k) => ({ value: k.value, label: k.label }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="c-title">Título</Label>
            <Input
              id="c-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ex.: Execução dos testes do login"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="c-desc">O que você fez</Label>
            <Textarea
              id="c-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="c-link">Evidência (link https)</Label>
            <Input
              id="c-link"
              value={form.link}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="c-reflection">Reflexão</Label>
            <Textarea
              id="c-reflection"
              rows={2}
              value={form.reflection}
              onChange={(e) => setForm((f) => ({ ...f, reflection: e.target.value }))}
              placeholder="O principal problema encontrado foi..."
            />
          </div>
        </div>
        <Button size="sm" onClick={submit} disabled={create.isPending}>
          Registrar contribuição
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Histórico das minhas contribuições ({mine.length})</p>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma contribuição registrada ainda.</p>
        ) : (
          mine.map((c) => {
            const t = taskById(c.task_id);
            return (
              <div key={c.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{c.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {contributionKindLabel(c.kind)} · {new Date(c.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Grupo {group.name} · Função: {role || "Integrante"} · Tarefa: {t ? t.title : "—"}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{c.description}</p>
                {c.reflection ? (
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    <span className="font-semibold">Reflexão: </span>
                    {c.reflection}
                  </p>
                ) : null}
                {c.link ? (
                  <a
                    href={c.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-accent underline"
                  >
                    🔗 Abrir evidência
                  </a>
                ) : null}
                <div className="mt-2">
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(c.id)}>
                    Excluir
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
