import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { QaScope } from "@/lib/qa";

/* ------------------------------------------------------------------ */
/* Leitura unificada: casos e execuções vindos de duas origens         */
/*  - qa_test_cases (registros criados na área Módulos QA)             */
/*  - builder_mission_entries (registros criados dentro das missões)   */
/* Nada é migrado, duplicado ou gravado aqui: é somente leitura.       */
/* ------------------------------------------------------------------ */

export type RecordOrigin = "qa" | "mission";

export type UnifiedExecution = {
  id: string;
  origin: RecordOrigin;
  caseId: string | null;
  /** Resultado obtido pertence à execução */
  obtained: string;
  status: string;
  environment: string;
  note: string;
  authorId: string | null;
  executedAt: string | null;
  updatedAt: string | null;
  missionId: string | null;
  runId: string | null;
  evidences: UnifiedEvidence[];
};

export type UnifiedEvidence = {
  id: string;
  title: string;
  kind: string;
  link: string | null;
  authorId: string | null;
  createdAt: string;
};

export type UnifiedCase = {
  id: string;
  origin: RecordOrigin;
  title: string;
  featureId: string | null;
  featureText: string;
  precondition: string;
  inputData: string;
  steps: string;
  /** Resultado esperado pertence ao caso */
  expected: string;
  objective: string;
  note: string;
  authorId: string | null;
  missionId: string | null;
  missionTitle: string | null;
  runId: string | null;
  createdAt: string;
  updatedAt: string | null;
  executions: UnifiedExecution[];
  evidences: UnifiedEvidence[];
};

type EntryRow = {
  id: string;
  run_id: string;
  mission_id: string;
  kind: string;
  author_id: string;
  parent_id: string | null;
  feature_id: string | null;
  title: string;
  status: string;
  data: Record<string, string> | null;
  link: string | null;
  created_at: string;
  updated_at: string | null;
};

type CaseRow = {
  id: string;
  title: string;
  feature: string;
  feature_id: string | null;
  precondition: string;
  input_data: string;
  steps: string;
  expected_result: string;
  obtained_result: string;
  status: string;
  author_id: string;
  mission_id: string | null;
  executed_at: string | null;
  executed_by: string | null;
  created_at: string;
};

const RECORD_KINDS = ["test_case", "execution", "bug", "evidence", "retest"];

function str(data: Record<string, string> | null, key: string) {
  return (data?.[key] ?? "").toString();
}

/** Normaliza o status escrito no bloco da missão para o vocabulário dos casos. */
export function normalizeStatus(raw: string) {
  const v = raw.trim().toLowerCase();
  if (!v) return "nao_executado";
  if (v.startsWith("aprov")) return "aprovado";
  if (v.startsWith("reprov")) return "reprovado";
  if (v.startsWith("bloque")) return "bloqueado";
  if (v.startsWith("não exec") || v.startsWith("nao exec")) return "nao_executado";
  return v.replace(/\s+/g, "_");
}

function toEvidence(e: EntryRow): UnifiedEvidence {
  return {
    id: e.id,
    title: e.title || str(e.data, "titulo") || "Evidência",
    kind: str(e.data, "tipo") || "outro",
    link: e.link,
    authorId: e.author_id,
    createdAt: e.created_at,
  };
}

/**
 * Casos de teste do escopo, com as execuções ligadas a cada caso.
 * Café Central: registros de todo o grupo. TechEduca: apenas os próprios.
 */
export function useUnifiedCases(scope: QaScope, userId: string | null) {
  const enabled = scope.context === "cafe" ? !!scope.groupId : !!userId;
  const key = scope.context === "cafe" ? `cafe:${scope.groupId}` : `techeduca:${userId}`;

  return useQuery({
    queryKey: ["qa-unified", "cases", key],
    enabled,
    queryFn: async (): Promise<UnifiedCase[]> => {
      /* ---- Origem 1: registros criados na área Módulos QA ---- */
      let qaQuery = supabase.from("qa_test_cases").select("*");
      qaQuery =
        scope.context === "cafe"
          ? qaQuery.eq("context", "cafe").eq("group_id", scope.groupId!)
          : qaQuery.eq("context", "techeduca").eq("author_id", userId!).is("group_id", null);
      const qaRes = await qaQuery.order("created_at", { ascending: false });
      if (qaRes.error) throw qaRes.error;
      const qaRows = (qaRes.data ?? []) as unknown as CaseRow[];

      /* ---- Origem 2: registros criados dentro das missões ---- */
      let runQuery = supabase.from("builder_mission_runs").select("id, mission_id");
      runQuery =
        scope.context === "cafe"
          ? runQuery.eq("group_id", scope.groupId!)
          : runQuery.eq("student_id", userId!);
      const runRes = await runQuery;
      if (runRes.error) throw runRes.error;
      const runs = (runRes.data ?? []) as unknown as { id: string; mission_id: string }[];
      const runIds = runs.map((r) => r.id);

      let entries: EntryRow[] = [];
      const missionTitles: Record<string, string> = {};
      if (runIds.length > 0) {
        const entryRes = await supabase
          .from("builder_mission_entries")
          .select(
            "id, run_id, mission_id, kind, author_id, parent_id, feature_id, title, status, data, link, created_at, updated_at",
          )
          .in("run_id", runIds)
          .in("kind", RECORD_KINDS)
          .order("created_at", { ascending: false });
        if (entryRes.error) throw entryRes.error;
        entries = (entryRes.data ?? []) as unknown as EntryRow[];

        const missionIds = Array.from(new Set(entries.map((e) => e.mission_id).filter(Boolean)));
        if (missionIds.length > 0) {
          const misRes = await supabase
            .from("builder_missions")
            .select("id, title")
            .in("id", missionIds);
          if (misRes.error) throw misRes.error;
          for (const m of (misRes.data ?? []) as unknown as { id: string; title: string }[]) {
            missionTitles[m.id] = m.title;
          }
        }
      }

      const evidenceByParent = new Map<string, UnifiedEvidence[]>();
      for (const e of entries.filter((x) => x.kind === "evidence" && x.parent_id)) {
        const list = evidenceByParent.get(e.parent_id!) ?? [];
        list.push(toEvidence(e));
        evidenceByParent.set(e.parent_id!, list);
      }

      const executions: UnifiedExecution[] = entries
        .filter((e) => e.kind === "execution")
        .map((e) => ({
          id: e.id,
          origin: "mission" as const,
          caseId: e.parent_id,
          obtained: str(e.data, "obtido"),
          status: normalizeStatus(e.status || str(e.data, "status")),
          environment: str(e.data, "ambiente"),
          note: str(e.data, "observacao"),
          authorId: e.author_id,
          executedAt: str(e.data, "data") || e.created_at,
          updatedAt: e.updated_at,
          missionId: e.mission_id,
          runId: e.run_id,
          evidences: evidenceByParent.get(e.id) ?? [],
        }));

      const missionCases: UnifiedCase[] = entries
        .filter((e) => e.kind === "test_case")
        .map((e) => ({
          id: e.id,
          origin: "mission" as const,
          title: e.title || str(e.data, "titulo") || "(sem título)",
          featureId: e.feature_id,
          featureText: str(e.data, "funcionalidade"),
          precondition: str(e.data, "precondicao"),
          inputData: str(e.data, "dados"),
          steps: str(e.data, "passos"),
          expected: str(e.data, "esperado"),
          objective: str(e.data, "objetivo"),
          note: str(e.data, "observacao"),
          authorId: e.author_id,
          missionId: e.mission_id,
          missionTitle: missionTitles[e.mission_id] ?? null,
          runId: e.run_id,
          createdAt: e.created_at,
          updatedAt: e.updated_at,
          executions: executions.filter((x) => x.caseId === e.id),
          evidences: evidenceByParent.get(e.id) ?? [],
        }));

      /* Um caso criado na área QA carrega sua própria execução embutida:
         separamos conceitualmente esperado (caso) de obtido/status (execução). */
      const qaCases: UnifiedCase[] = qaRows.map((c) => {
        const hasExecution = !!c.obtained_result?.trim() || c.status !== "nao_executado";
        return {
          id: c.id,
          origin: "qa" as const,
          title: c.title,
          featureId: c.feature_id,
          featureText: c.feature,
          precondition: c.precondition,
          inputData: c.input_data,
          steps: c.steps,
          expected: c.expected_result,
          objective: "",
          note: "",
          authorId: c.author_id,
          missionId: c.mission_id,
          missionTitle: null,
          runId: null,
          createdAt: c.created_at,
          updatedAt: c.executed_at,
          evidences: [],
          executions: hasExecution
            ? [
                {
                  id: `${c.id}-exec`,
                  origin: "qa" as const,
                  caseId: c.id,
                  obtained: c.obtained_result,
                  status: c.status,
                  environment: "",
                  note: "",
                  authorId: c.executed_by ?? c.author_id,
                  executedAt: c.executed_at,
                  updatedAt: c.executed_at,
                  missionId: c.mission_id,
                  runId: null,
                  evidences: [],
                },
              ]
            : [],
        };
      });

      const all = [...qaCases, ...missionCases].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      /* Execuções sem caso identificável ficam agrupadas para não sumirem da auditoria. */
      const knownCaseIds = new Set(missionCases.map((c) => c.id));
      const orphans = executions.filter((e) => !e.caseId || !knownCaseIds.has(e.caseId));
      if (orphans.length > 0) {
        all.push({
          id: "__sem-caso__",
          origin: "mission",
          title: "Execuções sem caso vinculado",
          featureId: null,
          featureText: "",
          precondition: "",
          inputData: "",
          steps: "",
          expected: "",
          objective: "",
          note: "",
          authorId: null,
          missionId: orphans[0]!.missionId,
          missionTitle: orphans[0]!.missionId ? (missionTitles[orphans[0]!.missionId] ?? null) : null,
          runId: orphans[0]!.runId,
          createdAt: orphans[0]!.executedAt ?? new Date().toISOString(),
          updatedAt: null,
          executions: orphans,
          evidences: [],
        });
      }
      return all;
    },
  });
}


/* ------------------------------------------------------------------ */
/* Bugs e evidências unificados                                        */
/* ------------------------------------------------------------------ */

export type LinkKind = "explicit" | "derived" | "none";

export type UnifiedBug = {
  id: string;
  origin: RecordOrigin;
  title: string;
  description: string;
  environment: string;
  steps: string;
  expected: string;
  obtained: string;
  severity: string;
  priority: string;
  status: string;
  featureId: string | null;
  featureText: string;
  caseId: string | null;
  caseText: string;
  linkKind: LinkKind;
  authorId: string | null;
  assigneeId: string | null;
  missionId: string | null;
  missionTitle: string | null;
  runId: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type UnifiedEvidenceRecord = {
  id: string;
  origin: RecordOrigin;
  title: string;
  kind: string;
  description: string;
  content: string;
  link: string | null;
  featureText: string;
  parentId: string | null;
  linkKind: LinkKind;
  authorId: string | null;
  missionId: string | null;
  missionTitle: string | null;
  runId: string | null;
  createdAt: string;
  updatedAt: string | null;
};

type MissionSource = {
  entries: EntryRow[];
  missionTitles: Record<string, string>;
};

async function fetchMissionEntries(scope: QaScope, userId: string | null): Promise<MissionSource> {
  let runQuery = supabase.from("builder_mission_runs").select("id, mission_id");
  runQuery =
    scope.context === "cafe"
      ? runQuery.eq("group_id", scope.groupId!)
      : runQuery.eq("student_id", userId!);
  const runRes = await runQuery;
  if (runRes.error) throw runRes.error;
  const runIds = ((runRes.data ?? []) as unknown as { id: string }[]).map((r) => r.id);
  if (runIds.length === 0) return { entries: [], missionTitles: {} };

  const entryRes = await supabase
    .from("builder_mission_entries")
    .select(
      "id, run_id, mission_id, kind, author_id, parent_id, feature_id, title, status, data, link, created_at, updated_at",
    )
    .in("run_id", runIds)
    .in("kind", RECORD_KINDS)
    .order("created_at", { ascending: false });
  if (entryRes.error) throw entryRes.error;
  const entries = (entryRes.data ?? []) as unknown as EntryRow[];

  const missionTitles: Record<string, string> = {};
  const missionIds = Array.from(new Set(entries.map((e) => e.mission_id).filter(Boolean)));
  if (missionIds.length > 0) {
    const misRes = await supabase.from("builder_missions").select("id, title").in("id", missionIds);
    if (misRes.error) throw misRes.error;
    for (const m of (misRes.data ?? []) as unknown as { id: string; title: string }[]) {
      missionTitles[m.id] = m.title;
    }
  }
  return { entries, missionTitles };
}

function normalizeText(v: string) {
  return v.trim().toLowerCase();
}

/**
 * Vínculo inequívoco: o texto "Caso relacionado" corresponde a exatamente um
 * caso de teste do mesmo run. Empate ou nenhuma correspondência => sem vínculo.
 */
function deriveCaseId(text: string, runId: string, entries: EntryRow[]) {
  const t = normalizeText(text);
  if (!t) return null;
  const candidates = entries.filter((e) => {
    if (e.kind !== "test_case" || e.run_id !== runId) return false;
    const title = normalizeText(e.title || str(e.data, "titulo"));
    if (!title) return false;
    return title === t || normalizeText(e.id).startsWith(t);
  });
  return candidates.length === 1 ? candidates[0]!.id : null;
}

function scopeKey(scope: QaScope, userId: string | null) {
  return scope.context === "cafe" ? `cafe:${scope.groupId}` : `techeduca:${userId}`;
}

export function useUnifiedBugs(scope: QaScope, userId: string | null) {
  const enabled = scope.context === "cafe" ? !!scope.groupId : !!userId;
  return useQuery({
    queryKey: ["qa-unified", "bugs", scopeKey(scope, userId)],
    enabled,
    queryFn: async (): Promise<UnifiedBug[]> => {
      let qaQuery = supabase.from("qa_bugs").select("*");
      qaQuery =
        scope.context === "cafe"
          ? qaQuery.eq("context", "cafe").eq("group_id", scope.groupId!)
          : qaQuery.eq("context", "techeduca").eq("author_id", userId!).is("group_id", null);
      const qaRes = await qaQuery.order("created_at", { ascending: false });
      if (qaRes.error) throw qaRes.error;

      const qaBugs: UnifiedBug[] = (
        (qaRes.data ?? []) as unknown as Record<string, string | null>[]
      ).map((b) => ({
        id: String(b["id"]),
        origin: "qa",
        title: String(b["title"] ?? ""),
        description: String(b["description"] ?? ""),
        environment: String(b["environment"] ?? ""),
        steps: String(b["steps"] ?? ""),
        expected: String(b["expected_result"] ?? ""),
        obtained: String(b["obtained_result"] ?? ""),
        severity: String(b["severity"] ?? ""),
        priority: String(b["priority"] ?? ""),
        status: String(b["status"] ?? ""),
        featureId: (b["feature_id"] as string | null) ?? null,
        featureText: "",
        caseId: (b["test_case_id"] as string | null) ?? null,
        caseText: "",
        linkKind: b["test_case_id"] ? "explicit" : "none",
        authorId: (b["author_id"] as string | null) ?? null,
        assigneeId: (b["assignee_id"] as string | null) ?? null,
        missionId: (b["mission_id"] as string | null) ?? null,
        missionTitle: null,
        runId: null,
        createdAt: String(b["created_at"]),
        updatedAt: (b["updated_at"] as string | null) ?? null,
      }));

      const { entries, missionTitles } = await fetchMissionEntries(scope, userId);
      const missionBugs: UnifiedBug[] = entries
        .filter((e) => e.kind === "bug")
        .map((e) => {
          const caseText = str(e.data, "caso");
          const derived = e.parent_id ? null : deriveCaseId(caseText, e.run_id, entries);
          return {
            id: e.id,
            origin: "mission" as const,
            title: e.title || str(e.data, "titulo") || "(sem título)",
            description: str(e.data, "descricao"),
            environment: str(e.data, "ambiente"),
            steps: str(e.data, "passos"),
            expected: str(e.data, "esperado"),
            obtained: str(e.data, "obtido"),
            severity: str(e.data, "severidade"),
            priority: str(e.data, "prioridade"),
            status: e.status || str(e.data, "status"),
            featureId: e.feature_id,
            featureText: str(e.data, "funcionalidade"),
            caseId: e.parent_id ?? derived,
            caseText,
            linkKind: (e.parent_id ? "explicit" : derived ? "derived" : "none") as LinkKind,
            authorId: e.author_id,
            assigneeId: null,
            missionId: e.mission_id,
            missionTitle: missionTitles[e.mission_id] ?? null,
            runId: e.run_id,
            createdAt: e.created_at,
            updatedAt: e.updated_at,
          };
        });

      return [...qaBugs, ...missionBugs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
  });
}

export function useUnifiedEvidences(scope: QaScope, userId: string | null) {
  const enabled = scope.context === "cafe" ? !!scope.groupId : !!userId;
  return useQuery({
    queryKey: ["qa-unified", "evidences", scopeKey(scope, userId)],
    enabled,
    queryFn: async (): Promise<UnifiedEvidenceRecord[]> => {
      let qaQuery = supabase.from("qa_evidences").select("*");
      qaQuery =
        scope.context === "cafe"
          ? qaQuery.eq("context", "cafe").eq("group_id", scope.groupId!)
          : qaQuery.eq("context", "techeduca").eq("author_id", userId!).is("group_id", null);
      const qaRes = await qaQuery.order("created_at", { ascending: false });
      if (qaRes.error) throw qaRes.error;

      const qaEvidences: UnifiedEvidenceRecord[] = (
        (qaRes.data ?? []) as unknown as Record<string, string | null>[]
      ).map((e) => ({
        id: String(e["id"]),
        origin: "qa",
        title: String(e["title"] ?? ""),
        kind: String(e["kind"] ?? "outro"),
        description: String(e["description"] ?? ""),
        content: String(e["content"] ?? ""),
        link: (e["link"] as string | null) ?? null,
        featureText: "",
        parentId: (e["test_case_id"] as string | null) ?? (e["bug_id"] as string | null) ?? null,
        linkKind: e["test_case_id"] || e["bug_id"] ? "explicit" : "none",
        authorId: (e["author_id"] as string | null) ?? null,
        missionId: (e["mission_id"] as string | null) ?? null,
        missionTitle: null,
        runId: null,
        createdAt: String(e["created_at"]),
        updatedAt: (e["updated_at"] as string | null) ?? null,
      }));

      const { entries, missionTitles } = await fetchMissionEntries(scope, userId);
      const missionEvidences: UnifiedEvidenceRecord[] = entries
        .filter((e) => e.kind === "evidence")
        .map((e) => ({
          id: e.id,
          origin: "mission" as const,
          title: e.title || str(e.data, "titulo") || "Evidência",
          kind: str(e.data, "tipo") || "outro",
          description: str(e.data, "descricao"),
          content: str(e.data, "conteudo"),
          link: e.link || str(e.data, "url") || null,
          featureText: str(e.data, "funcionalidade"),
          parentId: e.parent_id,
          linkKind: (e.parent_id ? "explicit" : "none") as LinkKind,
          authorId: e.author_id,
          missionId: e.mission_id,
          missionTitle: missionTitles[e.mission_id] ?? null,
          runId: e.run_id,
          createdAt: e.created_at,
          updatedAt: e.updated_at,
        }));

      return [...qaEvidences, ...missionEvidences].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    },
  });
}

export function caseUpdatedAt(c: UnifiedCase) {
  const stamps = [c.updatedAt, c.createdAt, ...c.executions.map((e) => e.updatedAt ?? e.executedAt)]
    .filter(Boolean)
    .map((s) => new Date(s as string).getTime())
    .filter((n) => !Number.isNaN(n));
  return stamps.length ? new Date(Math.max(...stamps)).toISOString() : c.createdAt;
}
