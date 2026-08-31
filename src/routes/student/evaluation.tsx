import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useIndicators, useMyEvaluations } from "@/lib/uc10";
import {
  stageLabel,
  useEvalHistory,
  useFeedbacks,
  useMyRecoveryPlans,
  useMyUcResult,
  type IndicatorRow,
} from "@/lib/assessment";
import { ConceptBadge, type Concept } from "@/components/ConceptBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/student/evaluation")({
  head: () => ({
    meta: [
      { title: "Minha avaliação | QA Academy" },
      { name: "description", content: "Conceitos A/PA/NA, feedbacks, recuperação e resultado D/ND." },
      { property: "og:title", content: "Minha avaliação | QA Academy" },
      { property: "og:description", content: "Avaliação da UC10 por indicador, com histórico." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvaluationPage,
});

function EvaluationPage() {
  const { user } = useAuth();
  const { data: indicators } = useIndicators();
  const { data: evaluations } = useMyEvaluations(user?.id ?? null);
  const { data: feedbacks } = useFeedbacks(user?.id ?? null);
  const { data: history } = useEvalHistory(user?.id ?? null);
  const { data: plans } = useMyRecoveryPlans(user?.id ?? null);
  const { data: result } = useMyUcResult(user?.id ?? null);

  const inds = (indicators ?? []) as IndicatorRow[];
  const byIndicator = new Map((evaluations ?? []).map((e) => [e.indicator_id, e]));
  const codeOf = new Map(inds.map((i) => [i.id, i.code]));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Minha avaliação</h1>
        <p className="text-sm text-muted-foreground">
          Somente o instrutor registra conceitos e o resultado final.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resultado da UC10</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {result?.final_result
            ? result.final_result === "D"
              ? "D – Desenvolveu"
              : "ND – Não desenvolveu"
            : "Ainda não fechado pelo instrutor."}
        </CardContent>
      </Card>

      {(plans ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recuperação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(plans ?? []).map((p) => (
              <div key={p.id} className="rounded-lg border border-border p-3">
                <div className="font-medium">{p.title}</div>
                <p className="text-xs text-muted-foreground">
                  Indicadores: {p.indicator_ids.map((id) => codeOf.get(id) ?? "?").join(", ")} ·{" "}
                  {p.status === "closed" ? "Encerrado" : "Em andamento"}
                </p>
                <p className="mt-1 text-xs">{p.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Indicadores I1 – I6</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {inds.map((ind) => {
            const ev = byIndicator.get(ind.id);
            const indFeedbacks = (feedbacks ?? []).filter((f) => f.indicator_id === ind.id);
            const indHistory = (history ?? []).filter((h) => h.indicator_id === ind.id);
            return (
              <div key={ind.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="mr-2 font-semibold text-primary">{ind.code}</span>
                    <span className="text-sm text-muted-foreground">{ind.description}</span>
                  </div>
                  <ConceptBadge concept={ev?.concept as Concept} />
                </div>
                {ev?.notes && <p className="mt-2 text-xs text-muted-foreground">{ev.notes}</p>}
                {indFeedbacks.map((f) => (
                  <p key={f.id} className="mt-2 rounded-md bg-surface p-2 text-xs">
                    {f.message}
                  </p>
                ))}
                {indHistory.length > 1 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Histórico:{" "}
                    {indHistory
                      .map((h) => `${h.concept ?? "—"} (${stageLabel(h.stage)})`)
                      .reverse()
                      .join(" → ")}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
