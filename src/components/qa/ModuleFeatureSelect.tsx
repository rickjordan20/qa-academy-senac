import { Field, NativeSelect } from "@/components/qa/TestCasesPanel";
import {
  useFeatures,
  useModules,
  type AppFeature,
  type AppModule,
  type AppProject,
} from "@/lib/inventory";

/**
 * Seleção em cascata Módulo/Tela → Funcionalidade.
 * O segundo campo lista apenas as funcionalidades do módulo escolhido.
 */
export function ModuleFeatureSelect({
  project,
  groupId,
  moduleId,
  featureId,
  onChange,
  idPrefix = "mf",
}: {
  project: AppProject;
  groupId: string | null;
  moduleId: string;
  featureId: string;
  onChange: (v: { moduleId: string; featureId: string }) => void;
  idPrefix?: string;
}) {
  const { data: modules } = useModules(project, groupId);
  const { data: features } = useFeatures(project, groupId);

  const activeModules = (modules ?? []).filter((m) => m.status === "active" || m.id === moduleId);
  const moduleFeatures = (features ?? []).filter(
    (f) => f.module_id === moduleId && (f.status !== "inactive" || f.id === featureId),
  );

  return (
    <>
      <Field label="Módulo/Tela" id={`${idPrefix}-module`}>
        <NativeSelect
          id={`${idPrefix}-module`}
          value={moduleId}
          onChange={(v) => onChange({ moduleId: v, featureId: "" })}
          options={[
            { value: "", label: "Não relacionado" },
            ...activeModules.map((m) => ({ value: m.id, label: m.name })),
          ]}
        />
      </Field>
      <Field label="Funcionalidade" id={`${idPrefix}-feature`}>
        <NativeSelect
          id={`${idPrefix}-feature`}
          value={featureId}
          onChange={(v) => onChange({ moduleId, featureId: v })}
          options={[
            { value: "", label: moduleId ? "Não relacionada" : "Selecione um módulo primeiro" },
            ...moduleFeatures.map((f) => ({
              value: f.id,
              label: `${f.code} — ${f.name}${f.kind === "additional" ? " (adicional)" : ""}`,
            })),
          ]}
        />
      </Field>
    </>
  );
}

/** Texto de rastreabilidade: "Módulo/Tela → Funcionalidade". */
export function featureTrace(
  modules: AppModule[] | undefined,
  features: AppFeature[] | undefined,
  featureId: string | null,
) {
  const f = (features ?? []).find((x) => x.id === featureId);
  if (!f) return "—";
  const m = (modules ?? []).find((x) => x.id === f.module_id);
  return `${m ? `${m.name} → ` : ""}${f.code} — ${f.name}`;
}
