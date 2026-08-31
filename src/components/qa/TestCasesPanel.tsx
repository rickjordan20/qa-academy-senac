import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CASE_STATUSES,
  caseStatusLabel,
  shortId,
  useCreateTestCase,
  useDeleteTestCase,
  useProfileNames,
  useQaMissions,
  useTestCases,
  useUpdateTestCase,
  type QaScope,
} from "@/lib/qa";

export type PersonOption = { id: string; name: string };

const empty = {
  title: "",
  project: "",
  mission_id: "",
  assignee_id: "",
  feature: "",
  precondition: "",
  input_data: "",
  steps: "",
  expected_result: "",
  obtained_result: "",
  status: "nao_executado",
};

export function TestCasesPanel({
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
  const { data: cases, isPending } = useTestCases(scope, userId);
  const { data: missions } = useQaMissions();
  const create = useCreateTestCase(scope, userId);
  const update = useUpdateTestCase(scope, userId);
  const remove = useDeleteTestCase(scope, userId);
  const [form, setForm] = useState({ ...empty });
  const [open, setOpen] = useState(false);

  const ids = (cases ?? []).flatMap((c) => [c.author_id, c.assignee_id ?? ""]);
  const { data: names } = useProfileNames(ids);
  const missionTitle = (id: string | null) =>
    missions?.find((m) => m.id === id)?.title ?? null;

  function set(k: keyof typeof empty, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Informe o título do caso de teste.");
      return;
    }
    try {
      await create.mutateAsync({
        ...form,
        title: form.title.trim(),
        mission_id: form.mission_id || null,
        assignee_id: form.assignee_id || null,
      });
      setForm({ ...empty });
      setOpen(false);
      toast.success("Caso de teste criado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Novo caso de teste</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
              {open ? "Fechar" : "Abrir formulário"}
            </Button>
          </CardHeader>
          {open && (
            <CardContent>
              <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                <Field label="Título" id="tc-title">
                  <Input id="tc-title" value={form.title} onChange={(e) => set("title", e.target.value)} />
                </Field>
                <Field label="Projeto" id="tc-project">
                  <Input
                    id="tc-project"
                    value={form.project}
                    onChange={(e) => set("project", e.target.value)}
                    placeholder="Ex.: TechEduca"
                  />
                </Field>
                <Field label="Missão" id="tc-mission">
                  <NativeSelect
                    id="tc-mission"
                    value={form.mission_id}
                    onChange={(v) => set("mission_id", v)}
                    options={[
                      { value: "", label: "Nenhuma" },
                      ...(missions ?? []).map((m) => ({ value: m.id, label: m.title })),
                    ]}
                  />
                </Field>
                <Field label="Responsável" id="tc-assignee">
                  <NativeSelect
                    id="tc-assignee"
                    value={form.assignee_id}
                    onChange={(v) => set("assignee_id", v)}
                    options={[
                      { value: "", label: "Não definido" },
                      ...people.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                  />
                </Field>
                <Field label="Funcionalidade" id="tc-feature">
                  <Input id="tc-feature" value={form.feature} onChange={(e) => set("feature", e.target.value)} />
                </Field>
                <Field label="Status" id="tc-status">
                  <NativeSelect
                    id="tc-status"
                    value={form.status}
                    onChange={(v) => set("status", v)}
                    options={CASE_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                  />
                </Field>
                <Field label="Pré-condição" id="tc-pre" full>
                  <Textarea id="tc-pre" rows={2} value={form.precondition} onChange={(e) => set("precondition", e.target.value)} />
                </Field>
                <Field label="Dados de entrada" id="tc-input" full>
                  <Textarea id="tc-input" rows={2} value={form.input_data} onChange={(e) => set("input_data", e.target.value)} />
                </Field>
                <Field label="Passos" id="tc-steps" full>
                  <Textarea id="tc-steps" rows={4} value={form.steps} onChange={(e) => set("steps", e.target.value)} placeholder={"1. ...\n2. ..."} />
                </Field>
                <Field label="Resultado esperado" id="tc-exp">
                  <Textarea id="tc-exp" rows={3} value={form.expected_result} onChange={(e) => set("expected_result", e.target.value)} />
                </Field>
                <Field label="Resultado obtido" id="tc-obt">
                  <Textarea id="tc-obt" rows={3} value={form.obtained_result} onChange={(e) => set("obtained_result", e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? "Salvando..." : "Criar caso de teste"}
                  </Button>
                </div>
              </form>
            </CardContent>
          )}
        </Card>
      )}

      {isPending && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isPending && (cases ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum caso de teste registrado neste contexto.</p>
      )}

      <div className="space-y-3">
        {(cases ?? []).map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  <span className="mr-2 font-mono text-xs text-muted-foreground">CT-{shortId(c.id)}</span>
                  {c.title}
                </CardTitle>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-md bg-secondary px-2 py-0.5">{caseStatusLabel(c.status)}</span>
                  <span className="text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <span>Projeto: {c.project || "—"}</span>
                <span>Missão: {missionTitle(c.mission_id) ?? "—"}</span>
                <span>Autor: {names?.[c.author_id] ?? "—"}</span>
                <span>Responsável: {c.assignee_id ? (names?.[c.assignee_id] ?? "—") : "—"}</span>
                <span>Funcionalidade: {c.feature || "—"}</span>
              </div>
              {c.precondition && <Block title="Pré-condição" text={c.precondition} />}
              {c.input_data && <Block title="Dados de entrada" text={c.input_data} />}
              {c.steps && <Block title="Passos" text={c.steps} />}
              <div className="grid gap-2 sm:grid-cols-2">
                <Block title="Resultado esperado" text={c.expected_result || "—"} />
                <Block title="Resultado obtido" text={c.obtained_result || "—"} />
              </div>
              {!readOnly && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <NativeSelect
                    id={`st-${c.id}`}
                    value={c.status}
                    onChange={(v) =>
                      update.mutate(
                        {
                          id: c.id,
                          patch: {
                            status: v,
                            executed_at: v === "nao_executado" ? null : new Date().toISOString(),
                            executed_by: v === "nao_executado" ? null : userId,
                          },
                        },
                        { onError: (e) => toast.error(e.message) },
                      )
                    }
                    options={CASE_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                    className="h-9 w-48"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      remove.mutate(c.id, {
                        onSuccess: () => toast.success("Caso removido."),
                        onError: (e) => toast.error(e.message),
                      })
                    }
                  >
                    Excluir
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function Field({
  label,
  id,
  full,
  children,
}: {
  label: string;
  id: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function NativeSelect({
  id,
  value,
  onChange,
  options,
  className,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border border-input bg-background px-3 text-sm ${className ?? "h-10 w-full"}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Block({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <span className="text-xs font-semibold uppercase text-muted-foreground">{title}</span>
      <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">{text}</pre>
    </div>
  );
}
