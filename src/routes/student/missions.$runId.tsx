import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConceptBadge, type Concept } from "@/components/ConceptBadge";
import {
  blockDef,
  entryFieldLabel,
  HIDDEN_ENTRY_KEYS,
  type ChecklistItemDef,
  type Section,
} from "@/lib/mission-builder";
import {
  eventText,
  answerSummary,
  fmtDateTime,
  runSituation,
  useRunEvaluations,
  useSubmission,
  type BlockResult,
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
  const { data: evaluations, isPending: evaluationsPending } = useRunEvaluations(runId);

  if (isPending || evaluationsPending) return <p className="text-sm text-muted-foreground">Carregando envio...</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Envio não encontrado.</p>;

  const { run, entries, events, members, names } = data;
  const sections = (run.mission?.sections ?? []) as Section[];
  const sit = runSituation(run);
  const answers = answerSummary(sections, run.answers);
  const answersBySection = new Map(answers.map((answer) => [answer.section.id, answer.pairs]));
  const entriesBySection = new Map(
    sections.map((section) => [section.id, entries.filter((entry) => entry.section_id === section.id)]),
  );
  const currentEvaluation = evaluations?.find((evaluation) => evaluation.is_current) ?? null;
  const resultsBySection = new Map(
    (currentEvaluation?.block_results ?? []).map((result) => [result.section_id, result]),
  );

  function BlockEvaluation({ result }: { result: BlockResult | undefined }) {
    const concepts = Object.entries(result?.indicators ?? {}).filter(([, concept]) => concept);
    if (!result || concepts.length === 0) return null;
    const needsAttention = concepts.some(([, concept]) => concept === "PA" || concept === "NA");

    return (
      <div
        className={`mb-4 border-l-4 p-3 ${
          needsAttention ? "border-warning bg-warning/10" : "border-success bg-success/10"
        }`}
      >
        <p className="text-xs font-semibold text-muted-foreground">Resultado do bloco</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {concepts.map(([code, concept]) => (
            <span key={code} className="inline-flex items-center gap-1.5 text-xs">
              <span className="font-semibold">{code}</span>
              <ConceptBadge concept={concept as Concept} full />
            </span>
          ))}
        </div>
        {result.comment.trim() ? (
          <div className={`mt-3 border-t pt-3 ${needsAttention ? "border-warning/30" : "border-success/30"}`}>
            <p className="text-xs font-semibold">Feedback do instrutor</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{result.comment}</p>
            {needsAttention ? (
              <p className="mt-2 text-xs font-medium text-warning">Revise este bloco seguindo as orientações acima.</p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

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

      {run.eval_status === "reeval" ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Em reavaliação pelo instrutor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Sua entrega continua registrada e nada foi perdido. O instrutor está analisando novamente esta missão
              com o novo modelo de avaliação da UC10.
            </p>
            {run.feedback ? (
              <div className="rounded-md border border-border bg-surface p-3">
                <p className="text-xs font-semibold text-muted-foreground">Avaliação anterior</p>
                <p className="mt-1 whitespace-pre-wrap">{run.feedback}</p>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              As menções A/PA/NA voltam a aparecer em “Minha Avaliação” assim que a reavaliação for concluída.
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

      {sections.map((section) => {
        const result = resultsBySection.get(section.id);
        const pairs = answersBySection.get(section.id) ?? [];
        const sectionEntries = entriesBySection.get(section.id) ?? [];
        const checklistItems = section.kind === "checklist" ? ((section.items ?? []) as ChecklistItemDef[]) : [];
        const hasSubmittedContent = checklistItems.length > 0 || pairs.length > 0 || sectionEntries.length > 0;
        if (!result && !hasSubmittedContent) return null;

        return (
          <Card key={section.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {blockDef(section.kind).icon} {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <BlockEvaluation result={result} />

              {checklistItems.map((item) => (
                <p key={item.id} className={run.checklist_state?.[item.id] ? "" : "text-muted-foreground"}>
                  {run.checklist_state?.[item.id] ? "☑" : "☐"} {item.label}
                </p>
              ))}

              {pairs.map((pair) => (
                <div key={pair.label}>
                  <p className="text-xs font-semibold text-muted-foreground">{pair.label}</p>
                  <p className="whitespace-pre-wrap">{pair.value}</p>
                </div>
              ))}

              {sectionEntries.map((e) => (
                <div key={e.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">
                  {blockDef(e.kind).icon} {e.title || blockDef(e.kind).label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {names[e.author_id] ?? "Autor não registrado"} · {fmtDateTime(e.created_at)}
                </span>

              </div>
              {e.parent_id ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Vinculado ao caso de teste{" "}
                  {entries.find((x) => x.id === e.parent_id)?.title
                    ? `“${entries.find((x) => x.id === e.parent_id)?.title}”`
                    : "registrado nesta missão"}
                  .
                </p>
              ) : null}
              <div className="mt-2 space-y-1">
                {Object.entries(e.data ?? {})
                  .filter(([k, v]) => !HIDDEN_ENTRY_KEYS.includes(k) && (v ?? "").toString().trim())
                  .map(([k, v]) => (
                    <p key={k} className="text-xs">
                      <span className="text-muted-foreground">{entryFieldLabel(e.kind, k)}: </span>
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

              {!hasSubmittedContent ? (
                <p className="text-muted-foreground">Nenhum conteúdo registrado neste bloco.</p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      {run.eval_status === "evaluated" || run.feedback ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resultado geral da missão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Situação: {sit.label} · XP concedido: {run.xp_awarded ?? 0} · Avaliada em {fmtDateTime(run.evaluated_at)}
            </p>
            {run.feedback ? (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Feedback geral do instrutor</p>
                <p className="mt-1 whitespace-pre-wrap">{run.feedback}</p>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              A/PA/NA são menções formativas: mostram seu desenvolvimento naquele momento e podem evoluir com novas
              evidências. As menções aparecem em “Minha Avaliação”.
            </p>
          </CardContent>
        </Card>
      ) : null}

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
