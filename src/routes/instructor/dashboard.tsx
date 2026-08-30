import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useIndicators, useMyClasses } from "@/lib/uc10";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/instructor/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard do instrutor | QA Academy" },
      { name: "description", content: "Visão geral de turmas, alunos, grupos e indicadores da UC10." },
      { property: "og:title", content: "Dashboard do instrutor | QA Academy" },
      { property: "og:description", content: "Acompanhe turmas e indicadores I1–I6 da UC10." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InstructorDashboard,
});

function InstructorDashboard() {
  const { user } = useAuth();
  const { data: classes } = useMyClasses(user?.id ?? null);
  const { data: indicators } = useIndicators();

  const { data: evaluations } = useQuery({
    queryKey: ["instructor-evaluations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicator_evaluations")
        .select("indicator_id, concept");
      if (error) throw error;
      return data;
    },
  });

  const totalStudents = (classes ?? []).reduce((n, c) => n + (c.enrollments?.length ?? 0), 0);
  const totalGroups = (classes ?? []).reduce((n, c) => n + (c.groups?.length ?? 0), 0);

  return (
    <div>
      <div className="mb-6 rounded-xl border border-border bg-surface p-6">
        <span className="text-xs font-semibold uppercase tracking-widest text-accent">
          Área do instrutor
        </span>
        <h1 className="mt-1 text-2xl font-bold">
          UC10 – Realizar testes nas aplicações desenvolvidas
        </h1>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Turmas" value={classes?.length ?? 0} />
        <StatCard label="Alunos" value={totalStudents} />
        <StatCard label="Grupos" value={totalGroups} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Minhas turmas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(classes ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma turma cadastrada ainda.</p>
            )}
            {(classes ?? []).map((c) => (
              <Link
                key={c.id}
                to="/instructor/classes/$classId"
                params={{ classId: c.id }}
                className="flex items-center justify-between rounded-lg border border-border p-3 hover:border-primary"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {c.enrollments?.length ?? 0} alunos
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Visão dos indicadores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(indicators ?? []).map((ind) => {
              const evs = (evaluations ?? []).filter((e) => e.indicator_id === ind.id);
              const count = (c: string) => evs.filter((e) => e.concept === c).length;
              return (
                <div
                  key={ind.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div className="text-sm">
                    <span className="mr-2 font-semibold text-primary">{ind.code}</span>
                    <span className="text-muted-foreground">{ind.description}</span>
                  </div>
                  <div className="flex gap-1 text-xs">
                    <span className="rounded bg-success px-2 py-0.5 text-success-foreground">
                      A {count("A")}
                    </span>
                    <span className="rounded bg-warning px-2 py-0.5 text-warning-foreground">
                      PA {count("PA")}
                    </span>
                    <span className="rounded bg-danger px-2 py-0.5 text-danger-foreground">
                      NA {count("NA")}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-bold text-accent">{value}</CardContent>
    </Card>
  );
}
