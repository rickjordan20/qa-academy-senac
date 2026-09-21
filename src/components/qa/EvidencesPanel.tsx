import { useState } from "react";
import { Link } from "@tanstack/react-router";
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
  isValidEvidenceUrl,
  TEXT_EVIDENCE_KINDS,
  type QaScope,
} from "@/lib/qa";
import { EvidenceGuide } from "@/components/EvidenceGuide";
import { useUnifiedEvidences, type UnifiedEvidenceRecord } from "@/lib/qa-unified";

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
  backMission,
  backLabel,
}: {
  scope: QaScope;
  userId: string | null;
  readOnly?: boolean;
  backMission?: string | undefined;
  backLabel?: string | undefined;
}) {
  const { data: evidences, isPending } = useUnifiedEvidences(scope, userId);
  const { data: qaEvidences } = useQaEvidences(scope, userId);
  const { data: cases } = useTestCases(scope, userId);
  const { data: bugs } = useBugs(scope, userId);
  const { data: missions } = useQaMissions();
  const create = useCreateQaEvidence(scope, userId);
  const remove = useDeleteQaEvidence(scope, userId);
  const { data: names } = useProfileNames((evidences ?? []).map((e) => e.authorId ?? ""));
  const [form, setForm] = useState({ ...empty });

  function set(k: keyof typeof empty, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const isTextual = TEXT_EVIDENCE_KINDS.includes(form.kind);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Informe o título da evidência.");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Explique o que esta evidência demonstra.");
      return;
    }
    if (isTextual && !form.content.trim() && !isValidEvidenceUrl(form.link)) {
      toast.error("Escreva o conteúdo da evidência ou informe um link válido.");
      return;
    }
    if (!isTextual && !isValidEvidenceUrl(form.link)) {
      toast.error("Informe um link válido para a evidência.");
      return;
    }
    if (form.link.trim() && !isValidEvidenceUrl(form.link)) {
      toast.error("Informe um link válido para a evidência.");
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
      });
      setForm({ ...empty });
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
              <div className="sm:col-span-2">
                <EvidenceGuide />
              </div>
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
              <Field label="URL da evidência (https://...)" id="ev-link" full>
                <Input
                  id="ev-link"
                  value={form.link}
                  onChange={(e) => set("link", e.target.value)}
                  placeholder="https://drive.google.com/..."
                />
              </Field>
              <Field label="Evidência textual / log (opcional)" id="ev-content" full>
                <Textarea id="ev-content" rows={4} value={form.content} onChange={(e) => set("content", e.target.value)} />
              </Field>
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
                  <Button size="sm" variant="secondary" asChild>
                    <a href={ev.link} target="_blank" rel="noopener noreferrer">
                      🔗 Abrir evidência
                    </a>
                  </Button>
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
