import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useIndicators, useMyEvaluations } from "@/lib/uc10";
import { ConceptBadge, type Concept } from "@/components/ConceptBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/student/journey")({
  head: () => ({
    meta: [
      { title: "Minha jornada | QA Academy" },
      { name: "description", content: "A trilha dos indicadores I1–I6 da UC10 na QA Academy." },
      { property: "og:title", content: "Minha jornada | QA Academy" },
      { property: "og:description", content: "Etapas da UC10 de testes de software." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JourneyPage,
});

function JourneyPage() {
  const { user } = useAuth();
  const { data: indicators } = useIndicators();
  const { data: evaluations } = useMyEvaluations(user?.id ?? null);
  const byIndicator = new Map((evaluations ?? []).map((e) => [e.indicator_id, e]));

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Minha jornada</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Cada etapa corresponde a um indicador da UC10.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trilha da UC10</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="relative space-y-4 border-l border-border pl-6">
            {(indicators ?? []).map((ind) => {
              const ev = byIndicator.get(ind.id);
              return (
                <li key={ind.id} className="relative">
                  <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-accent" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-primary">{ind.code}</div>
                      <p className="text-sm text-muted-foreground">{ind.description}</p>
                    </div>
                    <ConceptBadge concept={ev?.concept as Concept} />
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
