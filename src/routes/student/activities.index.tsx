import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, TEMPLATE_LABEL, useStudentMissions } from "@/lib/mission-builder";
import { useAuth } from "@/lib/auth";
import { useMySubmissions } from "@/lib/mission-submissions";
import { fmtMissionDateTime, missionSituation } from "@/lib/mission-schedule";

export const Route = createFileRoute("/student/activities/")({
  head: () => ({
    meta: [
      { title: "Missões da turma | QA Academy" },
      { name: "description", content: "Atividades da UC10 publicadas pelo instrutor para a sua turma." },
      { property: "og:title", content: "Missões da turma | QA Academy" },
      { property: "og:description", content: "Execute as missões da UC10 e registre suas evidências." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentActivitiesPage,
});

function StudentActivitiesPage() {
  const { user } = useAuth();
  const { data: all, isPending } = useStudentMissions();
  const { data: runs } = useMySubmissions(user?.id ?? null);
  const runByMission = new Map((runs ?? []).map((r) => [r.mission_id, r] as const));
  const missions = (all ?? []).filter((m) => (m.activity_kind ?? "presencial") !== "assincrona");

  return (
    <div className="max-w-4xl space-y-4">
      <div className="rounded-xl border border-border bg-surface p-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">UC10</span>
        <h1 className="mt-1 text-2xl font-bold">Missões da turma</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Atividades publicadas pelo instrutor. Missões encerradas ficam disponíveis apenas para consulta.
        </p>
      </div>

      {isPending ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}

      {(missions ?? []).map((m) => (
        <Card key={m.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-semibold">
                {m.lesson_number ? `Aula ${m.lesson_number} · ` : ""}
                {m.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {TEMPLATE_LABEL[m.template]} · {STATUS_LABEL[m.status]}
                {m.due_at ? ` · prazo ${new Date(m.due_at).toLocaleDateString("pt-BR")}` : ""}
              </p>
              {m.objective ? <p className="mt-1 text-sm text-muted-foreground">{m.objective}</p> : null}
            </div>
            <Button size="sm" asChild>
              <Link to="/student/activities/$missionId" params={{ missionId: m.id }}>
                {m.status === "closed" ? "Consultar" : "Abrir missão"}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}

      {!isPending && (missions ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma missão publicada para você ainda.</p>
      ) : null}
    </div>
  );
}
