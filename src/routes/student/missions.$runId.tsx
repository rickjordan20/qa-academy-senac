import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { blockDef, type ChecklistItemDef, type Section } from "@/lib/mission-builder";
import {
  eventText,
  answerSummary,
  fmtDateTime,
  runSituation,
  useSubmission,
} from "@/lib/mission-submissions";

export const Route = createFileRoute("/student/missions/$runId")({
  head: () => ({
    meta: [
      { title: "Detalhes do envio | QA Academy" },
      { name: "description", content: "Veja suas respostas, registros, histórico de tentativas e o feedback do instrutor." },
      { property: "og:title", content: "Detalhes do envio | QA Academy" },
      { property: "og:description", content: "Envio da missão UC10 com respostas, evidências e avaliação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubmissionDetailPage,
});

export function SubmissionDetail({ runId, backTo }: { runId: string; backTo: React.ReactNode }) {
  const { data, isPending } = useSubmission(runId);

  if (isPending) return <p className="text-sm text-muted-foreground">Carregando envio...</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Envio não encontrado.</p>;

  const { run, entries, events, members } = data;
  const sections = (run.mission?.sections ?? []) as Section[];
  const sit = runSituation(run);
  const answers = answerSummary(sections, run.answers);

  const checklistBlocks = sections.filter((s) => s.kind === "checklist");

  return (
    <div className="max-w-4xl space-y-5">
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">
              {run.mission?.template === "cafe" ? "🚀 Café Central" : "🎓 TechEduca"}
            </span>
            <h1 className="mt-1 text-2xl font-bold">{run.mission?.title ?? "Missão"}</h1>
            <p className="text-sm text-muted-foreground">
              {run.studentName}
              {run.groupName ? ` · Grupo ${run.groupName}` : ""}
              {run.className ? ` · ${run.className}` : ""}
            </p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sit.tone}`}>{sit.label}</span>
        </div>
        <div className="mt-4">
          <Progress value={run.progress} />
          <p className="mt-1 text-xs text-muted-foreground">
            Progresso {run.progress}% · Tentativa {run.attempt} · Enviada em {fmtDateTime(run.submitted_at)}
          </p>
        </div>
        <div className="mt-3">{backTo}</div>
      </div>

      {run.eval_status === "evaluated" || run.feedback ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Avaliação do instrutor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Situação: {sit.label} · XP concedido: {run.xp_awarded ?? 0} · Avaliada em {fmtDateTime(run.evaluated_at)}
            </p>
            <p className="whitespace-pre-wrap">{run.feedback || "Sem comentários."}</p>
            <p className="text-xs text-muted-foreground">
              As menções A/PA/NA dos indicadores aparecem em “Minha Avaliação”.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {members.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Integrantes do grupo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs">
            {members.map((m) => (
              <span key={m.id} className="rounded-md border border-border px-2 py-1">
                {m.name} · {m.role}
              </span>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {checklistBlocks.map((s) => {
        const items = (s.items ?? []) as ChecklistItemDef[];
        return (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">✅ {s.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {items.map((i) => (
                <p key={i.id} className={run.checklist_state?.[i.id] ? "" : "text-muted-foreground"}>
                  {run.checklist_state?.[i.id] ? "☑" : "☐"} {i.label}
                </p>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {answers.map(({ section, pairs }) => (
        <Card key={section.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {blockDef(section.kind).icon} {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {pairs.map((p) => (
              <div key={p.label}>
                <p className="text-xs font-semibold text-muted-foreground">{p.label}</p>
                <p className="whitespace-pre-wrap">{p.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Registros e evidências ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {entries.length === 0 ? <p className="text-muted-foreground">Nenhum registro enviado.</p> : null}
          {entries.map((e) => (
            <div key={e.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {blockDef(e.kind).icon} {e.title || blockDef(e.kind).label}
                </span>
                <span className="text-xs text-muted-foreground">{fmtDateTime(e.created_at)}</span>
              </div>
              <div className="mt-2 space-y-1">
                {Object.entries(e.data ?? {})
                  .filter(([, v]) => (v ?? "").toString().trim())
                  .map(([k, v]) => (
                    <p key={k} className="text-xs">
                      <span className="text-muted-foreground">{k}: </span>
                      {v}
                    </p>
                  ))}
              </div>
              {e.link ? (
                <Button asChild size="sm" variant="outline" className="mt-2">
                  <a href={e.link} target="_blank" rel="noopener noreferrer">
                    🔗 Abrir evidência
                  </a>
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Histórico de tentativas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {events.length === 0 ? <p className="text-muted-foreground">Sem eventos registrados.</p> : null}
          {events.map((ev) => (
            <div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-1">
              <span>
                {eventText(ev, names)} · tentativa {ev.attempt}
                {ev.note ? ` — ${ev.note}` : ""}
              </span>
              <span className="text-xs text-muted-foreground">{fmtDateTime(ev.created_at)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SubmissionDetailPage() {
  const { runId } = Route.useParams();
  return (
    <SubmissionDetail
      runId={runId}
      backTo={
        <Link to="/student/missions" className="text-xs text-muted-foreground hover:underline">
          ← Minhas missões
        </Link>
      }
    />
  );
}
