import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, NativeSelect } from "@/components/qa/TestCasesPanel";
import {
  EVIDENCE_KINDS,
  labelOf,
  openQaFile,
  shortId,
  useBugs,
  useCreateQaEvidence,
  useDeleteQaEvidence,
  useProfileNames,
  useQaEvidences,
  useQaMissions,
  useTestCases,
  type QaScope,
} from "@/lib/qa";

const empty = {
  title: "",
  kind: "imagem",
  description: "",
  content: "",
  link: "",
  project: "",
  mission_id: "",
  test_case_id: "",
  bug_id: "",
};

export function EvidencesPanel({
  scope,
  userId,
  readOnly = false,
}: {
  scope: QaScope;
  userId: string | null;
  readOnly?: boolean;
}) {
  const { data: evidences, isPending } = useQaEvidences(scope, userId);
  const { data: cases } = useTestCases(scope, userId);
  const { data: bugs } = useBugs(scope, userId);
  const { data: missions } = useQaMissions();
  const create = useCreateQaEvidence(scope, userId);
  const remove = useDeleteQaEvidence(scope, userId);
  const { data: names } = useProfileNames((evidences ?? []).map((e) => e.author_id));
  const [form, setForm] = useState({ ...empty });
  const [file, setFile] = useState<File | null>(null);

  function set(k: keyof typeof empty, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const needsFile = ["imagem", "documento", "video", "log"].includes(form.kind);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Informe o título da evidência.");
      return;
    }
    if (form.kind === "link" && !form.link.trim()) {
      toast.error("Informe o link.");
      return;
    }
    if (form.kind === "texto" && !form.content.trim()) {
      toast.error("Escreva o conteúdo da evidência.");
      return;
    }
    if (needsFile && !file && !form.link.trim() && !form.content.trim()) {
      toast.error("Anexe um arquivo, informe um link ou cole o conteúdo.");
      return;
    }
    try {
      await create.mutateAsync({
        title: form.title.trim(),
        kind: form.kind,
        description: form.description.trim(),
        content: form.content.trim() || null,
        link: form.link.trim() || null,
        project: form.project.trim(),
        mission_id: form.mission_id || null,
        test_case_id: form.test_case_id || null,
        bug_id: form.bug_id || null,
        retest_id: null,
        file,
      });
      setForm({ ...empty });
      setFile(null);
      (e.target as HTMLFormElement).reset();
      toast.success("Evidência registrada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova evidência</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <Field label="Título" id="ev-title">
                <Input id="ev-title" value={form.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field label="Tipo" id="ev-kind">
                <NativeSelect
                  id="ev-kind"
                  value={form.kind}
                  onChange={(v) => set("kind", v)}
                  options={EVIDENCE_KINDS.map((k) => ({ value: k.value, label: k.label }))}
                />
              </Field>
              <Field label="Projeto" id="ev-project">
                <Input id="ev-project" value={form.project} onChange={(e) => set("project", e.target.value)} />
              </Field>
              <Field label="Missão" id="ev-mission">
                <NativeSelect
                  id="ev-mission"
                  value={form.mission_id}
                  onChange={(v) => set("mission_id", v)}
                  options={[
                    { value: "", label: "Nenhuma" },
                    ...(missions ?? []).map((m) => ({ value: m.id, label: m.title })),
                  ]}
                />
              </Field>
              <Field label="Caso de teste relacionado" id="ev-case">
                <NativeSelect
                  id="ev-case"
                  value={form.test_case_id}
                  onChange={(v) => set("test_case_id", v)}
                  options={[
                    { value: "", label: "Nenhum" },
                    ...(cases ?? []).map((c) => ({ value: c.id, label: `CT-${shortId(c.id)} ${c.title}` })),
                  ]}
                />
              </Field>
              <Field label="Bug relacionado" id="ev-bug">
                <NativeSelect
                  id="ev-bug"
                  value={form.bug_id}
                  onChange={(v) => set("bug_id", v)}
                  options={[
                    { value: "", label: "Nenhum" },
                    ...(bugs ?? []).map((b) => ({ value: b.id, label: `BUG-${shortId(b.id)} ${b.title}` })),
                  ]}
                />
              </Field>
              {form.kind === "link" ? (
                <Field label="Link" id="ev-link" full>
                  <Input id="ev-link" value={form.link} onChange={(e) => set("link", e.target.value)} placeholder="https://..." />
                </Field>
              ) : form.kind === "texto" || form.kind === "log" ? (
                <Field label={form.kind === "log" ? "Log" : "Conteúdo"} id="ev-content" full>
                  <Textarea id="ev-content" rows={5} value={form.content} onChange={(e) => set("content", e.target.value)} />
                </Field>
              ) : null}
              {needsFile && (
                <Field label="Arquivo" id="ev-file">
                  <Input id="ev-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </Field>
              )}
              <Field label="Descrição" id="ev-desc" full>
                <Textarea id="ev-desc" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Enviando..." : "Adicionar evidência"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isPending && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isPending && (evidences ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma evidência registrada neste contexto.</p>
      )}

      <div className="space-y-3">
        {(evidences ?? []).map((ev) => (
          <div key={ev.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">
                  <span className="mr-2 rounded-md bg-secondary px-2 py-0.5 text-xs font-normal">
                    {labelOf(EVIDENCE_KINDS, ev.kind)}
                  </span>
                  {ev.title}
                </div>
                {ev.description && <p className="text-sm text-muted-foreground">{ev.description}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {names?.[ev.author_id] ?? "—"} · {new Date(ev.created_at).toLocaleString("pt-BR")} ·{" "}
                  {ev.project || "sem projeto"} ·{" "}
                  {missions?.find((m) => m.id === ev.mission_id)?.title ?? "sem missão"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ev.test_case_id ? `CT-${shortId(ev.test_case_id)} ` : ""}
                  {ev.bug_id ? `BUG-${shortId(ev.bug_id)}` : ""}
                  {!ev.test_case_id && !ev.bug_id ? "Sem atividade vinculada" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {ev.link && (
                  <a href={ev.link} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">
                    Abrir link
                  </a>
                )}
                {ev.file_path && (
                  <Button size="sm" variant="secondary" onClick={() => void openQaFile(ev.file_path!)}>
                    Ver arquivo
                  </Button>
                )}
                {!readOnly && ev.author_id === userId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      remove.mutate(ev, {
                        onSuccess: () => toast.success("Evidência removida."),
                        onError: (e) => toast.error(e.message),
                      })
                    }
                  >
                    Excluir
                  </Button>
                )}
              </div>
            </div>
            {ev.content && (
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                {ev.content}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
