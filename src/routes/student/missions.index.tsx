import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useMissions, useMyRuns } from "@/lib/techeduca";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/student/missions/")({
  head: () => ({
    meta: [
      { title: "Minhas Missões | QA Academy" },
      {
        name: "description",
        content: "Trilha TechEduca: missões guiadas individuais de testes de software.",
      },
      { property: "og:title", content: "Minhas Missões | QA Academy" },
      {
        property: "og:description",
        content: "Prática individual guiada da trilha TechEduca na QA Academy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MissionsPage,
});

function MissionsPage() {
  const { user } = useAuth();
  const { data: missions, isPending } = useMissions();
  const { data: runs } = useMyRuns(user?.id ?? null);
  const byMission = new Map((runs ?? []).map((r) => [r.mission_id, r]));

  return (
    <div className="max-w-4xl">
      <div className="mb-6 rounded-xl border border-border bg-surface p-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">
          Trilha TechEduca
        </span>
        <h1 className="mt-1 text-2xl font-bold">Minhas Missões</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Prática individual guiada: você executa a atividade no seu computador e mantém seus
          próprios registros e evidências.
        </p>
      </div>

      {isPending && <p className="text-sm text-muted-foreground">Carregando missões...</p>}

      <div className="space-y-4">
        {(missions ?? []).map((m) => {
          const run = byMission.get(m.id);
          const done = Object.values(run?.checklist_state ?? {}).filter(Boolean).length;
          const pct = m.checklist.length ? Math.round((done / m.checklist.length) * 100) : 0;
          return (
            <Card key={m.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{m.title}</CardTitle>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    {run?.status === "completed" ? "Concluída" : run ? "Em andamento" : "Não iniciada"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{m.objective}</p>
                <div className="flex flex-wrap gap-1">
                  {m.indicator_codes.map((c) => (
                    <span
                      key={c}
                      className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-primary"
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <div>
                  <Progress value={pct} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {done} de {m.checklist.length} etapas do checklist
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link to="/student/missions/$code" params={{ code: m.code }}>
                    {run ? "Continuar missão" : "Iniciar missão"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
