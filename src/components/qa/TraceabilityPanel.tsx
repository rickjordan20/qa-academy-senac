import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EVIDENCE_KINDS,
  bugStatusLabel,
  caseStatusLabel,
  labelOf,
  shortId,
  useBugs,
  useProfileNames,
  useQaEvidences,
  useQaMissions,
  useRetests,
  useTestCases,
  type QaScope,
} from "@/lib/qa";
import { useUnifiedCases } from "@/lib/qa-unified";

/** Missão → Caso → Execução → Bug → Evidência → Reteste */
export function TraceabilityPanel({ scope, userId }: { scope: QaScope; userId: string | null }) {
  const { data: cases } = useTestCases(scope, userId);
  const { data: bugs } = useBugs(scope, userId);
  const { data: evidences } = useQaEvidences(scope, userId);
  const { data: missions } = useQaMissions();
  const { data: retests } = useRetests((bugs ?? []).map((b) => b.id));
  const { data: unified } = useUnifiedCases(scope, userId);
  const missionCases = (unified ?? []).filter((c) => c.origin === "mission");
  const { data: names } = useProfileNames([
    ...(cases ?? []).map((c) => c.author_id),
    ...(bugs ?? []).map((b) => b.author_id),
    ...(evidences ?? []).map((e) => e.author_id),
    ...(retests ?? []).map((r) => r.tester_id),
    ...missionCases.flatMap((c) => [
      c.authorId ?? "",
      ...c.executions.map((e) => e.authorId ?? ""),
    ]),
  ]);

  const missionIds = Array.from(
    new Set([
      ...(cases ?? []).map((c) => c.mission_id),
      ...(bugs ?? []).map((b) => b.mission_id),
      ...(evidences ?? []).map((e) => e.mission_id),
    ]),
  );

  if (missionIds.length === 0 && missionCases.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nada rastreado ainda. Crie casos de teste, bugs e evidências para ver a cadeia completa.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {missionCases.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Registros criados dentro das missões</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {missionCases.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-3">
                <div className="font-medium">
                  <span className="mr-2 font-mono text-xs text-muted-foreground">CT-{shortId(c.id)}</span>
                  {c.title}
                </div>
                <p className="text-xs text-muted-foreground">
                  Missão: {c.missionTitle ?? "—"} · Autor: {(c.authorId && names?.[c.authorId]) || "—"}
                </p>
                <div className="mt-2 space-y-1 border-l-2 border-border pl-3">
                  {c.executions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem execução registrada.</p>
                  ) : (
                    c.executions.map((ex) => (
                      <p key={ex.id} className="text-xs text-muted-foreground">
                        ↳ Execução: {caseStatusLabel(ex.status)} — {(ex.authorId && names?.[ex.authorId]) || "—"}
                        {ex.evidences.length > 0 ? ` · ${ex.evidences.length} evidência(s)` : ""}
                      </p>
                    ))
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {missionIds.map((mid) => {
        const missionCases = (cases ?? []).filter((c) => c.mission_id === mid);
        const missionBugs = (bugs ?? []).filter((b) => b.mission_id === mid);
        const looseBugs = missionBugs.filter((b) => !b.test_case_id);
        const missionEvidences = (evidences ?? []).filter(
          (e) => e.mission_id === mid && !e.test_case_id && !e.bug_id,
        );
        return (
          <Card key={mid ?? "sem-missao"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {missions?.find((m) => m.id === mid)?.title ?? "Sem missão vinculada"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {missionCases.map((c) => (
                <div key={c.id} className="rounded-lg border border-border p-3">
                  <div className="font-medium">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">CT-{shortId(c.id)}</span>
                    {c.title}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Autor: {names?.[c.author_id] ?? "—"} · Execução: {caseStatusLabel(c.status)}
                    {c.executed_at ? ` em ${new Date(c.executed_at).toLocaleString("pt-BR")}` : ""}
                  </p>
                  <Chain
                    bugs={missionBugs.filter((b) => b.test_case_id === c.id)}
                    evidences={evidences ?? []}
                    retests={retests ?? []}
                    names={names ?? {}}
                    caseEvidences={(evidences ?? []).filter((e) => e.test_case_id === c.id)}
                  />
                </div>
              ))}

              {looseBugs.length > 0 && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Bugs sem caso vinculado</p>
                  <Chain
                    bugs={looseBugs}
                    evidences={evidences ?? []}
                    retests={retests ?? []}
                    names={names ?? {}}
                    caseEvidences={[]}
                  />
                </div>
              )}

              {missionEvidences.length > 0 && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Evidências avulsas</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {missionEvidences.map((e) => (
                      <li key={e.id}>
                        [{labelOf(EVIDENCE_KINDS, e.kind)}] {e.title} — {names?.[e.author_id] ?? "—"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Chain({
  bugs,
  evidences,
  retests,
  names,
  caseEvidences,
}: {
  bugs: { id: string; title: string; status: string; author_id: string }[];
  evidences: { id: string; title: string; kind: string; bug_id: string | null; author_id: string }[];
  retests: { id: string; bug_id: string; tester_id: string; result: string; tested_at: string }[];
  names: Record<string, string>;
  caseEvidences: { id: string; title: string; kind: string; author_id: string }[];
}) {
  return (
    <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
      {caseEvidences.map((e) => (
        <p key={e.id} className="text-xs text-muted-foreground">
          Evidência do caso: [{labelOf(EVIDENCE_KINDS, e.kind)}] {e.title} — {names[e.author_id] ?? "—"}
        </p>
      ))}
      {bugs.length === 0 && caseEvidences.length === 0 && (
        <p className="text-xs text-muted-foreground">Sem bugs ou evidências vinculados.</p>
      )}
      {bugs.map((b) => {
        const bugEvidences = evidences.filter((e) => e.bug_id === b.id);
        const bugRetests = retests.filter((r) => r.bug_id === b.id);
        return (
          <div key={b.id} className="space-y-1">
            <p className="text-xs">
              <span className="font-mono text-muted-foreground">BUG-{shortId(b.id)}</span> {b.title} —{" "}
              <span className="text-muted-foreground">
                {bugStatusLabel(b.status)} · {names[b.author_id] ?? "—"}
              </span>
            </p>
            {bugEvidences.map((e) => (
              <p key={e.id} className="pl-4 text-xs text-muted-foreground">
                ↳ Evidência: [{labelOf(EVIDENCE_KINDS, e.kind)}] {e.title} — {names[e.author_id] ?? "—"}
              </p>
            ))}
            {bugRetests.map((r) => (
              <p key={r.id} className="pl-4 text-xs text-muted-foreground">
                ↳ Reteste: {r.result === "resolvido" ? "Resolvido" : "Reaberto"} por {names[r.tester_id] ?? "—"} em{" "}
                {new Date(r.tested_at).toLocaleString("pt-BR")}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
