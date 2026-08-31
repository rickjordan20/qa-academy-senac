import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/qa/TestCasesPanel";
import {
  PROJECT_SCOPE,
  featureKindLabel,
  projectLabel,
  useCreateFeature,
  useDeleteFeature,
  useFeatures,
  type AppProject,
} from "@/lib/inventory";
import { useBugs, useTestCases, type QaScope } from "@/lib/qa";

const empty = { code: "", name: "", description: "", origin: "Melhoria implementada pelo grupo" };

export function InventoryPanel({
  project,
  groupId,
  userId,
  canManage = false,
  scope,
}: {
  project: AppProject;
  groupId: string | null;
  userId: string | null;
  canManage?: boolean;
  scope?: QaScope;
}) {
  const { data: features, isPending } = useFeatures(project, groupId);
  const create = useCreateFeature(project, groupId, userId);
  const remove = useDeleteFeature();
  const [form, setForm] = useState({ ...empty });
  const [open, setOpen] = useState(false);

  const coverageScope: QaScope = scope ?? { context: "techeduca", groupId: null };
  const { data: cases } = useTestCases(coverageScope, userId);
  const { data: bugs } = useBugs(coverageScope, userId);

  const base = (features ?? []).filter((f) => f.kind === "base");
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
      toast.error("Informe código e nome da funcionalidade.");
      return;
    }
    try {
      await create.mutateAsync({
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        origin: form.origin.trim(),
      });
      setForm({ ...empty });
      setOpen(false);
      toast.success("Funcionalidade adicional cadastrada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Inventário da Aplicação — {projectLabel(project)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>Modalidade: {PROJECT_SCOPE[project].modality}</p>
          <p>{PROJECT_SCOPE[project].note}</p>
          <p className="text-xs">
            A ausência de uma funcionalidade que nunca fez parte do escopo não é bug e não gera PA ou NA.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Funcionalidades-base</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isPending && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {base.map((f) => (
            <FeatureRow key={f.id} code={f.code} name={f.name} description={f.description} kind={f.kind} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm text-muted-foreground">Funcionalidades adicionais</CardTitle>
          {canManage && groupId && (
            <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
              {open ? "Fechar" : "+ Adicionar funcionalidade"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {open && canManage && groupId && (
            <form onSubmit={submit} className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
              <Field label="Código" id="ft-code">
                <Input
                  id="ft-code"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="Ex.: CF-08"
                />
              </Field>
              <Field label="Nome" id="ft-name">
                <Input
                  id="ft-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex.: Carrinho"
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
                  {create.isPending ? "Salvando..." : "Cadastrar funcionalidade adicional"}
                </Button>
              </div>
            </form>
          )}

          {extra.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma funcionalidade adicional cadastrada. Isso é normal: funcionalidades extras são opcionais.
            </p>
          )}
          {extra.map((f) => (
            <FeatureRow
              key={f.id}
              code={f.code}
              name={f.name}
              description={f.description}
              kind={f.kind}
              origin={f.origin}
              onDelete={
                canManage
                  ? () =>
                      remove.mutate(f.id, {
                        onSuccess: () => toast.success("Funcionalidade removida."),
                        onError: (e) => toast.error(e.message),
                      })
                  : undefined
              }
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Escopo dos testes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
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
  origin?: string;
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
