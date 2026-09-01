import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import {
  SITUATION_FILTERS,
  fmtDateTime,
  runSituation,
  useMySubmissions,
  type SubmissionRow,
} from "@/lib/mission-submissions";

export const Route = createFileRoute("/student/missions/")({
  head: () => ({
    meta: [
      { title: "Minhas Missões | QA Academy" },
      {
        name: "description",
        content: "Acompanhe suas missões da UC10 por situação: em andamento, enviadas, em avaliação e avaliadas.",
      },
      { property: "og:title", content: "Minhas Missões | QA Academy" },
      {
        property: "og:description",
        content: "Seus envios de missões, feedbacks do instrutor e XP conquistado na QA Academy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyMissionsPage,
});

function SubmissionCard({ row }: { row: SubmissionRow }) {
  const sit = runSituation(row);
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {row.mission?.lesson_number ? `Aula ${row.mission.lesson_number} · ` : ""}
            {row.mission?.title ?? "Missão"}
          </CardTitle>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sit.tone}`}>{sit.label}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{row.mission?.template === "cafe" ? "🚀 Café Central" : "🎓 TechEduca"}</span>
          {row.groupName ? <span>Grupo: {row.groupName}</span> : null}
          <span>Tentativa {row.attempt}</span>
          {row.submitted_at ? <span>Enviada em {fmtDateTime(row.submitted_at)}</span> : null}
          {row.eval_status === "evaluated" ? <span>XP: {row.xp_awarded ?? 0}</span> : null}
        </div>
        <div>
          <Progress value={row.progress} />
          <p className="mt-1 text-xs text-muted-foreground">Progresso: {row.progress}%</p>
        </div>
        {row.feedback ? (
          <p className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
            <span className="font-semibold">Feedback do instrutor: </span>
            {row.feedback}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/student/missions/$runId" params={{ runId: row.id }}>
              Ver envio
            </Link>
          </Button>
          {row.eval_status !== "evaluated" && row.mission?.status === "published" ? (
            <Button asChild size="sm">
              <Link to="/student/activities/$missionId" params={{ missionId: row.mission_id }}>
                {row.eval_status === "revision" ? "Revisar e reenviar" : "Continuar missão"}
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function MyMissionsPage() {
  const { user } = useAuth();
  const { data, isPending } = useMySubmissions(user?.id ?? null);
  const [filter, setFilter] = useState("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.length ?? 0 };
    for (const r of data ?? []) {
      const k = runSituation(r).key;
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [data]);

  const rows = (data ?? []).filter((r) => filter === "all" || runSituation(r).key === filter);

  return (
    <div className="max-w-4xl">
      <div className="mb-6 rounded-xl border border-border bg-surface p-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">UC10</span>
        <h1 className="mt-1 text-2xl font-bold">Minhas Missões</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Todas as missões que você iniciou ou enviou, com a situação da avaliação e o feedback do instrutor.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {SITUATION_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === f.key ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"
            }`}
          >
            {f.label} ({counts[f.key] ?? 0})
          </button>
        ))}
      </div>

      {isPending ? <p className="text-sm text-muted-foreground">Carregando suas missões...</p> : null}

      <div className="space-y-4">
        {rows.map((r) => (
          <SubmissionCard key={r.id} row={r} />
        ))}
        {!isPending && rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nenhuma missão nesta situação. Veja as{" "}
            <Link to="/student/activities" className="text-accent hover:underline">
              missões da turma
            </Link>{" "}
            para começar.
          </p>
        ) : null}
      </div>
    </div>
  );
}
