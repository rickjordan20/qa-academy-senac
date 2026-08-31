import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Block, Field, NativeSelect, type PersonOption } from "@/components/qa/TestCasesPanel";
import {
  BUG_STATUSES,
  PRIORITIES,
  SEVERITIES,
  bugStatusLabel,
  labelOf,
  shortId,
  useBugs,
  useCreateBug,
  useCreateRetest,
  useDeleteBug,
  useProfileNames,
  useQaMissions,
  useRetests,
  useTestCases,
  useUpdateBug,
  type QaScope,
} from "@/lib/qa";
import { projectLabel, useFeatures, type AppProject } from "@/lib/inventory";

const empty = {
  title: "",
  project: "",
  feature_id: "",
  mission_id: "",
  test_case_id: "",
  assignee_id: "",
  description: "",
  environment: "",
  steps: "",
  expected_result: "",
  obtained_result: "",
  severity: "media",
  priority: "media",
  status: "aberto",
};

export function BugsPanel({
  scope,
  userId,
  people = [],
  readOnly = false,
}: {
  scope: QaScope;
  userId: string | null;
  people?: PersonOption[];
  readOnly?: boolean;
}) {
  const project: AppProject = scope.context === "cafe" ? "cafe_central" : "techeduca";
  const { data: features } = useFeatures(project, scope.groupId);
  const { data: bugs, isPending } = useBugs(scope, userId);
  const { data: cases } = useTestCases(scope, userId);
  const { data: missions } = useQaMissions();
  const create = useCreateBug(scope, userId);
  const update = useUpdateBug(scope, userId);
  const remove = useDeleteBug(scope, userId);
  const retest = useCreateRetest(scope, userId);
  const { data: retests } = useRetests((bugs ?? []).map((b) => b.id));
  const { data: names } = useProfileNames([
    ...(bugs ?? []).flatMap((b) => [b.author_id, b.assignee_id ?? ""]),
    ...(retests ?? []).map((r) => r.tester_id),
  ]);
  const [form, setForm] = useState({ ...empty });
  const [open, setOpen] = useState(false);
  const [retestNotes, setRetestNotes] = useState<Record<string, string>>({});

  function set(k: keyof typeof empty, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Informe o título do bug.");
      return;
    }
    try {
      await create.mutateAsync({
        ...form,
        title: form.title.trim(),
        project: form.project || projectLabel(project),
        feature_id: form.feature_id || null,
        mission_id: form.mission_id || null,
        test_case_id: form.test_case_id || null,
        assignee_id: form.assignee_id || null,
      });
      setForm({ ...empty });
      setOpen(false);
      toast.success("Bug registrado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }

  function doRetest(bugId: string, result: "resolvido" | "reaberto") {
    retest.mutate(
      { bug_id: bugId, result, notes: retestNotes[bugId] ?? "" },
      {
        onSuccess: () => {
          setRetestNotes((n) => ({ ...n, [bugId]: "" }));
          toast.success(result === "resolvido" ? "Reteste registrado: resolvido." : "Reteste registrado: reaberto.");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Novo bug</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
              {open ? "Fechar" : "Abrir formulário"}
            </Button>
          </CardHeader>
          {open && (
            <CardContent>
              <p className="mb-3 rounded-md border border-border p-2 text-xs text-muted-foreground">
                Registre apenas comportamento incorreto de funcionalidades que existem no escopo do projeto. A
                ausência de uma funcionalidade que nunca foi requisito não é bug.
              </p>
              <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                <Field label="Título" id="bg-title">
                  <Input id="bg-title" value={form.title} onChange={(e) => set("title", e.target.value)} />
                </Field>
                <Field label="Projeto" id="bg-project">
                  <Input id="bg-project" value={projectLabel(project)} readOnly />
                </Field>
                <Field label="Funcionalidade relacionada" id="bg-feature">
                  <NativeSelect
                    id="bg-feature"
                    value={form.feature_id}
                    onChange={(v) => set("feature_id", v)}
                    options={[
                      { value: "", label: "Não relacionada" },
                      ...(features ?? []).map((f) => ({
                        value: f.id,
                        label: `${f.code} — ${f.name}${f.kind === "additional" ? " (adicional)" : ""}`,
                      })),
                    ]}
                  />
                </Field>
                <Field label="Missão" id="bg-mission">
                  <NativeSelect
                    id="bg-mission"
                    value={form.mission_id}
                    onChange={(v) => set("mission_id", v)}
                    options={[
                      { value: "", label: "Nenhuma" },
                      ...(missions ?? []).map((m) => ({ value: m.id, label: m.title })),
                    ]}
                  />
                </Field>
                <Field label="Caso de teste relacionado" id="bg-case">
                  <NativeSelect
                    id="bg-case"
                    value={form.test_case_id}
                    onChange={(v) => set("test_case_id", v)}
                    options={[
                      { value: "", label: "Nenhum" },
                      ...(cases ?? []).map((c) => ({ value: c.id, label: `CT-${shortId(c.id)} ${c.title}` })),
                    ]}
                  />
                </Field>
                <Field label="Responsável" id="bg-assignee">
                  <NativeSelect
                    id="bg-assignee"
                    value={form.assignee_id}
                    onChange={(v) => set("assignee_id", v)}
                    options={[
                      { value: "", label: "Não definido" },
                      ...people.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                  />
                </Field>
                <Field label="Ambiente" id="bg-env">
                  <Input
                    id="bg-env"
                    value={form.environment}
                    onChange={(e) => set("environment", e.target.value)}
                    placeholder="Ex.: Chrome 120 / Windows 11"
                  />
                </Field>
                <Field label="Severidade" id="bg-sev">
                  <NativeSelect
                    id="bg-sev"
                    value={form.severity}
                    onChange={(v) => set("severity", v)}
                    options={SEVERITIES.map((s) => ({ value: s.value, label: s.label }))}
                  />
                </Field>
                <Field label="Prioridade" id="bg-pri">
                  <NativeSelect
                    id="bg-pri"
                    value={form.priority}
                    onChange={(v) => set("priority", v)}
                    options={PRIORITIES.map((s) => ({ value: s.value, label: s.label }))}
                  />
                </Field>
                <Field label="Status" id="bg-status">
                  <NativeSelect
                    id="bg-status"
                    value={form.status}
                    onChange={(v) => set("status", v)}
                    options={BUG_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                  />
                </Field>
                <Field label="Descrição" id="bg-desc" full>
                  <Textarea id="bg-desc" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
                </Field>
                <Field label="Passos para reprodução" id="bg-steps" full>
                  <Textarea id="bg-steps" rows={4} value={form.steps} onChange={(e) => set("steps", e.target.value)} />
                </Field>
                <Field label="Resultado esperado" id="bg-exp">
                  <Textarea id="bg-exp" rows={3} value={form.expected_result} onChange={(e) => set("expected_result", e.target.value)} />
                </Field>
                <Field label="Resultado obtido" id="bg-obt">
                  <Textarea id="bg-obt" rows={3} value={form.obtained_result} onChange={(e) => set("obtained_result", e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? "Salvando..." : "Registrar bug"}
                  </Button>
                </div>
              </form>
            </CardContent>
          )}
        </Card>
      )}

      {isPending && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isPending && (bugs ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum bug registrado neste contexto.</p>
      )}

      <div className="space-y-3">
        {(bugs ?? []).map((b) => {
          const bugRetests = (retests ?? []).filter((r) => r.bug_id === b.id);
          const relatedCase = (cases ?? []).find((c) => c.id === b.test_case_id);
          return (
            <Card key={b.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">BUG-{shortId(b.id)}</span>
                    {b.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-md bg-secondary px-2 py-0.5">{bugStatusLabel(b.status)}</span>
                    <span className="text-muted-foreground">
                      {new Date(b.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>Projeto: {b.project || projectLabel(project)}</span>
                  <span>
                    Funcionalidade:{" "}
                    {(features ?? []).find((f) => f.id === b.feature_id)
                      ? `${(features ?? []).find((f) => f.id === b.feature_id)!.code} — ${(features ?? []).find((f) => f.id === b.feature_id)!.name}`
                      : "—"}
                  </span>
                  <span>Missão: {missions?.find((m) => m.id === b.mission_id)?.title ?? "—"}</span>
                  <span>Autor: {names?.[b.author_id] ?? "—"}</span>
                  <span>Responsável: {b.assignee_id ? (names?.[b.assignee_id] ?? "—") : "—"}</span>
                  <span>Severidade: {labelOf(SEVERITIES, b.severity)}</span>
                  <span>Prioridade: {labelOf(PRIORITIES, b.priority)}</span>
                  <span>Ambiente: {b.environment || "—"}</span>
                  <span>
                    Caso relacionado: {relatedCase ? `CT-${shortId(relatedCase.id)} ${relatedCase.title}` : "—"}
                  </span>
                </div>
                {b.description && <Block title="Descrição" text={b.description} />}
                {b.steps && <Block title="Passos para reprodução" text={b.steps} />}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Block title="Resultado esperado" text={b.expected_result || "—"} />
                  <Block title="Resultado obtido" text={b.obtained_result || "—"} />
                </div>

                {bugRetests.length > 0 && (
                  <div className="rounded-lg border border-border p-3">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Histórico de retestes</span>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {bugRetests.map((r) => (
                        <li key={r.id}>
                          {new Date(r.tested_at).toLocaleString("pt-BR")} — {names?.[r.tester_id] ?? "—"} —{" "}
                          <strong>{r.result === "resolvido" ? "Resolvido" : "Reaberto"}</strong>
                          {r.notes ? ` — ${r.notes}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!readOnly && (
                  <div className="space-y-2 pt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <NativeSelect
                        id={`bst-${b.id}`}
                        value={b.status}
                        onChange={(v) =>
                          update.mutate({ id: b.id, patch: { status: v } }, { onError: (e) => toast.error(e.message) })
                        }
                        options={BUG_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                        className="h-9 w-56"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          remove.mutate(b.id, {
                            onSuccess: () => toast.success("Bug removido."),
                            onError: (e) => toast.error(e.message),
                          })
                        }
                      >
                        Excluir
                      </Button>
                    </div>

                    {b.status === "pronto_reteste" && (
                      <div className="rounded-lg border border-accent/40 bg-accent/5 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Reteste</p>
                        <Textarea
                          rows={2}
                          placeholder="O que foi verificado no reteste?"
                          value={retestNotes[b.id] ?? ""}
                          onChange={(e) => setRetestNotes((n) => ({ ...n, [b.id]: e.target.value }))}
                        />
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" disabled={retest.isPending} onClick={() => doRetest(b.id, "resolvido")}>
                            Resolvido
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={retest.isPending}
                            onClick={() => doRetest(b.id, "reaberto")}
                          >
                            Reabrir
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
