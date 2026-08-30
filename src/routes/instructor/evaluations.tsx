import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useIndicators, useMyClasses } from "@/lib/uc10";
import { ConceptBadge, type Concept } from "@/components/ConceptBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/instructor/evaluations")({
  head: () => ({
    meta: [
      { title: "Avaliações | QA Academy" },
      { name: "description", content: "Acompanhe os conceitos A, PA e NA dos indicadores I1–I6." },
      { property: "og:title", content: "Avaliações | QA Academy" },
      { property: "og:description", content: "Situação das avaliações da UC10 por aluno." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvaluationsPage,
});

function EvaluationsPage() {
  const { user } = useAuth();
  const { data: classes } = useMyClasses(user?.id ?? null);
  const { data: indicators } = useIndicators();
  const classIds = (classes ?? []).map((c) => c.id);
  const studentIds = (classes ?? []).flatMap((c) => (c.enrollments ?? []).map((e) => e.student_id));

  const { data: profiles } = useQuery({
    queryKey: ["eval-profiles", studentIds.sort().join(",")],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", studentIds);
      if (error) throw error;
      return data;
    },
  });

  const { data: evaluations } = useQuery({
    queryKey: ["evaluations", classIds.join(",")],
    enabled: classIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicator_evaluations")
        .select("student_id, indicator_id, concept, final_result")
        .in("class_id", classIds);
      if (error) throw error;
      return data;
    },
  });

  const key = (s: string, i: string) => `${s}:${i}`;
  const map = new Map((evaluations ?? []).map((e) => [key(e.student_id, e.indicator_id), e]));

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Avaliações</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Situação atual dos indicadores I1–I6 por aluno (A / PA / NA e resultado D / ND).
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Panorama</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="p-2">Aluno</th>
                {(indicators ?? []).map((i) => (
                  <th key={i.id} className="p-2">
                    {i.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(profiles ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-2 font-medium">{p.full_name || p.email}</td>
                  {(indicators ?? []).map((i) => {
                    const ev = map.get(key(p.id, i.id));
                    return (
                      <td key={i.id} className="p-2">
                        <ConceptBadge concept={ev?.concept as Concept} />
                      </td>
                    );
                  })}
                </tr>
              ))}
              {(profiles ?? []).length === 0 && (
                <tr>
                  <td className="p-2 text-muted-foreground" colSpan={7}>
                    Nenhum aluno matriculado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
