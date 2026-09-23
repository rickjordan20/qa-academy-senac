import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/missions/DynamicFields";
import { bugStatusLabel, PRIORITIES, SEVERITIES, labelOf } from "@/lib/qa";
import {
  CROSS_DEV_TRANSITIONS,
  useAddCrossEvidence,
  useClaimCrossBug,
  useCrossBugRelations,
  useCrossBugs,
  useCrossGroups,
  useCrossPairings,
  useCrossRetest,
  useCrossTransition,
  useLinkableCases,
  useReportCrossBug,
  useSetCrossAssignee,
  type CrossBug,
} from "@/lib/cross-test";

/**
 * Fluxo Dev × Tester de um bloco `cross_test`.
 * Funciona em qualquer missão que contenha o bloco — nada é específico de uma aula.
 */
export function CrossTestPanel({
  missionId,
  sectionId,
  userId,
  classIds,
  myGroupIds,
}: {
  missionId: string;
  sectionId: string;
  userId: string | null;
  classIds: string[];
  myGroupIds: string[];
}) {
  const { data: pairings } = useCrossPairings(missionId);
  const { data: groups } = useCrossGroups(classIds);
  const sectionPairings = useMemo(
    () => (pairings ?? []).filter((p) => p.section_id === sectionId),
    [pairings, sectionId],
  );
  const { data: bugs } = useCrossBugs(sectionPairings.map((p) => p.id));
  const { data: relations } = useCrossBugRelations((bugs ?? []).map((b) => b.id));

  const asTester = sectionPairings.filter((p) => myGroupIds.includes(p.tester_group_id));
  const asDeveloper = sectionPairings.filter((p) => myGroupIds.includes(p.developer_group_id));

  const groupName = (id: string | null | undefined) =>
    (groups ?? []).find((g) => g.id === id)?.name ?? "Equipe";
  const memberName = (id: string | null | undefined) => {
    if (!id) return "Não atribuído";
    for (const g of groups ?? []) {
      const m = g.members.find((x) => x.student_id === id);
      if (m) return m.name;
    }
    return "Participante";
  };

  if (sectionPairings.length === 0)
    return (
      <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">
        O instrutor ainda não configurou os pareamentos deste teste cruzado.
      </div>
    );

  return (
    <div className="space-y-4">
      {asTester.map((p) => (
        <TesterArea
          key={p.id}
          pairingId={p.id}
          missionId={missionId}
          testerGroupId={p.tester_group_id}
          testerName={groupName(p.tester_group_id)}
          devName={groupName(p.developer_group_id)}
          devMembers={(groups ?? []).find((g) => g.id === p.developer_group_id)?.members ?? []}
          userId={userId}
          bugs={(bugs ?? []).filter((b) => b.pairing_id === p.id)}
          relations={relations}
          memberName={memberName}
        />
      ))}

      {asDeveloper.map((p) => (
        <DeveloperArea
          key={p.id}
          testerName={groupName(p.tester_group_id)}
          devName={groupName(p.developer_group_id)}
          userId={userId}
          bugs={(bugs ?? []).filter((b) => b.pairing_id === p.id)}
          relations={relations}
          memberName={memberName}
        />
      ))}

      {asTester.length === 0 && asDeveloper.length === 0 ? (
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm text-muted-foreground">
          Seu grupo não participa dos pareamentos deste bloco.
        </div>
      ) : null}
    </div>
  );
}

type Relations = ReturnType<typeof useCrossBugRelations>["data"];

function BugDetails({
  bug,
  relations,
  memberName,
}: {
  bug: CrossBug;
  relations: Relations;
  memberName: (id: string | null | undefined) => string;
}) {
  const retests = (relations?.retests ?? []).filter((r) => r.bug_id === bug.id);
  const evidences = (relations?.evidences ?? []).filter((e) => e.bug_id === bug.id);
  return (
    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
      <p>
        Situação: <span className="font-semibold text-foreground">{bugStatusLabel(bug.status)}</span> ·
        Severidade: {labelOf(SEVERITIES, bug.severity)} · Prioridade: {labelOf(PRIORITIES, bug.priority)}
      </p>
      <p>
        Reportado por {memberName(bug.author_id)} em {new Date(bug.created_at).toLocaleString("pt-BR")}
      </p>
      <p>Desenvolvedor responsável: {memberName(bug.assignee_id)}</p>
      {bug.test_case_id ? <p>Caso de teste vinculado ✔</p> : <p>Sem caso de teste vinculado</p>}
      {evidences.length ? (
        <div>
          <p className="font-semibold text-foreground">Evidências</p>
          <ul className="list-disc pl-4">
            {evidences.map((e) => (
              <li key={e.id}>
                {e.title}
                {e.link ? (
                  <>
                    {" — "}
                    <a href={e.link} target="_blank" rel="noreferrer" className="text-accent underline">
                      abrir
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {retests.length ? (
        <div>
          <p className="font-semibold text-foreground">Retestes</p>
          <ul className="list-disc pl-4">
            {retests.map((r) => (
              <li key={r.id}>
                {r.result === "resolvido" ? "Aprovado" : "Reprovado"} por {memberName(r.tester_id)} em{" "}
                {new Date(r.tested_at).toLocaleString("pt-BR")}
                {r.notes ? ` — ${r.notes}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Área do grupo tester                                                */
/* ------------------------------------------------------------------ */

function TesterArea({
  pairingId,
  missionId,
  testerGroupId,
  testerName,
  devName,
  devMembers,
  userId,
  bugs,
  relations,
  memberName,
}: {
  pairingId: string;
  missionId: string;
  testerGroupId: string;
  testerName: string;
  devName: string;
  devMembers: { student_id: string; name: string }[];
  userId: string | null;
  bugs: CrossBug[];
  relations: Relations;
  memberName: (id: string | null | undefined) => string;
}) {
  const report = useReportCrossBug();
  const retest = useCrossRetest();
  const addEvidence = useAddCrossEvidence();
  const { data: cases } = useLinkableCases(missionId, testerGroupId, userId);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    steps: "",
    expected: "",
    obtained: "",
    severity: "media",
    priority: "media",
    caseId: "",
    assignee: "",
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
      <div className="text-sm">
        <p>
          <span className="text-muted-foreground">Equipe que está testando:</span>{" "}
          <strong>{testerName}</strong>
        </p>
        <p>
          <span className="text-muted-foreground">Equipe desenvolvedora:</span> <strong>{devName}</strong>{" "}
          <span className="text-xs text-muted-foreground">(definida pelo pareamento do instrutor)</span>
        </p>
      </div>

      {!open ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          + Registrar bug para {devName}
        </Button>
      ) : (
        <div className="space-y-3 rounded-md border border-border bg-secondary/30 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Título *</Label>
              <Input value={form.title} onChange={(e) => set({ title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Passos para reproduzir</Label>
              <Textarea rows={2} value={form.steps} onChange={(e) => set({ steps: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Resultado esperado</Label>
              <Textarea rows={2} value={form.expected} onChange={(e) => set({ expected: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Resultado obtido</Label>
              <Textarea rows={2} value={form.obtained} onChange={(e) => set({ obtained: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Severidade</Label>
              <NativeSelect value={form.severity} onChange={(v) => set({ severity: v })}>
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <NativeSelect value={form.priority} onChange={(v) => set({ priority: v })}>
                {PRIORITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label className="text-xs">Caso de teste relacionado (opcional)</Label>
              <NativeSelect value={form.caseId} onChange={(v) => set({ caseId: v })}>
                <option value="">Sem vínculo</option>
                {(cases ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label className="text-xs">Desenvolvedor responsável (opcional)</Label>
              <NativeSelect value={form.assignee} onChange={(v) => set({ assignee: v })}>
                <option value="">Deixar para a equipe assumir</option>
                {devMembers.map((m) => (
                  <option key={m.student_id} value={m.student_id}>
                    {m.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={report.isPending}
              onClick={async () => {
                if (!form.title.trim()) {
                  toast.error("Informe o título do bug.");
                  return;
                }
                try {
                  await report.mutateAsync({
                    pairingId,
                    title: form.title,
                    description: form.description,
                    steps: form.steps,
                    expectedResult: form.expected,
                    obtainedResult: form.obtained,
                    severity: form.severity,
                    priority: form.priority,
                    testCaseId: form.caseId || null,
                    testCaseSource: (cases ?? []).find((c) => c.id === form.caseId)?.source ?? null,
                    featureId: (cases ?? []).find((c) => c.id === form.caseId)?.feature_id ?? null,
                    assigneeId: form.assignee || null,
                  });
                  setForm({
                    title: "",
                    description: "",
                    steps: "",
                    expected: "",
                    obtained: "",
                    severity: "media",
                    priority: "media",
                    caseId: "",
                    assignee: "",
                  });
                  setOpen(false);
                  toast.success("Bug enviado para a equipe desenvolvedora.");
                } catch (e) {
                  // erro: mantém o formulário preenchido
                  toast.error((e as Error).message);
                }
              }}
            >
              Registrar bug
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {bugs.map((b) => (
          <li key={b.id} className="rounded-md border border-border p-3 text-sm">
            <p className="font-medium">{b.title}</p>
            <BugDetails bug={b} relations={relations} memberName={memberName} />

            {b.status === "pronto_reteste" ? (
              <RetestForm
                onSubmit={async (result, notes) => {
                  try {
                    await retest.mutateAsync({ bugId: b.id, result, notes });
                    toast.success("Reteste registrado.");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              />
            ) : null}

            <EvidenceForm
              onSubmit={async (title, link) => {
                if (!userId) return;
                try {
                  await addEvidence.mutateAsync({
                    bugId: b.id,
                    groupId: testerGroupId,
                    authorId: userId,
                    title,
                    kind: link ? "link" : "texto",
                    description: "Evidência do teste cruzado",
                    link: link || null,
                    content: link ? null : title,
                  });
                  toast.success("Evidência vinculada ao bug.");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            />
          </li>
        ))}
        {bugs.length === 0 ? (
          <li className="text-sm text-muted-foreground">Nenhum bug registrado neste pareamento.</li>
        ) : null}
      </ul>
    </div>
  );
}

function RetestForm({ onSubmit }: { onSubmit: (result: "resolvido" | "reaberto", notes: string) => void }) {
  const [result, setResult] = useState<"resolvido" | "reaberto">("resolvido");
  const [notes, setNotes] = useState("");
  return (
    <div className="mt-2 grid gap-2 rounded-md border border-border bg-secondary/30 p-2 sm:grid-cols-[160px_1fr_auto]">
      <NativeSelect value={result} onChange={(v) => setResult(v as "resolvido" | "reaberto")}>
        <option value="aprovado">Reteste aprovado</option>
        <option value="reprovado">Reteste reprovado</option>
      </NativeSelect>
      <Input placeholder="Observações do reteste" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button size="sm" onClick={() => onSubmit(result, notes)}>
        Registrar reteste
      </Button>
    </div>
  );
}

function EvidenceForm({ onSubmit }: { onSubmit: (title: string, link: string) => void }) {
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <Input placeholder="Título da evidência" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input placeholder="Link (https://) ou deixe vazio para texto" value={link} onChange={(e) => setLink(e.target.value)} />
      <Button
        size="sm"
        variant="secondary"
        disabled={!title.trim()}
        onClick={() => {
          onSubmit(title.trim(), link.trim());
          setTitle("");
          setLink("");
        }}
      >
        + Evidência
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Área do grupo desenvolvedor                                         */
/* ------------------------------------------------------------------ */

function DeveloperArea({
  testerName,
  devName,
  userId,
  bugs,
  relations,
  memberName,
}: {
  testerName: string;
  devName: string;
  userId: string | null;
  bugs: CrossBug[];
  relations: Relations;
  memberName: (id: string | null | undefined) => string;
}) {
  const claim = useClaimCrossBug();
  const setAssignee = useSetCrossAssignee();
  const transition = useCrossTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});

  return (
    <div className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-3">
      <p className="text-sm">
        <span className="text-muted-foreground">Bugs recebidos de</span> <strong>{testerName}</strong>{" "}
        <span className="text-muted-foreground">para a equipe</span> <strong>{devName}</strong>
      </p>

      <ul className="space-y-2">
        {bugs.map((b) => (
          <li key={b.id} className="rounded-md border border-border bg-surface p-3 text-sm">
            <p className="font-medium">{b.title}</p>
            <BugDetails bug={b} relations={relations} memberName={memberName} />

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {!b.assignee_id ? (
                <Button
                  size="sm"
                  disabled={claim.isPending}
                  onClick={async () => {
                    try {
                      await claim.mutateAsync(b.id);
                      toast.success("Bug assumido.");
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  Assumir bug
                </Button>
              ) : b.assignee_id === userId ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await setAssignee.mutateAsync({ bugId: b.id, assigneeId: null });
                      toast.success("Bug liberado para a equipe.");
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  Liberar bug
                </Button>
              ) : null}

              {(CROSS_DEV_TRANSITIONS[b.status] ?? []).map((next) => (
                <Button
                  key={next}
                  size="sm"
                  variant="outline"
                  disabled={transition.isPending}
                  onClick={async () => {
                    try {
                      await transition.mutateAsync({ bugId: b.id, status: next, note: notes[b.id] ?? "" });
                      setNotes((n) => ({ ...n, [b.id]: "" }));
                      toast.success(`Situação atualizada: ${bugStatusLabel(next)}`);
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  {bugStatusLabel(next)}
                </Button>
              ))}
            </div>
            <Input
              className="mt-2"
              placeholder="Observação da análise/correção (opcional)"
              value={notes[b.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [b.id]: e.target.value }))}
            />
          </li>
        ))}
        {bugs.length === 0 ? (
          <li className="text-sm text-muted-foreground">Nenhum bug recebido até agora.</li>
        ) : null}
      </ul>
    </div>
  );
}
