import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useRole, useSession } from "@/lib/auth";
import { ConceptBadge, type Concept } from "@/components/ConceptBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | QA Academy — UC10" },
      {
        name: "description",
        content: "Acompanhe turmas, grupos e os indicadores I1–I6 da UC10 na QA Academy.",
      },
      { property: "og:title", content: "Dashboard | QA Academy — UC10" },
      {
        property: "og:description",
        content: "Visão geral de turmas, alunos, grupos e indicadores da UC10.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function useIndicators() {
  return useQuery({
    queryKey: ["indicators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicators")
        .select("*")
        .eq("uc_code", "UC10")
        .order("position");
      if (error) throw error;
      return data;
    },
  });
}

function Dashboard() {
  const { data: role, isLoading } = useRole();
  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  return role === "instructor" ? <InstructorDashboard /> : <StudentDashboard />;
}

function UcHeader() {
  return (
    <div className="mb-6 rounded-xl border border-border bg-surface p-6">
      <span className="text-xs font-semibold uppercase tracking-widest text-accent">
        Unidade curricular
      </span>
      <h1 className="mt-1 text-2xl font-bold">
        UC10 – Realizar testes nas aplicações desenvolvidas
      </h1>
    </div>
  );
}

function StudentDashboard() {
  const { user } = useSession();
  const { data: profile } = useProfile();
  const { data: indicators } = useIndicators();

  const { data: enrollment } = useQuery({
    queryKey: ["my-enrollment", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("class_id, classes(id, name, period)")
        .eq("student_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: evaluations } = useQuery({
    queryKey: ["my-evaluations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicator_evaluations")
        .select("indicator_id, concept, final_result")
        .eq("student_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  const byIndicator = new Map((evaluations ?? []).map((e) => [e.indicator_id, e]));
  const total = indicators?.length ?? 0;
  const met = (evaluations ?? []).filter((e) => e.concept === "A").length;
  const progress = total ? Math.round((met / total) * 100) : 0;

  return (
    <div>
      <UcHeader />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Aluno</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {profile?.full_name || profile?.email}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Turma</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {enrollment?.classes?.name ?? "Sem turma"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Progresso da UC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 text-lg font-semibold">{progress}%</div>
            <Progress value={progress} />
            <p className="mt-2 text-xs text-muted-foreground">
              {met} de {total} indicadores atendidos
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Indicadores I1 – I6</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(indicators ?? []).map((ind) => {
            const ev = byIndicator.get(ind.id);
            return (
              <div
                key={ind.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
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
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function InstructorDashboard() {
  const { user } = useSession();
  const { data: indicators } = useIndicators();

  const { data: classes } = useQuery({
    queryKey: ["my-classes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, period, enrollments(id), groups(id)")
        .eq("instructor_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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
      <UcHeader />
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
                to="/turmas/$classId"
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
            <CardTitle>Visão inicial dos indicadores</CardTitle>
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
