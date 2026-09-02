import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useInstructorGroups } from "@/lib/cafe";
import { NativeSelect } from "@/components/qa/TestCasesPanel";
import { InventoryPanel } from "@/components/qa/InventoryPanel";
import type { AppProject } from "@/lib/inventory";
import type { QaScope } from "@/lib/qa";

export const Route = createFileRoute("/instructor/inventory")({
  head: () => ({
    meta: [
      { title: "Inventário das aplicações | QA Academy" },
      {
        name: "description",
        content: "Escopo real do TechEduca e do Café Central por grupo, com funcionalidades-base e adicionais.",
      },
      { property: "og:title", content: "Inventário das aplicações | QA Academy" },
      {
        property: "og:description",
        content: "Acompanhe o escopo de cada projeto e a cobertura de testes por funcionalidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InstructorInventoryPage,
});

function InstructorInventoryPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: groups } = useInstructorGroups(userId);
  const [value, setValue] = useState("techeduca");

  const groupId = value.startsWith("cafe:") ? value.replace("cafe:", "") : null;
  const project: AppProject = groupId ? "cafe_central" : "techeduca";

  const scope: QaScope = useMemo(
    () => (groupId ? { context: "cafe", groupId } : { context: "techeduca", groupId: null }),
    [groupId],
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Inventário das aplicações</h1>
        <p className="text-sm text-muted-foreground">
          Funcionalidades-base fixas e funcionalidades adicionais de cada grupo. Funcionalidade adicional é
          objeto de teste possível, nunca requisito avaliativo da UC10.
        </p>
      </div>

      <div className="max-w-md">
        <NativeSelect
          id="inv-scope"
          value={value}
          onChange={setValue}
          options={[
            { value: "techeduca", label: "TechEduca — escopo fixo" },
            ...(groups ?? []).map((g) => ({ value: `cafe:${g.id}`, label: `Café Central — ${g.name}` })),
          ]}
        />
      </div>

      <InventoryPanel
        project={project}
        groupId={groupId}
        userId={userId}
        canManage
        canDelete
        canManageBase
        groupName={(groups ?? []).find((g) => g.id === groupId)?.name ?? null}
        scope={scope}
      />
    </div>
  );
}
