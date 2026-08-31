import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyClasses } from "@/lib/uc10";
import { useInstructorGroups } from "@/lib/cafe";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect, TestCasesPanel } from "@/components/qa/TestCasesPanel";
import { BugsPanel } from "@/components/qa/BugsPanel";
import { EvidencesPanel } from "@/components/qa/EvidencesPanel";
import { TraceabilityPanel } from "@/components/qa/TraceabilityPanel";
import type { QaScope } from "@/lib/qa";

export const Route = createFileRoute("/instructor/qa")({
  head: () => ({
    meta: [
      { title: "Módulos QA | QA Academy" },
      {
        name: "description",
        content: "Acompanhe casos de teste, bugs, evidências e retestes dos alunos e dos grupos.",
      },
      { property: "og:title", content: "Módulos QA | QA Academy" },
      {
        property: "og:description",
        content: "Visão do instrutor sobre casos, bugs, evidências, retestes e rastreabilidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InstructorQaPage,
});

function InstructorQaPage() {
  const { user } = useAuth();
  const { data: classes } = useMyClasses(user?.id ?? null);
  const { data: groups } = useInstructorGroups(user?.id ?? null);
  const [value, setValue] = useState("");

  const studentIds = (classes ?? []).flatMap((c) => (c.enrollments ?? []).map((e) => e.student_id));
  const { data: profiles } = useQuery({
    queryKey: ["qa-instructor-students", studentIds.sort().join(",")],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", studentIds);
      if (error) throw error;
      return data as { id: string; full_name: string | null; email: string }[];
    },
  });

  const options = [
    { value: "", label: "Selecione um aluno ou grupo" },
    ...(profiles ?? []).map((p) => ({
      value: `student:${p.id}`,
      label: `TechEduca — ${p.full_name?.trim() || p.email}`,
    })),
    ...(groups ?? []).map((g) => ({ value: `cafe:${g.id}`, label: `Café Central — ${g.name}` })),
  ];

  const scope: QaScope | null = useMemo(() => {
    if (value.startsWith("cafe:")) return { context: "cafe", groupId: value.slice(5) };
    if (value.startsWith("student:")) return { context: "techeduca", groupId: null };
    return null;
  }, [value]);

  const viewUserId = value.startsWith("student:") ? value.slice(8) : null;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Módulos QA</h1>
        <p className="text-sm text-muted-foreground">
          Visualize os casos de teste, bugs, evidências e retestes de cada aluno (TechEduca) ou de cada
          grupo (Café Central), sempre com a autoria individual preservada.
        </p>
      </div>

      <div className="max-w-md">
        <NativeSelect id="qa-target" value={value} onChange={setValue} options={options} />
      </div>

      {!scope && <p className="text-sm text-muted-foreground">Escolha um aluno ou grupo para começar.</p>}

      {scope && (
        <Tabs defaultValue="cases">
          <TabsList>
            <TabsTrigger value="cases">Casos de teste</TabsTrigger>
            <TabsTrigger value="bugs">Central de bugs</TabsTrigger>
            <TabsTrigger value="evidences">Evidências</TabsTrigger>
            <TabsTrigger value="trace">Rastreabilidade</TabsTrigger>
          </TabsList>
          <TabsContent value="cases" className="mt-4">
            <TestCasesPanel scope={scope} userId={viewUserId} readOnly />
          </TabsContent>
          <TabsContent value="bugs" className="mt-4">
            <BugsPanel scope={scope} userId={viewUserId} readOnly />
          </TabsContent>
          <TabsContent value="evidences" className="mt-4">
            <EvidencesPanel scope={scope} userId={viewUserId} readOnly />
          </TabsContent>
          <TabsContent value="trace" className="mt-4">
            <TraceabilityPanel scope={scope} userId={viewUserId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
