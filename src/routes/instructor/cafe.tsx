import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  contributionKindLabel,
  taskStatusLabel,
  useCafeMission,
  useContributions,
  useGroupRunByGroup,
  useInstructorGroups,
  useTasks,
  type CafeGroup,
} from "@/lib/cafe";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/instructor/cafe")({
  head: () => ({
    meta: [
      { title: "Café Central | Instrutor | QA Academy" },
      {
        name: "description",
        content: "Acompanhe os grupos do Desafio QA Café Central e a contribuição individual de cada integrante.",
      },
      { property: "og:title", content: "Café Central | Instrutor" },
      {
        property: "og:description",
        content: "Visão do instrutor sobre tarefas, contribuições e entregas coletivas dos grupos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InstructorCafe,
});

function InstructorCafe() {
  const { user } = useAuth();
  const { data: mission } = useCafeMission();
  const { data: groups, isPending } = useInstructorGroups(user?.id ?? null);

  return (
    <div className="max-w-5xl">
      <div className="mb-6 rounded-xl border border-border bg-surface p-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">
          Trilha Café Central
        </span>
        <h1 className="mt-1 text-2xl font-bold">Acompanhamento dos grupos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mission?.title}. Visualize a organização de cada grupo e a contribuição individual dos
          integrantes. A avaliação por indicadores continua exclusiva do instrutor.
        </p>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Carregando grupos...</p>}
      {!isPending && (groups ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum grupo criado nas suas turmas.</p>
      )}

      <div className="space-y-4">
        {(groups ?? []).map((g) => (
          <GroupCard key={g.id} group={g} missionId={mission?.id ?? null} />
        ))}
      </div>
    </div>
  );
}

function GroupCard({ group, missionId }: { group: CafeGroup; missionId: string | null }) {
  const { data: run } = useGroupRunByGroup(group.id, missionId);
  const { data: taskData } = useTasks(run?.id ?? null);
  const { data: contributions } = useContributions(run?.id ?? null);

  const tasks = taskData?.tasks ?? [];
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const nameOf = (id: string | null) =>
    group.members.find((m) => m.student_id === id)?.full_name ?? "—";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {group.name}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {group.class_name}
            </span>
          </CardTitle>
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {run?.status === "submitted" ? "Entrega concluída" : run ? "Em andamento" : "Não iniciado"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">QA Lead: {nameOf(group.qa_lead_id)}</p>

        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Tarefas concluídas</span>
            <span>
              {done}/{tasks.length}
            </span>
          </div>
          <Progress value={pct} />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contribuição por integrante
          </p>
          <div className="space-y-1">
            {group.members.map((m) => {
              const mine = (contributions ?? []).filter((c) => c.student_id === m.student_id);
              const myTasks = tasks.filter((t) => t.assignee_id === m.student_id);
              return (
                <div key={m.student_id} className="rounded-md border border-border px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {m.full_name}
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {m.is_qa_lead ? "QA Lead" : m.member_function}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {myTasks.length} tarefa(s) · {mine.length} contribuição(ões)
                    </span>
                  </div>
                  {mine.slice(0, 4).map((c) => (
                    <p key={c.id} className="mt-1 text-xs text-muted-foreground">
                      • {contributionKindLabel(c.kind)}: {c.title}
                    </p>
                  ))}
                  {myTasks.slice(0, 4).map((t) => (
                    <p key={t.id} className="mt-1 text-xs text-muted-foreground">
                      ◦ Tarefa: {t.title} ({taskStatusLabel(t.status)})
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {run?.deliverable && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Entrega coletiva
            </p>
            <p className="whitespace-pre-wrap text-muted-foreground">{run.deliverable}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
