import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SITUATION_FILTERS,
  fmtDateTime,
  runSituation,
  useAllSubmissions,
  useReevaluatedRuns,
} from "@/lib/mission-submissions";

export const Route = createFileRoute("/instructor/submissions/")({
  head: () => ({
    meta: [
      { title: "Central de Avaliação | QA Academy" },
      { name: "description", content: "Central de avaliação das missões: envios dos alunos, respostas, evidências e XP." },
      { property: "og:title", content: "Central de Avaliação | QA Academy" },
      { property: "og:description", content: "Avalie os envios de missões da UC10 com respostas, evidências e indicadores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubmissionsPage,
});

function SubmissionsPage() {
  const { data, isPending } = useAllSubmissions();
  const { data: reevaluated } = useReevaluatedRuns();
  const [filter, setFilter] = useState("awaiting");
  const [term, setTerm] = useState("");
  const [missionId, setMissionId] = useState("");

  const missions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of data ?? []) if (r.mission) map.set(r.mission.id, r.mission.title);
    return [...map.entries()];
  }, [data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.length ?? 0 };
    c["reevaluated"] = 0;
    for (const r of data ?? []) {
      const k = runSituation(r).key;
      c[k] = (c[k] ?? 0) + 1;
      if (reevaluated?.has(r.id)) c["reevaluated"] = (c["reevaluated"] ?? 0) + 1;
    }
    return c;
  }, [data, reevaluated]);

  const rows = (data ?? []).filter((r) => {
    if (filter === "reevaluated") {
      if (!reevaluated?.has(r.id)) return false;
    } else if (filter !== "all" && runSituation(r).key !== filter) return false;
    if (missionId && r.mission_id !== missionId) return false;
    const t = term.trim().toLowerCase();
    if (!t) return true;
    return [r.studentName, r.studentEmail, r.groupName, r.className, r.mission?.title]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(t));
  });

  return (
    <div className="max-w-5xl">
      <div className="mb-6 rounded-xl border border-border bg-surface p-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">UC10</span>
        <h1 className="mt-1 text-2xl font-bold">Central de Avaliação</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Todos os envios de missões: abra cada ficha para ver respostas, evidências, conceder XP e registrar A/PA/NA.
        </p>
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {[...SITUATION_FILTERS, { key: "reevaluated", label: "Reavaliadas" }].map((f) => (
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
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Buscar por aluno, grupo, turma ou missão"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <select
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            value={missionId}
            onChange={(e) => setMissionId(e.target.value)}
          >
            <option value="">Todas as missões</option>
            {missions.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isPending ? <p className="text-sm text-muted-foreground">Carregando envios...</p> : null}

      <div className="space-y-3">
        {rows.map((r) => {
          const sit = runSituation(r);
          return (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-[240px]">
                  <p className="font-semibold">{r.mission?.title ?? "Missão"}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.groupName ? `Grupo ${r.groupName}` : r.studentName}
                    {r.className ? ` · ${r.className}` : ""} · tentativa {r.attempt} · {fmtDateTime(r.submitted_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{r.progress}%</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sit.tone}`}>{sit.label}</span>
                  <Button asChild size="sm">
                    <Link to="/instructor/submissions/$runId" params={{ runId: r.id }}>
                      {r.eval_status === "evaluated" ? "Reavaliar" : "Avaliar"}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!isPending && rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nenhum envio nesta situação.
          </p>
        ) : null}
      </div>
    </div>
  );
}
