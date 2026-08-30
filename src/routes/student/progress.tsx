import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useIndicators, useMyEvaluations } from "@/lib/uc10";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/student/progress")({
  head: () => ({
    meta: [
      { title: "Meu progresso | QA Academy" },
      { name: "description", content: "Percentual de indicadores atendidos na UC10." },
      { property: "og:title", content: "Meu progresso | QA Academy" },
      { property: "og:description", content: "Progresso do aluno nos indicadores I1–I6." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const { user } = useAuth();
  const { data: indicators } = useIndicators();
  const { data: evaluations } = useMyEvaluations(user?.id ?? null);

  const total = indicators?.length ?? 0;
  const count = (c: string) => (evaluations ?? []).filter((e) => e.concept === c).length;
  const progress = total ? Math.round((count("A") / total) * 100) : 0;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Meu progresso</h1>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Indicadores atendidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2 text-3xl font-bold text-accent">{progress}%</div>
          <Progress value={progress} />
          <p className="mt-2 text-xs text-muted-foreground">
            {count("A")} de {total} indicadores com conceito A
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["Atendido (A)", count("A")],
            ["Parcialmente atendido (PA)", count("PA")],
            ["Não atendido (NA)", count("NA")],
          ] as const
        ).map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{value}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
