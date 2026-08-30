import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyClasses } from "@/lib/uc10";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/instructor/students")({
  head: () => ({
    meta: [
      { title: "Alunos | QA Academy" },
      { name: "description", content: "Lista de alunos matriculados nas suas turmas da UC10." },
      { property: "og:title", content: "Alunos | QA Academy" },
      { property: "og:description", content: "Alunos por turma na QA Academy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentsPage,
});

function StudentsPage() {
  const { user } = useAuth();
  const { data: classes } = useMyClasses(user?.id ?? null);

  const ids = (classes ?? []).flatMap((c) => (c.enrollments ?? []).map((e) => e.student_id));

  const { data: profiles } = useQuery({
    queryKey: ["students-profiles", ids.sort().join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (error) throw error;
      return data;
    },
  });

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Alunos</h1>
      <div className="space-y-6">
        {(classes ?? []).map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {c.name}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({c.enrollments?.length ?? 0} alunos)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(c.enrollments ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum aluno nesta turma.</p>
              )}
              {(c.enrollments ?? []).map((e) => {
                const p = byId.get(e.student_id);
                return (
                  <div key={e.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="font-medium">{p?.full_name || "Sem nome"}</div>
                    <div className="text-xs text-muted-foreground">{p?.email}</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
        {(classes ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Crie uma turma para cadastrar alunos.</p>
        )}
      </div>
    </div>
  );
}
