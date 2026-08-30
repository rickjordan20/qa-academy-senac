import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyClasses } from "@/lib/uc10";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/instructor/groups")({
  head: () => ({
    meta: [
      { title: "Grupos | QA Academy" },
      { name: "description", content: "Grupos de trabalho, QA Leads e funções por turma na UC10." },
      { property: "og:title", content: "Grupos | QA Academy" },
      { property: "og:description", content: "Grupos e QA Leads das turmas da UC10." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const { user } = useAuth();
  const { data: classes } = useMyClasses(user?.id ?? null);
  const classIds = (classes ?? []).map((c) => c.id);

  const { data: groups } = useQuery({
    queryKey: ["instructor-groups", classIds.join(",")],
    enabled: classIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, class_id, qa_lead_id, group_members(id, student_id, member_function)")
        .in("class_id", classIds);
      if (error) throw error;
      const ids = Array.from(
        new Set(
          (data ?? []).flatMap((g) => [
            ...(g.qa_lead_id ? [g.qa_lead_id] : []),
            ...(g.group_members ?? []).map((m) => m.student_id),
          ]),
        ),
      );
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [] };
      const map = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));
      return (data ?? []).map((g) => ({ ...g, nameOf: map }));
    },
  });

  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Grupos</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        A criação e edição de grupos acontece dentro de cada turma.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {(groups ?? []).map((g) => (
          <Card key={g.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{g.name}</span>
                <Link
                  to="/instructor/classes/$classId"
                  params={{ classId: g.class_id }}
                  className="text-xs font-normal text-accent hover:underline"
                >
                  {classNameById.get(g.class_id)}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="text-xs text-accent">
                QA Lead: {g.qa_lead_id ? g.nameOf.get(g.qa_lead_id) : "não definido"}
              </div>
              {(g.group_members ?? []).map((m) => (
                <div key={m.id} className="flex justify-between rounded-md border border-border p-2">
                  <span>{g.nameOf.get(m.student_id) ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">{m.member_function}</span>
                </div>
              ))}
              {(g.group_members ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Sem integrantes.</p>
              )}
            </CardContent>
          </Card>
        ))}
        {(groups ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum grupo criado ainda.</p>
        )}
      </div>
    </div>
  );
}
