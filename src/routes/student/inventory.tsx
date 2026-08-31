import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useMyGroups } from "@/lib/cafe";
import { NativeSelect } from "@/components/qa/TestCasesPanel";
import { InventoryPanel } from "@/components/qa/InventoryPanel";
import type { AppProject } from "@/lib/inventory";
import type { QaScope } from "@/lib/qa";

export const Route = createFileRoute("/student/inventory")({
  head: () => ({
    meta: [
      { title: "Inventário da Aplicação | QA Academy" },
      {
        name: "description",
        content:
          "Funcionalidades-base e adicionais do TechEduca e do Café Central, usadas como objeto de teste na UC10.",
      },
      { property: "og:title", content: "Inventário da Aplicação | QA Academy" },
      {
        property: "og:description",
        content: "Só é requisito o que existe no escopo do projeto: veja o inventário antes de testar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: groups } = useMyGroups(userId);
  const [value, setValue] = useState("techeduca");

  const groupId = value.startsWith("cafe:") ? value.replace("cafe:", "") : null;
  const project: AppProject = groupId ? "cafe_central" : "techeduca";
  const group = (groups ?? []).find((g) => g.id === groupId) ?? null;
  const isQaLead = !!group && group.qa_lead_id === userId;

  const scope: QaScope = useMemo(
    () => (groupId ? { context: "cafe", groupId } : { context: "techeduca", groupId: null }),
    [groupId],
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Inventário da Aplicação</h1>
        <p className="text-sm text-muted-foreground">
          O objeto de teste é a aplicação que realmente existe. Consulte o inventário antes de planejar
          casos, registrar bugs ou montar o plano de testes.
        </p>
      </div>

      <div className="max-w-md">
        <NativeSelect
          id="inv-scope"
          value={value}
          onChange={setValue}
          options={[
            { value: "techeduca", label: "TechEduca — prática individual guiada" },
            ...(groups ?? []).map((g) => ({ value: `cafe:${g.id}`, label: `Café Central — ${g.name}` })),
          ]}
        />
      </div>

      <InventoryPanel
        project={project}
        groupId={groupId}
        userId={userId}
        canManage={isQaLead}
        scope={scope}
      />
    </div>
  );
}
