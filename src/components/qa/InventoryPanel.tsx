import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, NativeSelect } from "@/components/qa/TestCasesPanel";
import {
  PROJECT_SCOPE,
  featureKindLabel,
  friendlyFeatureError,

  groupByModule,
  projectLabel,
  useCreateFeature,
  useDeleteFeature,
  useDeleteModule,
  useFeatures,
  useModules,
  useSaveModule,
  useUpdateFeature,
  type AppFeature,
  type AppProject,
} from "@/lib/inventory";
import { useBugs, useTestCases, type QaScope } from "@/lib/qa";

const empty = {
  code: "",
  name: "",
  description: "",
  origin: "Melhoria implementada pelo grupo",
  module_id: "",
};

export function InventoryPanel({
  project,
  groupId,
  userId,
  canManage = false,
  canDelete = false,
  canManageBase = false,
  groupName,
  scope,
}: {
  project: AppProject;
  groupId: string | null;
  userId: string | null;
  canManage?: boolean;
  canDelete?: boolean;
  canManageBase?: boolean;
  groupName?: string | null;
  scope?: QaScope;
}) {
  const { data: features, isPending } = useFeatures(project, groupId);
  const { data: modules } = useModules(project, groupId);
  const create = useCreateFeature(project, groupId, userId);
  const saveModule = useSaveModule();
  const removeModule = useDeleteModule();
  const updateFeature = useUpdateFeature();
  const remove = useDeleteFeature();
  const [form, setForm] = useState({ ...empty });
  const [open, setOpen] = useState(false);
  const [moduleName, setModuleName] = useState("");
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});


  const coverageScope: QaScope = scope ?? { context: "techeduca", groupId: null };
  const { data: cases } = useTestCases(coverageScope, userId);
  const { data: bugs } = useBugs(coverageScope, userId);

  const { tree, orphans } = groupByModule(modules ?? [], features ?? []);
  const extra = (features ?? []).filter((f) => f.kind === "additional");
  const testedIds = new Set(
    [...(cases ?? []), ...(bugs ?? [])]
      .map((r) => (r as { feature_id?: string | null }).feature_id)
      .filter(Boolean) as string[],
  );
  const tested = (features ?? []).filter((f) => testedIds.has(f.id));
  const notTested = (features ?? []).filter((f) => !testedIds.has(f.id));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Informe código e nome do requisito.");
      return;
    }
    if (!form.module_id) {
      toast.error("Selecione a Tela/Módulo do requisito.");
      return;
    }
    try {
      await create.mutateAsync({
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        origin: form.origin.trim(),
        module_id: form.module_id,
      });
      setForm({ ...empty });
      setOpen(false);
      toast.success("Requisito cadastrado com sucesso");
    } catch (err) {
      toast.error(friendlyFeatureError(err));
    }
  }

  async function addModule() {
    if (!moduleName.trim()) return;
    try {
      await saveModule.mutateAsync({
        values: {
          project,
          group_id: groupId,
          name: moduleName.trim(),
          position: (modules ?? []).length + 1,
          created_by: userId,
        },
      });
      setModuleName("");
      toast.success("Módulo/Tela criado.");
    } catch (err) {
      toast.error(friendlyFeatureError(err));
    }
  }

  async function renameModule(id: string, values: { name: string; description: string }) {
    try {
      await saveModule.mutateAsync({ id, values });
      toast.success("Módulo/Tela atualizado.");
    } catch (err) {
      toast.error(friendlyFeatureError(err));
    }
  }

  async function deleteModule(id: string, count: number) {
    if (count > 0) {
      toast.error(
        `Este Módulo/Tela possui ${count} funcionalidade(s) vinculada(s). Exclua ou mova as funcionalidades antes.`,
      );
      return;
    }
    if (!window.confirm("Excluir este Módulo/Tela? Esta ação não pode ser desfeita.")) return;
    try {
      await removeModule.mutateAsync(id);
      toast.success("Módulo/Tela excluído.");
    } catch (err) {
      toast.error(friendlyFeatureError(err));
    }
  }

  async function saveFeature(id: string, values: Partial<AppFeature>) {
    try {
      await updateFeature.mutateAsync({ id, values });
      toast.success("Funcionalidade atualizada.");
    } catch (err) {
      toast.error(friendlyFeatureError(err));
    }
  }

  async function deleteFeature(id: string) {
    if (!window.confirm("Excluir esta funcionalidade? Esta ação não pode ser desfeita.")) return;
    try {
      await remove.mutateAsync(id);
      toast.success("Funcionalidade removida.");
    } catch (err) {
      toast.error(friendlyFeatureError(err));
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Inventário da Aplicação — {projectLabel(project)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {groupId ? (
            <p className="text-sm font-medium text-foreground">Grupo: {groupName || "—"}</p>
          ) : (
            <p className="text-sm font-medium text-foreground">
              Inventário de referência {project === "techeduca" ? "do TechEduca" : "do projeto"} — mantido
              pelo instrutor.
            </p>
          )}
          <p>Modalidade: {PROJECT_SCOPE[project].modality}</p>
          <p>{PROJECT_SCOPE[project].note}</p>

          <p className="text-xs">
            Hierarquia: Projeto → Módulo/Tela → Funcionalidade → Caso de teste → Execução → Bug →
            Evidência → Reteste.
          </p>
          <p className="text-xs">
            A ausência de uma funcionalidade que nunca fez parte do escopo não é bug e não gera PA ou NA.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm text-muted-foreground">Módulos/Telas e funcionalidades</CardTitle>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
              {open ? "Fechar" : "+ Nova funcionalidade"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {isPending && <p className="text-sm text-muted-foreground">Carregando...</p>}

          {canManage && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
              <div className="min-w-[220px] flex-1">
                <Field label="Novo Módulo/Tela" id="inv-mod-name">
                  <Input
                    id="inv-mod-name"
                    value={moduleName}
                    onChange={(e) => setModuleName(e.target.value)}
                    placeholder="Ex.: Cadastro"
                  />
                </Field>
              </div>
              <Button size="sm" onClick={addModule} disabled={saveModule.isPending}>
                + Novo Módulo/Tela
              </Button>
            </div>
          )}

          {open && canManage && (
            <form onSubmit={submit} className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
              <Field label="Módulo/Tela" id="ft-module">
                <NativeSelect
                  id="ft-module"
                  value={form.module_id}
                  onChange={(v) => setForm((f) => ({ ...f, module_id: v }))}
                  options={[
                    { value: "", label: "Selecione..." },
                    ...(modules ?? []).map((m) => ({ value: m.id, label: m.name })),
                  ]}
                />
              </Field>
              <Field label="Código" id="ft-code">
                <Input
                  id="ft-code"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="Ex.: CF-08"
                />
              </Field>
              <Field label="Nome da funcionalidade" id="ft-name">
                <Input
                  id="ft-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex.: Cadastrar usuário"
                />
              </Field>
              <Field label="Origem" id="ft-origin">
                <Input
                  id="ft-origin"
                  value={form.origin}
                  onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))}
                />
              </Field>
              <Field label="Descrição" id="ft-desc" full>
                <Textarea
                  id="ft-desc"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Salvando..." : "Cadastrar funcionalidade"}
                </Button>
              </div>
            </form>
          )}

          {tree.length === 0 && !isPending && (
            <p className="text-sm text-muted-foreground">Nenhum Módulo/Tela cadastrado neste projeto.</p>
          )}

          {tree.map(({ module, features: list }) => {
            const isClosed = collapsed[module.id] ?? false;
            const ownScope = module.group_id !== null || canManageBase;
            return (
              <div key={module.id} className="rounded-lg border border-border">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => ({ ...c, [module.id]: !isClosed }))}
                    className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
                  >
                    {isClosed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    📄 {module.name}
                    {module.status !== "active" && (
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">Inativo</span>
                    )}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {list.length} funcionalidade(s)
                    </span>
                  </button>
                  {canManage && ownScope && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditingModule((m) => (m === module.id ? null : module.id))
                        }
                      >
                        {editingModule === module.id ? "Cancelar" : "Editar"}
                      </Button>
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteModule(module.id, list.length)}
                        >
                          Excluir
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {editingModule === module.id && (
                  <ModuleEditForm
                    name={module.name}
                    description={module.description}
                    onCancel={() => setEditingModule(null)}
                    onSave={async (values) => {
                      await renameModule(module.id, values);
                      setEditingModule(null);
                    }}
                  />
                )}
                {!isClosed && (
                  <div className="space-y-2 border-t border-border p-3">
                    {module.description && (
                      <p className="text-xs text-muted-foreground">{module.description}</p>
                    )}
                    {list.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Nenhuma funcionalidade cadastrada neste módulo.
                      </p>
                    )}
                    {list.map((f) => {
                      const editable = canManage && (f.group_id !== null || canManageBase);
                      return (
                        <FeatureRow
                          key={f.id}
                          code={f.code}
                          name={f.name}
                          description={f.description}
                          kind={f.kind}
                          origin={f.kind === "additional" ? f.origin : undefined}
                          onSave={editable ? (values) => saveFeature(f.id, values) : undefined}
                          onDelete={editable && canDelete ? () => deleteFeature(f.id) : undefined}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}


          {orphans.length > 0 && (
            <div className="rounded-lg border border-dashed border-border p-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Sem Módulo/Tela associado — o instrutor pode fazer a associação manualmente.
              </p>
              <div className="space-y-2">
                {orphans.map((f) => (
                  <FeatureRow
                    key={f.id}
                    code={f.code}
                    name={f.name}
                    description={f.description}
                    kind={f.kind}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Escopo dos testes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>Módulos/Telas: {(modules ?? []).length}</p>
          <p>Funcionalidades previstas: {(features ?? []).length}</p>
          <p>Funcionalidades adicionais: {extra.length}</p>
          <p>Funcionalidades testadas: {tested.map((f) => f.code).join(", ") || "—"}</p>
          <p>Funcionalidades não testadas: {notTested.map((f) => f.code).join(", ") || "—"}</p>
          <p>Casos registrados: {(cases ?? []).length}</p>
          <p>Bugs registrados: {(bugs ?? []).length}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function FeatureRow({
  code,
  name,
  description,
  kind,
  origin,
  onDelete,
}: {
  code: string;
  name: string;
  description: string;
  kind: string;
  origin?: string | undefined;
  onDelete?: (() => void) | undefined;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border p-3">
      <div>
        <div className="text-sm font-medium">
          <span className="mr-2 font-mono text-xs text-muted-foreground">{code}</span>
          {name}
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {origin && <p className="text-xs text-muted-foreground">Origem: {origin}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">{featureKindLabel(kind)}</span>
        {onDelete && (
          <Button size="sm" variant="ghost" onClick={onDelete}>
            Excluir
          </Button>
        )}
      </div>
    </div>
  );
}
