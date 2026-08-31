import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useInstructorGroups } from "@/lib/cafe";
import { NativeSelect } from "@/components/qa/TestCasesPanel";
import { AuditList } from "@/components/admin/AuditList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FEATURE_CATEGORY,
  FEATURE_ORIGIN,
  FEATURE_STATUS,
  labelOf,
  useDeleteFeatureSafe,
  useFeatureSuggestions,
  useManagedFeatures,
  useReorderFeature,
  useReviewSuggestion,
  useSaveFeature,
  type ManagedFeature,
} from "@/lib/admin";

export const Route = createFileRoute("/instructor/features")({
  head: () => ({
    meta: [
      { title: "Funcionalidades dos projetos | QA Academy" },
      {
        name: "description",
        content:
          "Cadastre, edite, ordene, desative e arquive as funcionalidades do TechEduca e do Café Central.",
      },
      { property: "og:title", content: "Funcionalidades dos projetos | QA Academy" },
      {
        property: "og:description",
        content: "Gestão completa do escopo testável de cada projeto da UC10.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeaturesPage,
});

const EMPTY = {
  code: "",
  name: "",
  description: "",
  category: "geral",
  origin: "instrutor",
  status: "active",
  notes: "",
};

function FeaturesPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: groups } = useInstructorGroups(userId);
  const [scope, setScope] = useState("techeduca");

  const groupId = scope.startsWith("cafe:") ? scope.replace("cafe:", "") : null;
  const project = groupId ? "cafe_central" : scope === "cafe_central" ? "cafe_central" : "techeduca";

  const { data: features } = useManagedFeatures(project, groupId);
  const { data: suggestions } = useFeatureSuggestions(project, groupId);
  const save = useSaveFeature();
  const reorder = useReorderFeature();
  const removeSafe = useDeleteFeatureSafe();
  const review = useReviewSuggestion(userId);

  const [editing, setEditing] = useState<ManagedFeature | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [statusFilter, setStatusFilter] = useState("all");

  const list = useMemo(
    () => (features ?? []).filter((f) => statusFilter === "all" || f.status === statusFilter),
    [features, statusFilter],
  );

  function startEdit(f: ManagedFeature) {
    setEditing(f);
    setForm({
      code: f.code,
      name: f.name,
      description: f.description,
      category: f.category,
      origin: f.origin,
      status: f.status,
      notes: f.notes ?? "",
    });
  }

  function reset() {
    setEditing(null);
    setForm({ ...EMPTY });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const position = editing ? editing.position : ((features ?? []).length + 1);
    try {
      await save.mutateAsync({
        id: editing?.id,
        values: editing
          ? { ...form }
          : {
              ...form,
              project,
              group_id: groupId,
              kind: groupId ? "additional" : "base",
              position,
              created_by: userId,
            },
      });
      toast.success(editing ? "Funcionalidade atualizada." : "Funcionalidade cadastrada.");
      reset();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function move(f: ManagedFeature, dir: -1 | 1) {
    const ordered = [...(features ?? [])].sort((a, b) => a.position - b.position);
    const i = ordered.findIndex((x) => x.id === f.id);
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    const a = ordered[i]!;
    const b = ordered[j]!;
    await reorder.mutateAsync([
      { id: a.id, position: b.position },
      { id: b.id, position: a.position },
    ]);
  }

  async function setStatus(f: ManagedFeature, status: string) {
    await save.mutateAsync({ id: f.id, values: { status } });
    toast.success(`Status alterado para ${labelOf(FEATURE_STATUS, status)}.`);
  }

  async function hardDelete(f: ManagedFeature) {
    try {
      await removeSafe.mutateAsync(f.id);
      toast.success("Funcionalidade excluída.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Funcionalidades dos projetos</h1>
        <p className="text-sm text-muted-foreground">
          Nada fica fixo no código: todas as funcionalidades — inclusive as iniciais — podem ser editadas,
          reordenadas, desativadas ou arquivadas. A exclusão definitiva só é permitida quando não há casos,
          bugs, evidências ou registros de missão vinculados.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <NativeSelect
          id="feat-scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: "techeduca", label: "TechEduca — escopo do projeto" },
            { value: "cafe_central", label: "Café Central — escopo base" },
            ...(groups ?? []).map((g) => ({ value: `cafe:${g.id}`, label: `Café Central — ${g.name}` })),
          ]}
        />
        <NativeSelect
          id="feat-status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[{ value: "all", label: "Todos os status" }, ...FEATURE_STATUS.map((s) => ({ ...s }))]}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma funcionalidade neste filtro.</p>
          )}
          {list.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{f.code}</span>
                    <h2 className="font-semibold">{f.name}</h2>
                    <Badge variant={f.status === "active" ? "default" : "secondary"}>
                      {labelOf(FEATURE_STATUS, f.status)}
                    </Badge>
                    {f.group_id ? <Badge variant="outline">grupo</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {labelOf(FEATURE_CATEGORY, f.category)} · {labelOf(FEATURE_ORIGIN, f.origin)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => move(f, -1)} aria-label="Subir">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => move(f, 1)} aria-label="Descer">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => startEdit(f)}>
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => hardDelete(f)} aria-label="Excluir">
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 max-w-xs">
                <NativeSelect
                  id={`st-${f.id}`}
                  value={f.status}
                  onChange={(v) => setStatus(f, v)}
                  options={FEATURE_STATUS.map((s) => ({ ...s }))}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>{editing ? "Editar funcionalidade" : "Nova funcionalidade"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submit}>
                <div className="space-y-1">
                  <Label htmlFor="c">Código</Label>
                  <Input
                    id="c"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nm">Nome</Label>
                  <Input
                    id="nm"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ds">Descrição</Label>
                  <Textarea
                    id="ds"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <NativeSelect
                    id="cat"
                    value={form.category}
                    onChange={(v) => setForm({ ...form, category: v })}
                    options={FEATURE_CATEGORY.map((s) => ({ ...s }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Origem</Label>
                  <NativeSelect
                    id="org"
                    value={form.origin}
                    onChange={(v) => setForm({ ...form, origin: v })}
                    options={FEATURE_ORIGIN.map((s) => ({ ...s }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <NativeSelect
                    id="sts"
                    value={form.status}
                    onChange={(v) => setForm({ ...form, status: v })}
                    options={FEATURE_STATUS.map((s) => ({ ...s }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ob">Observações</Label>
                  <Textarea
                    id="ob"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editing ? "Salvar" : "Cadastrar"}
                  </Button>
                  {editing ? (
                    <Button type="button" variant="outline" onClick={reset}>
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sugestões dos alunos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(suggestions ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma sugestão registrada.</p>
              )}
              {(suggestions ?? []).map((s) => (
                <div key={s.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.name}</span>
                    <Badge variant={s.status === "pending" ? "outline" : "secondary"}>{s.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                  {s.status === "pending" && (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => review.mutate({ suggestion: s, approve: true })}>
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => review.mutate({ suggestion: s, approve: false })}
                      >
                        Recusar
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <AuditList entity="app_features" title="Histórico de funcionalidades" />
        </div>
      </div>
    </div>
  );
}
