import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useIndicators, useMyEvaluations } from "@/lib/uc10";
import { ConceptBadge, type Concept } from "@/components/ConceptBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/student/evaluation")({
  head: () => ({
    meta: [
      { title: "Minha avaliação | QA Academy" },
      { name: "description", content: "Conceitos A/PA/NA e resultado D/ND registrados pelo instrutor." },
      { property: "og:title", content: "Minha avaliação | QA Academy" },
      { property: "og:description", content: "Avaliação da UC10 por indicador." },
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
  const byIndicator = new Map((evaluations ?? []).map((e) => [e.indicator_id, e]));

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Minha avaliação</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Somente o instrutor registra conceitos e o resultado final.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Indicadores I1 – I6</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(indicators ?? []).map((ind) => {
            const ev = byIndicator.get(ind.id);
            return (
              <div key={ind.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="mr-2 font-semibold text-primary">{ind.code}</span>
                    <span className="text-sm text-muted-foreground">{ind.description}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ConceptBadge concept={ev?.concept as Concept} />
                    {ev?.final_result && (
                      <span className="rounded-md border border-border px-2 py-0.5 text-xs">
                        {ev.final_result}
                      </span>
                    )}
                  </div>
                </div>
                {ev?.notes && <p className="mt-2 text-xs text-muted-foreground">{ev.notes}</p>}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
