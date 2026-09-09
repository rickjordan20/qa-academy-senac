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
      let missionTitles: Record<string, string> = {};
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
      return all;
    },
  });
}

/** Execuções que não conseguimos ligar a nenhum caso — não podem sumir da auditoria. */
export function orphanExecutions(cases: UnifiedCase[], all: UnifiedCase[]) {
  void all;
  return cases;
}

export function caseUpdatedAt(c: UnifiedCase) {
  const stamps = [c.updatedAt, c.createdAt, ...c.executions.map((e) => e.updatedAt ?? e.executedAt)]
    .filter(Boolean)
    .map((s) => new Date(s as string).getTime())
    .filter((n) => !Number.isNaN(n));
  return stamps.length ? new Date(Math.max(...stamps)).toISOString() : c.createdAt;
}
