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
import { blockDef, type Section } from "@/lib/mission-builder";
import {
  CONTRIBUTION_KINDS,
  contributionKindLabel,
  taskStatusLabel,
  useCreateMissionContribution,
  useCreateMissionTask,
  useDeleteMissionContribution,
  useUpdateMissionContribution,
  useDeleteMissionTask,
  useMissionContributions,
  useMissionTaskCollaborators,
  useMissionTasks,
  useSetMissionTaskCollaborators,
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
  section_id: "",
  assignee_id: "",
  collaborators: [] as string[],
  status: "todo" as TaskStatus,
};

const emptyContribution = {
  task_id: "",
  section_id: "",
  kind: "execucao",
  title: "",
  description: "",
  link: "",
  reflection: "",
};

export function memberLabel(group: CafeGroup, id: string | null) {
  const m = group.members.find((x) => x.student_id === id);
  if (!m) return { name: id ? "Integrante" : "Sem responsável", role: "" };
  return { name: m.full_name, role: m.is_qa_lead ? "QA Líder" : m.member_function || "Integrante" };
}

export function memberOptionsOf(group: CafeGroup) {
  return [
    { value: "", label: "Sem responsável" },
    ...group.members.map((m) => ({
      value: m.student_id,
      label: `${m.full_name} — ${m.is_qa_lead ? "QA Líder" : m.member_function || "Integrante"}`,
    })),
  ];
}

/* ------------------------------------------------------------------ */
/* Atribuição discreta dentro de cada bloco da missão                  */
/* ------------------------------------------------------------------ */

export function SectionAssign({
  section,
  runId,
  missionId,
  group,
  userId,
}: {
  section: Section;
  runId: string;
  missionId: string;
  group: CafeGroup;
  userId: string | null;
}) {
  const isLead = group.qa_lead_id === userId;
  const { data: tasks } = useMissionTasks(runId);
  const create = useCreateMissionTask(runId, missionId, group.id, userId);
  const update = useUpdateMissionTask(runId);
  const [open, setOpen] = useState(false);

  const task = (tasks ?? []).find((t) => t.section_id === section.id) ?? null;
  const who = memberLabel(group, task?.assignee_id ?? null);

  async function assign(studentId: string) {
    try {
      if (task) {
        await update.mutateAsync({ id: task.id, patch: { assignee_id: studentId || null } });
      } else {
        await create.mutateAsync({
          title: section.title,
          description: section.description ?? "",
          area: "",
          module_id: null,
          feature_id: null,
          section_id: section.id,
          assignee_id: studentId || null,
          status: "todo",
        });
      }
      setOpen(false);
      toast.success("Responsável definido para este bloco.");
    } catch (err) {
      console.error("[café] falha ao atribuir bloco:", err);
      toast.error("Não foi possível atribuir. Apenas o QA Líder distribui tarefas.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">Responsável:</span>
      <span>{task?.assignee_id ? `${who.name} — ${who.role}` : "não atribuído"}</span>
      {task ? <span>· {taskStatusLabel(task.status)}</span> : null}
      {isLead ? (
        open ? (
          <NativeSelect
            id={`assign-${section.id}`}
            value={task?.assignee_id ?? ""}
            onChange={(v) => void assign(v)}
            options={memberOptionsOf(group)}
          />
        ) : (
          <button
            type="button"
            className="text-accent underline"
            onClick={() => setOpen(true)}
          >
            Atribuir responsável
          </button>
        )
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quadro completo                                                     */
/* ------------------------------------------------------------------ */

export function MissionTaskBoard({
  missionId,
  runId,
  group,
  userId,
  sections = [],
}: {
  missionId: string;
  runId: string;
  group: CafeGroup;
  userId: string | null;
  sections?: Section[];
}) {
  const isLead = group.qa_lead_id === userId;
  const { data: tasks } = useMissionTasks(runId);
  const { data: contributions } = useMissionContributions(runId);
  const { data: modules } = useModules("cafe_central", group.id);
  const { data: features } = useFeatures("cafe_central", group.id);

  const taskIds = useMemo(() => (tasks ?? []).map((t) => t.id), [tasks]);
  const { data: collaborators } = useMissionTaskCollaborators(taskIds);
  const setCollaborators = useSetMissionTaskCollaborators(group.id, userId);

  const createTask = useCreateMissionTask(runId, missionId, group.id, userId);
  const updateTask = useUpdateMissionTask(runId);
  const deleteTask = useDeleteMissionTask(runId);

  const [form, setForm] = useState(emptyTask);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MissionTask | null>(null);

  const list = tasks ?? [];
  const collabOf = (taskId: string) =>
    (collaborators ?? []).filter((c) => c.task_id === taskId).map((c) => c.student_id);
  const isResponsible = (t: MissionTask) =>
    t.assignee_id === userId ||
    (collaborators ?? []).some((c) => c.task_id === t.id && c.student_id === userId);
  const myTasks = useMemo(
    () =>
      list.filter(
        (t) =>
          t.assignee_id === userId ||
          (collaborators ?? []).some((c) => c.task_id === t.id && c.student_id === userId),
      ),
    [list, userId, collaborators],
  );
  const myRole = memberLabel(group, userId).role;

  const sectionLabel = (id: string | null) => {
    if (!id) return "";
    const s = sections.find((x) => x.id === id);
    return s ? `${blockDef(s.kind).icon} ${s.title}` : "";
  };

  const areaOf = (t: MissionTask) =>
    t.feature_id ? featureTrace(modules, features, t.feature_id) : t.area || "—";

  async function submitTask() {
    if (!form.title.trim()) {
      toast.error("Informe o título da tarefa.");
      return;
    }
    const area = form.feature_id ? featureTrace(modules, features, form.feature_id) : "";
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      area,
      module_id: form.module_id || null,
      feature_id: form.feature_id || null,
      section_id: form.section_id || null,
      assignee_id: form.assignee_id || null,
      status: form.status,
    };
    try {
      const extra = form.collaborators.filter((id) => id && id !== form.assignee_id);
      if (editing) {
        await updateTask.mutateAsync({ id: editing.id, patch: payload });
        await setCollaborators.mutateAsync({ taskId: editing.id, studentIds: extra });
        toast.success("Tarefa atualizada.");
      } else {
        const newId = await createTask.mutateAsync(payload);
        if (newId) await setCollaborators.mutateAsync({ taskId: newId, studentIds: extra });
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
      section_id: t.section_id ?? "",
      assignee_id: t.assignee_id ?? "",
      collaborators: collabOf(t.id),
      status: (COLUMNS.find((c) => c.accepts.includes(t.status))?.key ?? "todo") as TaskStatus,
    });
    setOpen(true);
  }

  const memberOptions = memberOptionsOf(group);

  function TaskCard({ t }: { t: MissionTask }) {
    const who = memberLabel(group, t.assignee_id);
    const extra = collabOf(t.id);
    const mine = isResponsible(t);
    const block = sectionLabel(t.section_id);
    return (
      <div
        className={`rounded-xl border p-4 text-sm shadow-sm transition-colors ${mine ? "border-accent bg-accent/5" : "border-border bg-background"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-medium leading-snug">{t.title}</p>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
            {taskStatusLabel(t.status)}
          </span>
        </div>
        {block ? <p className="mt-1 text-xs font-medium text-primary">Bloco: {block}</p> : null}
        {t.description ? (
          <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-semibold">Responsável: </span>
          {who.name}
          {mine ? " (você)" : ""}
          {who.role ? ` — ${who.role}` : ""}
        </p>
        {extra.length ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold">Também responsáveis: </span>
            {extra
              .map((id) => `${memberLabel(group, id).name}${id === userId ? " (você)" : ""}`)
              .join(", ")}
          </p>
        ) : null}
        {t.feature_id || t.area ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold">Tela/Funcionalidade: </span>
            {areaOf(t)}
          </p>
        ) : null}
        {isLead || mine ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
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
    <Card className="w-full">
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
          O QA Líder distribui os blocos da missão e tarefas livres entre os integrantes. Os demais
          acompanham o quadro e atualizam o andamento das próprias tarefas.
        </p>

        {isLead ? (
          open ? (
            <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="task-title">Título da tarefa</Label>
                  <Input
                    id="task-title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Ex.: Registrar as evidências da missão"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="task-desc">Descrição</Label>
                  <Textarea
                    id="task-desc"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Opcional: detalhe o que precisa ser feito."
                  />
                </div>
                <div>
                  <Label htmlFor="task-assignee">Responsável</Label>
                  <NativeSelect
                    id="task-assignee"
                    value={form.assignee_id}
                    onChange={(v) => setForm((f) => ({ ...f, assignee_id: v }))}
                    options={memberOptions}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Outros responsáveis (opcional)</Label>
                  <div className="mt-1 flex flex-wrap gap-3 rounded-md border border-border bg-background p-3">
                    {group.members.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Grupo sem integrantes.</span>
                    ) : (
                      group.members.map((m) => (
                        <label
                          key={m.student_id}
                          className="flex items-center gap-2 text-xs"
                          htmlFor={`collab-${m.student_id}`}
                        >
                          <input
                            id={`collab-${m.student_id}`}
                            type="checkbox"
                            className="h-4 w-4 accent-[hsl(var(--accent))]"
                            checked={form.collaborators.includes(m.student_id)}
                            disabled={m.student_id === form.assignee_id}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                collaborators: e.target.checked
                                  ? [...f.collaborators, m.student_id]
                                  : f.collaborators.filter((id) => id !== m.student_id),
                              }))
                            }
                          />
                          <span>
                            {m.full_name}
                            {m.student_id === form.assignee_id ? " (responsável principal)" : ""}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
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
                <div className="sm:col-span-2">
                  <Label htmlFor="task-section">Bloco da missão relacionado (opcional)</Label>
                  <NativeSelect
                    id="task-section"
                    value={form.section_id}
                    onChange={(v) => {
                      const s = sections.find((x) => x.id === v);
                      setForm((f) => ({
                        ...f,
                        section_id: v,
                        title: f.title.trim() ? f.title : (s?.title ?? ""),
                      }));
                    }}
                    options={[
                      { value: "", label: "Sem bloco relacionado" },
                      ...sections.map((s) => ({
                        value: s.id,
                        label: `${blockDef(s.kind).icon} ${s.title}`,
                      })),
                    ]}
                  />
                </div>
                <div className="sm:col-span-2">
                  <p className="mb-1 text-xs text-muted-foreground">
                    Tela/Funcionalidade relacionada (opcional)
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ModuleFeatureSelect
                      project="cafe_central"
                      groupId={group.id}
                      moduleId={form.module_id}
                      featureId={form.feature_id}
                      idPrefix="task-area"
                      onChange={(v) =>
                        setForm((f) => ({ ...f, module_id: v.moduleId, feature_id: v.featureId }))
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={submitTask}
                  disabled={createTask.isPending || updateTask.isPending}
                >
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
              <div className="grid gap-4 lg:grid-cols-3">
                {COLUMNS.map((col) => (
                  <div key={col.key} className="space-y-3 rounded-xl bg-secondary/30 p-4">
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

          <TabsContent value="minhas" className="grid gap-3 pt-4 md:grid-cols-2">
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
              sectionLabel={sectionLabel}
              sections={sections}
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
  sectionLabel,
  sections,
}: {
  runId: string;
  missionId: string;
  group: CafeGroup;
  userId: string | null;
  myTasks: MissionTask[];
  contributions: {
    id: string;
    student_id: string;
    task_id: string | null;
    kind: string;
    title: string;
    description: string;
    link: string | null;
    reflection: string;
    created_at: string;
    section_id?: string | null;
    scope?: string;
  }[];
  areaOf: (t: MissionTask) => string;
  sectionLabel: (id: string | null) => string;
  sections: Section[];
}) {
  const create = useCreateMissionContribution(runId, missionId, group.id, userId);
  const remove = useDeleteMissionContribution(runId);
  const update = useUpdateMissionContribution(runId);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyContribution);

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
    const sectionId = form.section_id || null;
    const scope = sectionId
      ? (sections.find((x) => x.id === sectionId)?.scope ?? "individual")
      : "individual";
    try {
      await create.mutateAsync({
        section_id: sectionId,
        scope,
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

  async function saveEdit(id: string) {
    if (!editForm.title.trim() || !editForm.description.trim()) {
      toast.error("Informe o título e descreva o que você fez.");
      return;
    }
    if (editForm.link.trim() && !/^https:\/\//i.test(editForm.link.trim())) {
      toast.error("A evidência deve ser um link https válido.");
      return;
    }
    try {
      await update.mutateAsync({
        id,
        task_id: editForm.task_id || null,
        kind: editForm.kind,
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        link: editForm.link.trim() || null,
        reflection: editForm.reflection.trim(),
      });
      setEditing(null);
      toast.success("Registro atualizado com sucesso.");
    } catch (err) {
      console.error("[café] falha ao atualizar contribuição:", err);
      toast.error("Não foi possível salvar as alterações.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
        <p className="text-xs text-muted-foreground">
          Registre aqui o que você <span className="font-semibold">já executou</span>. A
          distribuição de tarefas é feita pelo QA Líder no quadro acima.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="c-task">Tarefa relacionada</Label>
            <NativeSelect
              id="c-task"
              value={form.task_id}
              onChange={(v) => setForm((f) => ({ ...f, task_id: v }))}
              options={[
                {
                  value: "",
                  label: myTasks.length
                    ? "Sem tarefa vinculada"
                    : "Nenhuma tarefa atribuída a você",
                },
                ...myTasks.map((t) => ({
                  value: t.id,
                  label: `${t.title}${sectionLabel(t.section_id) ? ` — ${sectionLabel(t.section_id)}` : ""}`,
                })),
              ]}
            />
          </div>
          <div>
            <Label htmlFor="c-section">Bloco da missão</Label>
            <NativeSelect
              id="c-section"
              value={form.section_id}
              onChange={(v) => setForm((f) => ({ ...f, section_id: v }))}
              options={[
                { value: "", label: "Sem bloco vinculado (individual)" },
                ...sections.map((s2) => ({
                  value: s2.id,
                  label: `${blockDef(s2.kind).icon} ${s2.title} — ${s2.scope === "individual" ? "individual" : "grupo"}`,
                })),
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
              <div key={c.id} className="rounded-xl border border-border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{c.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {contributionKindLabel(c.kind)} ·{" "}
                    {new Date(c.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Grupo {group.name} · Função: {role || "Integrante"} · Tarefa:{" "}
                  {t ? t.title : "—"}
                  {t && sectionLabel(t.section_id) ? ` · Bloco: ${sectionLabel(t.section_id)}` : ""}
                  {t && (t.feature_id || t.area) ? ` · ${areaOf(t)}` : ""}
                  {c.section_id && sectionLabel(c.section_id)
                    ? ` · Bloco: ${sectionLabel(c.section_id)}`
                    : ""}
                  {` · Registro ${c.scope === "group" ? "do grupo" : "individual"}`}
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
                <div className="mt-2 flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (editing === c.id) {
                        setEditing(null);
                        return;
                      }
                      setEditing(c.id);
                      setEditForm({
                        ...emptyContribution,
                        task_id: c.task_id ?? "",
                        kind: c.kind,
                        title: c.title,
                        description: c.description ?? "",
                        link: c.link ?? "",
                        reflection: c.reflection ?? "",
                        section_id: c.section_id ?? "",
                      });
                    }}
                  >
                    {editing === c.id ? "Cancelar" : "Editar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Tem certeza de que deseja excluir este registro? Esta ação não poderá ser desfeita.",
                        )
                      )
                        remove.mutate(c.id);
                    }}
                  >
                    Excluir
                  </Button>
                </div>
                {editing === c.id ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
                    <Input
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Título"
                    />
                    <Textarea
                      rows={3}
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="O que você fez"
                    />
                    <Input
                      value={editForm.link}
                      onChange={(e) => setEditForm((f) => ({ ...f, link: e.target.value }))}
                      placeholder="https://"
                    />
                    <Textarea
                      rows={2}
                      value={editForm.reflection}
                      onChange={(e) => setEditForm((f) => ({ ...f, reflection: e.target.value }))}
                      placeholder="Reflexão"
                    />
                    <Button size="sm" onClick={() => void saveEdit(c.id)} disabled={update.isPending}>
                      Salvar alterações
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
