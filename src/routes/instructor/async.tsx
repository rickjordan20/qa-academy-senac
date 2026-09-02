import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACTIVITY_KIND_LABEL, STATUS_LABEL, useBuilderMissions } from "@/lib/mission-builder";
import { SITUATION_FILTERS, fmtDateTime, runSituation, useAllSubmissions } from "@/lib/mission-submissions";

export const Route = createFileRoute("/instructor/async")({
  head: () => ({
    meta: [
      { title: "Atividades Assíncronas | QA Academy" },
      {
        name: "description",
        content: "Acompanhe as atividades assíncronas da UC10: turmas, grupos, entregas, prazos, XP e avaliação.",
      },
      { property: "og:title", content: "Atividades Assíncronas | QA Academy" },
      {
        property: "og:description",
        content: "Painel do instrutor para entregas coletivas e contribuições individuais das atividades assíncronas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InstructorAsyncPage,
});

function InstructorAsyncPage() {
  const { data: missions } = useBuilderMissions();
  const { data: subs, isPending } = useAllSubmissions();
  const [missionId, setMissionId] = useState("");
  const [situation, setSituation] = useState("all");
  const [term, setTerm] = useState("");

  const asyncMissions = useMemo(
    () =>
      (missions ?? [])
        .filter((m) => (m.activity_kind ?? "presencial") === "assincrona")
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.title.localeCompare(b.title)),
    [missions],
  );
  const asyncIds = new Set(asyncMissions.map((m) => m.id));

  const rows = (subs ?? []).filter((r) => {
    if (!asyncIds.has(r.mission_id)) return false;
    if (missionId && r.mission_id !== missionId) return false;
    if (situation !== "all" && runSituation(r).key !== situation) return false;
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
        <h1 className="mt-1 text-2xl font-bold">📚 Atividades Assíncronas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Atividades marcadas como {ACTIVITY_KIND_LABEL.assincrona} no construtor. A entrega pode ser coletiva; a
          avaliação pedagógica (A/PA/NA) continua individual, pela Matriz de Avaliação e pelo Dossiê.
        </p>
      </div>

      <Card className="mb-4">
        <CardContent className="space-y-2 py-4">
          <p className="text-sm font-semibold">Atividades cadastradas ({asyncMissions.length})</p>
          {asyncMissions.map((m, i) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
              <div>
                <p className="text-sm font-medium">
                  {i + 1}. {m.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {STATUS_LABEL[m.status]}
                  {m.due_at ? ` · prazo ${fmtDateTime(m.due_at)}` : ""} · XP base {m.base_xp}
                  {m.indicator_codes?.length ? ` · indicadores ${m.indicator_codes.join(", ")}` : ""}
                </p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link to="/instructor/missions/$missionId" params={{ missionId: m.id }}>
                  Editar
                </Link>
              </Button>
            </div>
          ))}
          {asyncMissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma atividade assíncrona ainda. Crie uma missão em Missões e defina a modalidade como Assíncrona.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {SITUATION_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setSituation(f.key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                situation === f.key ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Buscar por aluno, grupo ou turma"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <select
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            value={missionId}
            onChange={(e) => setMissionId(e.target.value)}
          >
            <option value="">Todas as atividades</option>
            {asyncMissions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isPending ? <p className="text-sm text-muted-foreground">Carregando entregas...</p> : null}

      <div className="space-y-3">
        {rows.map((r) => {
          const sit = runSituation(r);
          const late = !r.submitted_at && r.mission?.due_at && new Date(r.mission.due_at).getTime() < Date.now();
          return (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-[240px]">
                  <p className="font-semibold">{r.mission?.title ?? "Atividade"}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.groupName ? `Grupo ${r.groupName}` : r.studentName}
                    {r.className ? ` · ${r.className}` : ""} · tentativa {r.attempt} ·{" "}
                    {r.submitted_at ? fmtDateTime(r.submitted_at) : "sem entrega"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{r.progress}%</span>
                  {late ? (
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                      Atrasada
                    </span>
                  ) : null}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sit.tone}`}>{sit.label}</span>
                  <Button asChild size="sm">
                    <Link to="/instructor/submissions/$runId" params={{ runId: r.id }}>
                      Abrir entrega
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!isPending && rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nenhuma entrega de atividade assíncrona nesta situação.
          </p>
        ) : null}
      </div>
    </div>
  );
}
