import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useMyGroups } from "@/lib/cafe";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect, type PersonOption } from "@/components/qa/TestCasesPanel";
import { TestCasesPanel } from "@/components/qa/TestCasesPanel";
import { BugsPanel } from "@/components/qa/BugsPanel";
import { EvidencesPanel } from "@/components/qa/EvidencesPanel";
import { TraceabilityPanel } from "@/components/qa/TraceabilityPanel";
import type { QaScope } from "@/lib/qa";

type QaSearch = { scope?: string; backMission?: string; backLabel?: string };

export const Route = createFileRoute("/student/qa")({
  validateSearch: (search: Record<string, unknown>): QaSearch => {
    const out: QaSearch = {};
    if (typeof search["scope"] === "string") out.scope = search["scope"];
    if (typeof search["backMission"] === "string") out.backMission = search["backMission"];
    if (typeof search["backLabel"] === "string") out.backLabel = search["backLabel"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Módulos QA | QA Academy" },
      {
        name: "description",
        content:
          "Casos de teste, central de bugs, evidências, reteste e rastreabilidade nos contextos TechEduca e Café Central.",
      },
      { property: "og:title", content: "Módulos QA | QA Academy" },
      {
        property: "og:description",
        content: "Gerencie casos de teste, bugs, evidências e retestes com rastreabilidade completa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QaPage,
});

function QaPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: groups } = useMyGroups(userId);
  const { scope: scopeParam, backMission, backLabel } = Route.useSearch();
  const [scopeValue, setScopeValue] = useState(scopeParam ?? "techeduca");

  const scope: QaScope = useMemo(
    () =>
      scopeValue === "techeduca"
        ? { context: "techeduca", groupId: null }
        : { context: "cafe", groupId: scopeValue.replace("cafe:", "") },
    [scopeValue],
  );

  const people: PersonOption[] = useMemo(() => {
    if (scope.context === "techeduca") return user ? [{ id: user.id, name: "Eu" }] : [];
    const g = (groups ?? []).find((x) => x.id === scope.groupId);
    return (g?.members ?? []).map((m) => ({ id: m.student_id, name: m.full_name || m.email }));
  }, [scope, groups, user]);

  return (
    <div className="max-w-5xl space-y-6">
      {backMission ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3">
          <span className="text-sm text-muted-foreground">
            Você veio de “{backLabel ?? "Revisão e Auditoria"}”.
          </span>
          <Button asChild size="sm" variant="outline">
            <Link to="/student/activities/$missionId" params={{ missionId: backMission }}>
              ← Voltar para {backLabel ?? "Revisão e Auditoria"}
            </Link>
          </Button>
        </div>
      ) : null}

      <div>
        <h1 className="mb-2 text-2xl font-bold">Módulos QA</h1>
        <p className="text-sm text-muted-foreground">
          Casos de teste, bugs, evidências, reteste e rastreabilidade. No TechEduca os registros são
          individuais; no Café Central são do grupo, sempre com autoria individual.
        </p>
      </div>

      <div className="max-w-md">
        <NativeSelect
          id="qa-scope"
          value={scopeValue}
          onChange={setScopeValue}
          options={[
            { value: "techeduca", label: "TechEduca — meus registros individuais" },
            ...(groups ?? []).map((g) => ({ value: `cafe:${g.id}`, label: `Café Central — ${g.name}` })),
          ]}
        />
      </div>

      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases">Casos de teste</TabsTrigger>
          <TabsTrigger value="bugs">Central de bugs</TabsTrigger>
          <TabsTrigger value="evidences">Evidências</TabsTrigger>
          <TabsTrigger value="trace">Rastreabilidade</TabsTrigger>
        </TabsList>
        <TabsContent value="cases" className="mt-4">
          <TestCasesPanel
            scope={scope}
            userId={userId}
            people={people}
            backMission={backMission}
            backLabel={backLabel}
          />
        </TabsContent>
        <TabsContent value="bugs" className="mt-4">
          <BugsPanel scope={scope} userId={userId} people={people} />
        </TabsContent>
        <TabsContent value="evidences" className="mt-4">
          <EvidencesPanel scope={scope} userId={userId} />
        </TabsContent>
        <TabsContent value="trace" className="mt-4">
          <TraceabilityPanel scope={scope} userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
