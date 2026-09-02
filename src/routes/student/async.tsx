import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { asyncActivityState, useStudentMissions } from "@/lib/mission-builder";
import { fmtDateTime, useMySubmissions } from "@/lib/mission-submissions";

export const Route = createFileRoute("/student/async")({
  head: () => ({
    meta: [
      { title: "Atividades Assíncronas | QA Academy" },
      {
        name: "description",
        content: "Atividades assíncronas da UC10: progresso, prazos, entregas do grupo e sua contribuição individual.",
      },
      { property: "og:title", content: "Atividades Assíncronas | QA Academy" },
      {
        property: "og:description",
        content: "Acompanhe suas atividades assíncronas da UC10, prazos, XP e entregas na QA Academy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentAsyncPage,
});

function StudentAsyncPage() {
  const { user } = useAuth();
  const { data: missions, isPending } = useStudentMissions();
  const { data: runs } = useMySubmissions(user?.id ?? null);

  const list = useMemo(() => {
    const byMission = new Map((runs ?? []).map((r) => [r.mission_id, r] as const));
    return (missions ?? [])
      .filter((m) => (m.activity_kind ?? "presencial") === "assincrona")
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.title.localeCompare(b.title))
      .map((m) => ({ mission: m, run: byMission.get(m.id) ?? null }));
  }, [missions, runs]);

  const done = list.filter(({ run }) => run?.submitted_at || run?.eval_status === "evaluated").length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;
  const xp = list.reduce((acc, { run }) => acc + (run?.eval_status === "evaluated" ? (run.xp_awarded ?? 0) : 0), 0);

  return (
    <div className="max-w-4xl space-y-4">
      <div className="rounded-xl border border-border bg-surface p-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">UC10</span>
        <h1 className="mt-1 text-2xl font-bold">📚 Atividades Assíncronas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Atividades da UC10 realizadas fora do horário presencial, principalmente sobre o projeto Café Central. A
          entrega pode ser coletiva, mas a sua contribuição individual é sempre registrada.
        </p>
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold">
              Progresso: {done}/{list.length} concluídas
            </span>
            <span className="text-muted-foreground">⭐ XP conquistado: {xp}</span>
          </div>
          <Progress value={pct} />
          <p className="text-xs text-muted-foreground">{pct}%</p>
        </div>
      </div>

      {isPending ? <p className="text-sm text-muted-foreground">Carregando atividades...</p> : null}

      {list.map(({ mission, run }, i) => {
        const st = asyncActivityState(mission, run);
        const locked = st.key === "locked";
        return (
          <Card key={mission.id}>
            <CardContent className="space-y-3 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {i + 1}. {mission.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {mission.template === "cafe" ? "🚀 Café Central — em grupo" : "🎓 Individual"}
                    {mission.workload ? ` · ${mission.workload}` : ""}
                    {mission.opens_at ? ` · abre em ${fmtDateTime(mission.opens_at)}` : ""}
                    {mission.due_at ? ` · prazo ${fmtDateTime(mission.due_at)}` : ""}
                  </p>
                  {mission.objective ? (
                    <p className="mt-1 text-sm text-muted-foreground">{mission.objective}</p>
                  ) : null}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.tone}`}>{st.label}</span>
              </div>

              {run ? (
                <div>
                  <Progress value={run.progress} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Progresso: {run.progress}%
                    {run.eval_status === "evaluated" ? ` · XP: ${run.xp_awarded ?? 0}` : ""}
                  </p>
                </div>
              ) : null}

              {run?.feedback ? (
                <p className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
                  <span className="font-semibold">Feedback do instrutor: </span>
                  {run.feedback}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={locked} asChild={!locked}>
                  {locked ? (
                    <span>Bloqueada</span>
                  ) : (
                    <Link to="/student/activities/$missionId" params={{ missionId: mission.id }}>
                      {run?.submitted_at ? "Consultar atividade" : run ? "Continuar atividade" : "Abrir atividade"}
                    </Link>
                  )}
                </Button>
                {run ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/student/missions/$runId" params={{ runId: run.id }}>
                      Ver entrega e contribuições
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {!isPending && list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhuma atividade assíncrona publicada para você ainda.
        </p>
      ) : null}
    </div>
  );
}
