import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  CONTRIBUTION_KINDS,
  TASK_STATUSES,
  contributionKindLabel,
  taskStatusLabel,
  useCafeMission,
  useContributions,
  useCreateContribution,
  useCreateTask,
  useDeleteContribution,
  useDeleteTask,
  useEnsureGroupRun,
  useEvidenceRequests,
  useMyGroups,
  useRequestEvidence,
  useSetMemberFunction,
  useSetTaskCollaborators,
  useTasks,
  useUpdateEvidenceRequest,
  useUpdateRun,
  useUpdateTask,
  type CafeTask,
} from "@/lib/cafe";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/student/cafe/$groupId")({
  head: () => ({
    meta: [
      { title: "Painel do grupo | Café Central | QA Academy" },
      {
        name: "description",
        content: "Painel do grupo do Desafio QA Café Central: tarefas, contribuições e entrega coletiva.",
      },
      { property: "og:title", content: "Painel do grupo | Café Central" },
      {
        property: "og:description",
        content: "Organize tarefas, registre contribuições individuais e conclua a entrega do grupo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupPanel,
});

const STATUS_TONE: Record<string, string> = {
  todo: "border-border text-muted-foreground",
  doing: "border-primary text-primary",
  review: "border-warning text-warning",
  done: "border-success text-success",
  blocked: "border-danger text-danger",
};

function GroupPanel() {
  const { groupId } = Route.useParams();
  const { user } = useAuth();
  const { data: mission } = useCafeMission();
  const { data: groups } = useMyGroups(user?.id ?? null);
  const group = (groups ?? []).find((g) => g.id === groupId) ?? null;

  const { data: run } = useEnsureGroupRun(group?.id ?? null, mission?.id ?? null, user?.id ?? null);
  const runId = run?.id ?? null;
  const { data: taskData } = useTasks(runId);
  const { data: contributions } = useContributions(runId);
  const { data: requests } = useEvidenceRequests(runId);

  const isLead = !!group && group.qa_lead_id === user?.id;
  const tasks = taskData?.tasks ?? [];
  const collaborators = taskData?.collaborators ?? [];
  const nameOf = (id: string | null) =>
    (group?.members.find((m) => m.student_id === id)?.full_name ?? (id ? "Integrante" : "—"));

  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  if (!group) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-muted-foreground">
          Grupo não encontrado ou você não faz parte dele.{" "}
          <Link to="/student/cafe" className="text-primary underline">
            Voltar
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 rounded-xl border border-border bg-surface p-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">
          Café Central · prática autônoma em grupo
        </span>
        <h1 className="mt-1 text-2xl font-bold">{group.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mission?.title} · Turma {group.class_name || "—"} ·{" "}
          {isLead ? "Você é o QA Lead" : `QA Lead: ${nameOf(group.qa_lead_id)}`}
        </p>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Progresso das tarefas</span>
            <span>
              {done}/{tasks.length}
            </span>
          </div>
          <Progress value={pct} />
        </div>
        {run?.status === "submitted" && (
          <p className="mt-3 text-sm text-success">
            Entrega coletiva concluída em {new Date(run.submitted_at ?? "").toLocaleString("pt-BR")} por{" "}
            {nameOf(run.submitted_by)}.
          </p>
        )}
      </div>

      <Tabs defaultValue="grupo">
        <TabsList>
          <TabsTrigger value="grupo">Painel do grupo</TabsTrigger>
          <TabsTrigger value="minhas">Minhas contribuições</TabsTrigger>
          {isLead && <TabsTrigger value="lead">Painel do QA Lead</TabsTrigger>}
        </TabsList>

        {/* ---------------- Painel do grupo ---------------- */}
        <TabsContent value="grupo" className="space-y-6 pt-4">
          {mission && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Missão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">{mission.objective}</p>
                {mission.summary.map((s) => (
                  <p key={s.topic}>
                    <span className="font-semibold">{s.topic}: </span>
                    <span className="text-muted-foreground">{s.text}</span>
                  </p>
                ))}
                {mission.practice.areas && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {mission.practice.areas.map((a) => (
                      <span key={a} className="rounded-full border border-border px-2 py-0.5 text-xs">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Integrantes e funções</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.members.map((m) => (
                <div
                  key={m.student_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span>{m.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.is_qa_lead ? "QA Lead" : m.member_function} ·{" "}
                    {contributions?.filter((c) => c.student_id === m.student_id).length ?? 0} contribuição(ões)
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tarefas do grupo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tasks.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma tarefa distribuída ainda. O QA Lead deve distribuir as áreas de
                  investigação.
                </p>
              )}
              {tasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  runId={runId}
                  canManage={isLead}
                  isAssignee={t.assignee_id === user?.id}
                  collaboratorNames={collaborators
                    .filter((c) => c.task_id === t.id)
                    .map((c) => nameOf(c.student_id))}
                  assigneeName={nameOf(t.assignee_id)}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Contribuições do grupo (autoria individual)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(contributions ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma contribuição registrada ainda.</p>
              )}
              {(contributions ?? []).map((c) => (
                <div key={c.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{c.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {contributionKindLabel(c.kind)} · por {nameOf(c.student_id)}
                    </span>
                  </div>
                  {c.description && <p className="mt-1 text-muted-foreground">{c.description}</p>}
                  {c.link && (
                    <a
                      href={c.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-primary underline"
                    >
                      Abrir evidência
                    </a>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Entrega coletiva</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {run?.deliverable ? (
                <p className="whitespace-pre-wrap text-muted-foreground">{run.deliverable}</p>
              ) : (
                <p className="text-muted-foreground">
                  O grupo ainda não reuniu os resultados. O QA Lead escreve e conclui a entrega.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Minhas contribuições ---------------- */}
        <TabsContent value="minhas" className="space-y-6 pt-4">
          <ContributionForm
            runId={runId}
            groupId={group.id}
            userId={user?.id ?? null}
            tasks={tasks}
          />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Evidências solicitadas para mim</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(requests ?? []).filter((r) => r.requested_from === user?.id).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
              )}
              {(requests ?? [])
                .filter((r) => r.requested_from === user?.id)
                .map((r) => (
                  <EvidenceRequestRow key={r.id} runId={runId} id={r.id} status={r.status} message={r.message} from={nameOf(r.requested_by)} canAnswer />
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Meus registros neste grupo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <MyContributions runId={runId} userId={user?.id ?? null} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Painel do QA Lead ---------------- */}
        {isLead && (
          <TabsContent value="lead" className="space-y-6 pt-4">
            <p className="rounded-md border border-border bg-surface p-3 text-xs text-muted-foreground">
              O QA Lead organiza o trabalho do grupo. A avaliação por indicadores (A, PA, NA e D/ND)
              é exclusiva do instrutor.
            </p>

            <NewTaskForm
              runId={runId}
              groupId={group.id}
              userId={user?.id ?? null}
              members={group.members}
              areas={mission?.practice.areas ?? []}
            />

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Definir funções dos integrantes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.members
                  .filter((m) => !m.is_qa_lead)
                  .map((m) => (
                    <MemberFunctionRow
                      key={m.student_id}
                      groupId={group.id}
                      userId={user?.id ?? null}
                      studentId={m.student_id}
                      name={m.full_name}
                      value={m.member_function}
                    />
                  ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Solicitar evidência</CardTitle>
              </CardHeader>
              <CardContent>
                <EvidenceRequestForm
                  runId={runId}
                  groupId={group.id}
                  userId={user?.id ?? null}
                  members={group.members.map((m) => ({ id: m.student_id, name: m.full_name }))}
                  tasks={tasks}
                />
                <div className="mt-4 space-y-2">
                  {(requests ?? []).map((r) => (
                    <EvidenceRequestRow
                      key={r.id}
                      runId={runId}
                      id={r.id}
                      status={r.status}
                      message={r.message}
                      from={`para ${nameOf(r.requested_from)}`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <DeliverableForm
              runId={runId}
              groupId={group.id}
              missionId={mission?.id ?? null}
              userId={user?.id ?? null}
              value={run?.deliverable ?? ""}
              status={run?.status ?? "in_progress"}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function TaskCard({
  task,
  runId,
  canManage,
  isAssignee,
  assigneeName,
  collaboratorNames,
}: {
  task: CafeTask;
  runId: string | null;
  canManage: boolean;
  isAssignee: boolean;
  assigneeName: string;
  collaboratorNames: string[];
}) {
  const update = useUpdateTask(runId);
  const remove = useDeleteTask(runId);

  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{task.title}</span>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_TONE[task.status] ?? ""}`}>
          {taskStatusLabel(task.status)}
        </span>
      </div>
      {task.area && <p className="text-xs text-accent">Área: {task.area}</p>}
      {task.description && <p className="mt-1 text-muted-foreground">{task.description}</p>}
      <p className="mt-1 text-xs text-muted-foreground">
        Responsável: {assigneeName}
        {collaboratorNames.length > 0 && ` · Colaboradores: ${collaboratorNames.join(", ")}`}
      </p>
      {(canManage || isAssignee) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            value={task.status}
            onChange={(e) => update.mutate({ id: task.id, patch: { status: e.target.value as CafeTask["status"] } })}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => remove.mutate(task.id)}
              className="text-danger"
            >
              Remover
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function NewTaskForm({
  runId,
  groupId,
  userId,
  members,
  areas,
}: {
  runId: string | null;
  groupId: string;
  userId: string | null;
  members: { student_id: string; full_name: string }[];
  areas: string[];
}) {
  const create = useCreateTask(runId, groupId, userId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [assignee, setAssignee] = useState("");
  const [collabs, setCollabs] = useState<string[]>([]);

  function toggle(id: string) {
    setCollabs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!runId || !title.trim()) return;
    create.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        area,
        assignee_id: assignee || null,
        collaborators: collabs,
      },
      {
        onSuccess: () => {
          toast.success("Tarefa distribuída");
          setTitle("");
          setDescription("");
          setArea("");
          setAssignee("");
          setCollabs([]);
        },
        onError: (err: unknown) => toast.error((err as Error).message),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Distribuir nova tarefa</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="t-title">Título</Label>
              <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="t-area">Área de investigação</Label>
              <select
                id="t-area"
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              >
                <option value="">Selecione</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="t-desc">Descrição</Label>
            <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="t-assignee">Responsável</Label>
            <select
              id="t-assignee"
              className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Sem responsável</option>
              {members.map((m) => (
                <option key={m.student_id} value={m.student_id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Colaboradores</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {members.map((m) => (
                <button
                  key={m.student_id}
                  type="button"
                  onClick={() => toggle(m.student_id)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    collabs.includes(m.student_id)
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {m.full_name}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={create.isPending}>
            Distribuir tarefa
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MemberFunctionRow({
  groupId,
  userId,
  studentId,
  name,
  value,
}: {
  groupId: string;
  userId: string | null;
  studentId: string;
  name: string;
  value: string;
}) {
  const [fn, setFn] = useState(value);
  const save = useSetMemberFunction(groupId, userId);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
      <span className="flex-1">{name}</span>
      <Input className="h-8 w-48" value={fn} onChange={(e) => setFn(e.target.value)} />
      <Button
        size="sm"
        variant="secondary"
        onClick={() =>
          save.mutate(
            { studentId, fn },
            {
              onSuccess: () => toast.success("Função atualizada"),
              onError: (err: unknown) => toast.error((err as Error).message),
            },
          )
        }
      >
        Salvar
      </Button>
    </div>
  );
}

function ContributionForm({
  runId,
  groupId,
  userId,
  tasks,
}: {
  runId: string | null;
  groupId: string;
  userId: string | null;
  tasks: CafeTask[];
}) {
  const create = useCreateContribution(runId, groupId, userId);
  const [kind, setKind] = useState("caso");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [taskId, setTaskId] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!runId || !title.trim()) return;
    create.mutate(
      {
        kind,
        title: title.trim(),
        description: description.trim(),
        link: link.trim() || null,
        task_id: taskId || null,
      },
      {
        onSuccess: () => {
          toast.success("Contribuição registrada em seu nome");
          setTitle("");
          setDescription("");
          setLink("");
        },
        onError: (err: unknown) => toast.error((err as Error).message),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Registrar minha contribuição</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="c-kind">Tipo</Label>
              <select
                id="c-kind"
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {CONTRIBUTION_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="c-task">Tarefa relacionada</Label>
              <select
                id="c-task"
                className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              >
                <option value="">Nenhuma</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="c-title">Título</Label>
            <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="c-desc">Descrição</Label>
            <Textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-link">Link da evidência (opcional)</Label>
            <Input id="c-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
          </div>
          <Button type="submit" disabled={create.isPending}>
            Registrar contribuição
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MyContributions({ runId, userId }: { runId: string | null; userId: string | null }) {
  const { data } = useContributions(runId);
  const remove = useDeleteContribution(runId);
  const mine = (data ?? []).filter((c) => c.student_id === userId);
  if (mine.length === 0)
    return <p className="text-sm text-muted-foreground">Você ainda não registrou contribuições.</p>;
  return (
    <>
      {mine.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
          <div>
            <p className="font-medium">{c.title}</p>
            <p className="text-xs text-muted-foreground">{contributionKindLabel(c.kind)}</p>
          </div>
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => remove.mutate(c.id)}>
            Excluir
          </Button>
        </div>
      ))}
    </>
  );
}

function EvidenceRequestForm({
  runId,
  groupId,
  userId,
  members,
  tasks,
}: {
  runId: string | null;
  groupId: string;
  userId: string | null;
  members: { id: string; name: string }[];
  tasks: CafeTask[];
}) {
  const request = useRequestEvidence(runId, groupId, userId);
  const [from, setFrom] = useState("");
  const [message, setMessage] = useState("");
  const [taskId, setTaskId] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!runId || !from) return;
    request.mutate(
      { requested_from: from, message: message.trim(), task_id: taskId || null },
      {
        onSuccess: () => {
          toast.success("Evidência solicitada");
          setMessage("");
        },
        onError: (err: unknown) => toast.error((err as Error).message),
      },
    );
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="e-from">Integrante</Label>
          <select
            id="e-from"
            className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          >
            <option value="">Selecione</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="e-task">Tarefa</Label>
          <select
            id="e-task"
            className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
          >
            <option value="">Nenhuma</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label htmlFor="e-msg">O que precisa ser enviado</Label>
        <Textarea id="e-msg" value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <Button type="submit" disabled={request.isPending}>
        Solicitar evidência
      </Button>
    </form>
  );
}

function EvidenceRequestRow({
  runId,
  id,
  status,
  message,
  from,
  canAnswer = false,
}: {
  runId: string | null;
  id: string;
  status: string;
  message: string;
  from: string;
  canAnswer?: boolean;
}) {
  const update = useUpdateEvidenceRequest(runId);
  const label = status === "pending" ? "Pendente" : status === "fulfilled" ? "Atendida" : "Cancelada";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm">
      <div>
        <p>{message || "Enviar evidência"}</p>
        <p className="text-xs text-muted-foreground">
          {from} · {label}
        </p>
      </div>
      {status === "pending" && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            update.mutate({ id, status: canAnswer ? "fulfilled" : "cancelled" }, {
              onSuccess: () => toast.success(canAnswer ? "Marcada como atendida" : "Solicitação cancelada"),
              onError: (err: unknown) => toast.error((err as Error).message),
            })
          }
        >
          {canAnswer ? "Marcar como atendida" : "Cancelar"}
        </Button>
      )}
    </div>
  );
}

function DeliverableForm({
  runId,
  groupId,
  missionId,
  userId,
  value,
  status,
}: {
  runId: string | null;
  groupId: string;
  missionId: string | null;
  userId: string | null;
  value: string;
  status: string;
}) {
  const update = useUpdateRun(runId, groupId, missionId);
  const [text, setText] = useState(value);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Entrega coletiva</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reúna aqui os resultados do grupo: áreas investigadas, principais achados e conclusão."
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              update.mutate({ deliverable: text }, {
                onSuccess: () => toast.success("Entrega salva"),
                onError: (err: unknown) => toast.error((err as Error).message),
              })
            }
          >
            Salvar rascunho
          </Button>
          <Button
            disabled={status === "submitted"}
            onClick={() =>
              update.mutate(
                {
                  deliverable: text,
                  status: "submitted",
                  submitted_at: new Date().toISOString(),
                  submitted_by: userId,
                },
                {
                  onSuccess: () => toast.success("Entrega do grupo concluída"),
                  onError: (err: unknown) => toast.error((err as Error).message),
                },
              )
            }
          >
            {status === "submitted" ? "Entrega concluída" : "Concluir entrega do grupo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
