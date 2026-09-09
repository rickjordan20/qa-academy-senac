import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
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
import {
  TEST_TYPES,
  projectLabel,
  testTypeLabel,
  useFeatures,
  useModules,
  type AppProject,
} from "@/lib/inventory";
import { ModuleFeatureSelect, featureTrace } from "@/components/qa/ModuleFeatureSelect";
import { caseUpdatedAt, useUnifiedCases, type UnifiedCase } from "@/lib/qa-unified";

export type PersonOption = { id: string; name: string };

const empty = {
  title: "",
  project: "",
  module_id: "",
  feature_id: "",
  test_type: "funcional",
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
  backMission,
  backLabel,
}: {
  scope: QaScope;
  userId: string | null;
  people?: PersonOption[];
  readOnly?: boolean;
  /** contexto de retorno: missão de auditoria de onde o aluno veio */
  backMission?: string | undefined;
  backLabel?: string | undefined;
}) {
  const project: AppProject = scope.context === "cafe" ? "cafe_central" : "techeduca";
  const { data: features } = useFeatures(project, scope.groupId);
  const { data: modules } = useModules(project, scope.groupId);

  const { data: unified, isPending } = useUnifiedCases(scope, userId);
  const { data: missions } = useQaMissions();
  const create = useCreateTestCase(scope, userId);
  const update = useUpdateTestCase(scope, userId);
  const remove = useDeleteTestCase(scope, userId);
  const [form, setForm] = useState({ ...empty });
  const [open, setOpen] = useState(false);

  const [fMission, setFMission] = useState("");
  const [fAuthor, setFAuthor] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fFeature, setFFeature] = useState("");
  const [search, setSearch] = useState("");

  const list = useMemo(() => unified ?? [], [unified]);

  const ids = list.flatMap((c) => [
    c.authorId ?? "",
    ...c.executions.map((e) => e.authorId ?? ""),
  ]);
  const { data: names } = useProfileNames(ids);
  const missionTitle = (id: string | null) => missions?.find((m) => m.id === id)?.title ?? null;

  const missionOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of list) {
      if (!c.missionId) continue;
      map.set(c.missionId, c.missionTitle ?? missionTitle(c.missionId) ?? "Missão");
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, missions]);

  const authorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of list) {
      if (c.authorId) map.set(c.authorId, names?.[c.authorId] ?? "Autor");
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [list, names]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return list.filter((c) => {
      if (fMission && c.missionId !== fMission) return false;
      if (fAuthor && c.authorId !== fAuthor) return false;
      if (fFeature && c.featureId !== fFeature) return false;
      if (fStatus) {
        const statuses = c.executions.map((e) => e.status);
        const effective = statuses.length ? statuses : ["nao_executado"];
        if (!effective.includes(fStatus)) return false;
      }
      if (term) {
        const hay = `${c.title} ${c.featureText} ${c.steps} ${c.expected}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [list, fMission, fAuthor, fFeature, fStatus, search]);

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
      const { module_id: _module, ...values } = form;
      await create.mutateAsync({
        ...values,
        title: form.title.trim(),
        project: form.project || projectLabel(project),
        feature_id: form.feature_id || null,
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
                  <Input id="tc-project" value={projectLabel(project)} readOnly />
                </Field>
                <ModuleFeatureSelect
                  idPrefix="tc"
                  project={project}
                  groupId={scope.groupId}
                  moduleId={form.module_id}
                  featureId={form.feature_id}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, module_id: v.moduleId, feature_id: v.featureId }))
                  }
                />

                <Field label="Tipo de teste" id="tc-type">
                  <NativeSelect
                    id="tc-type"
                    value={form.test_type}
                    onChange={(v) => set("test_type", v)}
                    options={TEST_TYPES.map((t) => ({ value: t.value, label: t.label }))}
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
                <Field label="Observação sobre a funcionalidade" id="tc-feature">
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Consultar casos de teste</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Buscar" id="f-search">
            <Input
              id="f-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Título, funcionalidade, passos..."
            />
          </Field>
          <Field label="Missão" id="f-mission">
            <NativeSelect
              id="f-mission"
              value={fMission}
              onChange={setFMission}
              options={[{ value: "", label: "Todas" }, ...missionOptions]}
            />
          </Field>
          <Field label="Funcionalidade" id="f-feature">
            <NativeSelect
              id="f-feature"
              value={fFeature}
              onChange={setFFeature}
              options={[
                { value: "", label: "Todas" },
                ...(features ?? []).map((f) => ({ value: f.id, label: f.name })),
              ]}
            />
          </Field>
          <Field label="Autor" id="f-author">
            <NativeSelect
              id="f-author"
              value={fAuthor}
              onChange={setFAuthor}
              options={[{ value: "", label: "Todos" }, ...authorOptions]}
            />
          </Field>
          <Field label="Status da execução" id="f-status">
            <NativeSelect
              id="f-status"
              value={fStatus}
              onChange={setFStatus}
              options={[
                { value: "", label: "Todos" },
                ...CASE_STATUSES.map((s) => ({ value: s.value, label: s.label })),
              ]}
            />
          </Field>
        </CardContent>
      </Card>

      {isPending && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isPending && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum caso de teste encontrado com os filtros atuais.
        </p>
      )}

      <div className="space-y-3">
        {filtered.map((c) => (
          <CaseCard
            key={c.id}
            c={c}
            names={names ?? {}}
            featureLabel={
              c.featureId ? featureTrace(modules, features, c.featureId) : c.featureText || "—"
            }
            project={projectLabel(project)}
            backMission={backMission}
            backLabel={backLabel}
            actions={
              !readOnly && c.origin === "qa" ? (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <NativeSelect
                    id={`st-${c.id}`}
                    value={c.executions[0]?.status ?? "nao_executado"}
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
              ) : null
            }
          />
        ))}
      </div>
    </div>
  );
}

/** Caso de teste (esperado) + suas execuções (obtido, status, evidências). */
function CaseCard({
  c,
  names,
  featureLabel,
  project,
  actions,
  backMission,
  backLabel,
}: {
  c: UnifiedCase;
  names: Record<string, string>;
  featureLabel: string;
  project: string;
  actions?: React.ReactNode;
  backMission?: string | undefined;
  backLabel?: string | undefined;
}) {
  const updated = caseUpdatedAt(c);
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            <span className="mr-2 font-mono text-xs text-muted-foreground">CT-{shortId(c.id)}</span>
            {c.title}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
              {c.origin === "mission" ? "Registrado em missão" : "Registrado em Módulos QA"}
            </span>
            <span className="text-muted-foreground">
              Atualizado em {new Date(updated).toLocaleDateString("pt-BR")}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <span>Projeto: {project}</span>
          <span>Módulo/Funcionalidade: {featureLabel}</span>
          <span>Missão de origem: {c.missionTitle ?? "—"}</span>
          <span>Autor: {c.authorId ? (names[c.authorId] ?? "—") : "—"}</span>
        </div>

        {c.objective && <Block title="Objetivo" text={c.objective} />}
        {c.precondition && <Block title="Pré-condição" text={c.precondition} />}
        {c.inputData && <Block title="Dados de teste" text={c.inputData} />}
        {c.steps && <Block title="Passos" text={c.steps} />}
        <Block title="Resultado esperado" text={c.expected || "—"} />

        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Execuções ({c.executions.length})
          </p>
          {c.executions.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Nenhuma execução registrada para este caso.
            </p>
          ) : (
            <div className="mt-2 space-y-3">
              {c.executions.map((ex) => (
                <div key={ex.id} className="border-l-2 border-border pl-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md bg-secondary px-2 py-0.5">
                      {caseStatusLabel(ex.status)}
                    </span>
                    <span className="text-muted-foreground">
                      {ex.authorId ? (names[ex.authorId] ?? "—") : "—"}
                      {ex.executedAt
                        ? ` · ${new Date(ex.executedAt).toLocaleDateString("pt-BR")}`
                        : ""}
                      {ex.environment ? ` · ${ex.environment}` : ""}
                    </span>
                  </div>
                  <Block title="Resultado obtido" text={ex.obtained || "—"} />
                  {ex.note && <Block title="Observação" text={ex.note} />}
                  {ex.evidences.length > 0 && (
                    <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                      {ex.evidences.map((ev) => (
                        <li key={ev.id}>
                          Evidência: {ev.title}
                          {ev.link ? (
                            <>
                              {" — "}
                              <a
                                href={ev.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent hover:underline"
                              >
                                abrir
                              </a>
                            </>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {c.evidences.length > 0 && (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {c.evidences.map((ev) => (
              <li key={ev.id}>Evidência do caso: {ev.title}</li>
            ))}
          </ul>
        )}

        {c.origin === "mission" && c.missionId ? (
          <div className="pt-1">
            <Button asChild size="sm" variant="outline">
              <Link
                to="/student/activities/$missionId"
                params={{ missionId: c.missionId }}
                search={backMission ? { backMission, backLabel } : {}}
              >
                Abrir missão de origem
              </Link>
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              Este registro é corrigido dentro da missão em que foi criado.
            </p>
          </div>
        ) : null}

        {actions}
      </CardContent>
    </Card>
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
