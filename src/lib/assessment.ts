import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Ciência da avaliação ("Como você será avaliado?")                   */
/* ------------------------------------------------------------------ */

export const EVALUATION_ACK_VERSION = "uc10-avaliacao-v1";

export type EvaluationAck = {
  id: string;
  student_id: string;
  content_version: string;
  acknowledged_at: string;
};

/** Ciência do próprio aluno (ou null se ainda não registrou). */
export function useMyEvaluationAck(studentId: string | null) {
  return useQuery({
    queryKey: ["evaluation-ack", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<EvaluationAck | null> => {
      const { data, error } = await supabase
        .from("evaluation_acknowledgments")
        .select("id, student_id, content_version, acknowledged_at")
        .eq("student_id", studentId!)
        .eq("content_version", EVALUATION_ACK_VERSION)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as EvaluationAck | null;
    },
  });
}

/** Ciência de um aluno específico (visão do instrutor). */
export function useStudentEvaluationAck(studentId: string | null) {
  return useMyEvaluationAck(studentId);
}

export function useAcknowledgeEvaluation(studentId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!studentId) throw new Error("Aluno não identificado.");
      const { error } = await supabase.from("evaluation_acknowledgments").insert({
        student_id: studentId,
        content_version: EVALUATION_ACK_VERSION,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["evaluation-ack", studentId] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Domínio                                                             */
/* ------------------------------------------------------------------ */

export type Concept = "A" | "PA" | "NA";
export type Stage = "regular" | "final" | "recuperacao";

export const STAGES: { value: Stage; label: string }[] = [
  { value: "regular", label: "Avaliação regular" },
  { value: "final", label: "Avaliação final (Aula 21)" },
  { value: "recuperacao", label: "Recuperação" },
];

export function stageLabel(v: string | null | undefined) {
  return STAGES.find((s) => s.value === v)?.label ?? v ?? "—";
}

export const CONCEPT_LABELS: Record<string, string> = {
  A: "Atendido",
  PA: "Parcialmente atendido",
  NA: "Não atendido",
};

export type IndicatorRow = {
  id: string;
  code: string;
  description: string;
  position: number;
};

export type EvaluationRow = {
  id: string;
  class_id: string;
  student_id: string;
  indicator_id: string;
  concept: Concept | null;
  final_result: "D" | "ND" | null;
  stage: string;
  notes: string | null;
  evaluated_at: string | null;
  evaluated_by: string | null;
};

export type HistoryRow = {
  id: string;
  student_id: string;
  indicator_id: string;
  stage: string;
  concept: Concept | null;
  notes: string;
  created_at: string;
};

export type FeedbackRow = {
  id: string;
  class_id: string;
  student_id: string;
  indicator_id: string | null;
  message: string;
  created_at: string;
};

export type RecoveryPlan = {
  id: string;
  class_id: string;
  student_id: string;
  title: string;
  description: string;
  indicator_ids: string[];
  status: string;
  created_at: string;
};

export type UcResult = {
  id: string;
  class_id: string;
  student_id: string;
  final_result: "D" | "ND" | null;
  notes: string;
  confirmed_at: string | null;
};

export type StudentInfo = { id: string; full_name: string; email: string };

/* ------------------------------------------------------------------ */
/* Regras pedagógicas                                                  */
/* ------------------------------------------------------------------ */

export function suggestResult(concepts: (Concept | null | undefined)[], total: number) {
  const valid = concepts.filter(Boolean) as Concept[];
  if (valid.length < total) return null;
  return valid.every((c) => c === "A") ? ("D" as const) : ("ND" as const);
}

export function pendingIndicators(
  indicators: IndicatorRow[],
  byIndicator: Map<string, EvaluationRow>,
) {
  return indicators.filter((i) => {
    const c = byIndicator.get(i.id)?.concept;
    return c === "PA" || c === "NA";
  });
}

/* ---------------- Situação única da UC (função de domínio) ---------------- */

export type UcSituationKey =
  | "not_evaluated"
  | "in_progress"
  | "final_open"
  | "needs_recovery"
  | "in_recovery"
  | "ready_d"
  | "ready_nd"
  | "D"
  | "ND";

export type UcSituation = {
  key: UcSituationKey;
  label: string;
  /** Indicadores ainda NA (precisam de recuperação final). */
  pending: IndicatorRow[];
  /** Sugestão de resultado; null quando ainda não é possível sugerir. */
  suggestion: "D" | "ND" | null;
  /** true quando a etapa de Recuperação Final já foi avaliada em todos os NA. */
  recoveryDone: boolean;
};

/**
 * Regra única de status da UC.
 * Fechamento (etapa final/recuperação) só aceita A ou NA.
 * Todos A -> D. Algum NA antes da recuperação -> Necessita Recuperação Final.
 * Algum NA depois da recuperação -> ND. Confirmação é sempre manual.
 */
export function ucSituation(
  indicators: IndicatorRow[],
  byIndicator: Map<string, EvaluationRow>,
  result?: UcResult | undefined,
): UcSituation {
  const rows = indicators.map((i) => byIndicator.get(i.id));
  const closedRows = rows.filter((r) => r?.concept === "A" || r?.concept === "NA");
  const na = indicators.filter((i) => byIndicator.get(i.id)?.concept === "NA");
  const recoveryDone =
    na.length > 0 && na.every((i) => byIndicator.get(i.id)?.stage === "recuperacao");
  const inRecovery =
    na.length > 0 && na.some((i) => byIndicator.get(i.id)?.stage === "recuperacao");

  if (result?.final_result) {
    return {
      key: result.final_result,
      label: result.final_result === "D" ? "Desenvolvido" : "Não Desenvolvido",
      pending: na,
      suggestion: result.final_result,
      recoveryDone,
    };
  }

  const evaluated = rows.filter((r) => r?.concept).length;
  if (evaluated === 0)
    return { key: "not_evaluated", label: "Não avaliado", pending: [], suggestion: null, recoveryDone: false };

  if (indicators.length === 0 || closedRows.length < indicators.length)
    return {
      key: evaluated < indicators.length ? "in_progress" : "final_open",
      label:
        evaluated < indicators.length
          ? "Em andamento"
          : "Avaliação Final (fechar cada indicador em A ou NA)",
      pending: na,
      suggestion: null,
      recoveryDone: false,
    };

  if (na.length === 0)
    return { key: "ready_d", label: "Todos os indicadores atendidos", pending: [], suggestion: "D", recoveryDone: false };

  if (recoveryDone)
    return {
      key: "ready_nd",
      label: `Recuperação Final concluída com pendência — ${na.map((i) => i.code).join(", ")}`,
      pending: na,
      suggestion: "ND",
      recoveryDone: true,
    };

  return {
    key: inRecovery ? "in_recovery" : "needs_recovery",
    label: `${inRecovery ? "Em Recuperação Final" : "Necessita Recuperação Final"} — ${na
      .map((i) => i.code)
      .join(", ")}`,
    pending: na,
    suggestion: null,
    recoveryDone: false,
  };
}

export function studentSituation(
  indicators: IndicatorRow[],
  byIndicator: Map<string, EvaluationRow>,
  result: UcResult | undefined,
) {
  return ucSituation(indicators, byIndicator, result).label;
}

/* ------------------------------------------------------------------ */
/* Consultas                                                           */
/* ------------------------------------------------------------------ */

export function useClassStudents(classId: string | null) {
  return useQuery({
    queryKey: ["class-students", classId],
    enabled: !!classId,
    queryFn: async (): Promise<StudentInfo[]> => {
      const { data: enr, error } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("class_id", classId!);
      if (error) throw error;
      const ids = (enr ?? []).map((e) => e.student_id);
      if (ids.length === 0) return [];
      const { data, error: e2 } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (e2) throw e2;
      return (data ?? []).sort((a, b) =>
        (a.full_name || a.email).localeCompare(b.full_name || b.email),
      );
    },
  });
}

export function useClassEvaluations(classId: string | null) {
  return useQuery({
    queryKey: ["class-evaluations", classId],
    enabled: !!classId,
    queryFn: async (): Promise<EvaluationRow[]> => {
      const { data, error } = await supabase
        .from("indicator_evaluations")
        .select("*")
        .eq("class_id", classId!);
      if (error) throw error;
      return (data ?? []) as EvaluationRow[];
    },
  });
}

export function useUpsertEvaluation(classId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      studentId: string;
      indicatorId: string;
      concept: Concept | null;
      stage: Stage;
      notes?: string;
      evaluatedBy: string;
    }) => {
      const { error } = await supabase.from("indicator_evaluations").upsert(
        {
          class_id: classId!,
          student_id: input.studentId,
          indicator_id: input.indicatorId,
          concept: input.concept,
          stage: input.stage,
          notes: input.notes ?? "",
          evaluated_by: input.evaluatedBy,
          evaluated_at: new Date().toISOString(),
        },
        { onConflict: "class_id,student_id,indicator_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-evaluations", classId] });
      qc.invalidateQueries({ queryKey: ["eval-history"] });
      qc.invalidateQueries({ queryKey: ["my-evaluations"] });
    },
  });
}

export function useEvalHistory(studentId: string | null) {
  return useQuery({
    queryKey: ["eval-history", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<HistoryRow[]> => {
      const { data, error } = await supabase
        .from("eval_history")
        .select("id, student_id, indicator_id, stage, concept, notes, created_at")
        .eq("student_id", studentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HistoryRow[];
    },
  });
}

export function useFeedbacks(studentId: string | null) {
  return useQuery({
    queryKey: ["eval-feedbacks", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<FeedbackRow[]> => {
      const { data, error } = await supabase
        .from("eval_feedbacks")
        .select("id, class_id, student_id, indicator_id, message, created_at")
        .eq("student_id", studentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeedbackRow[];
    },
  });
}

export function useAddFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      classId: string;
      studentId: string;
      indicatorId: string | null;
      message: string;
      authorId: string;
    }) => {
      const { error } = await supabase.from("eval_feedbacks").insert({
        class_id: input.classId,
        student_id: input.studentId,
        indicator_id: input.indicatorId,
        message: input.message,
        author_id: input.authorId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eval-feedbacks"] }),
  });
}

export function useDeleteFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("eval_feedbacks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eval-feedbacks"] }),
  });
}

export function useRecoveryPlans(classId: string | null) {
  return useQuery({
    queryKey: ["recovery-plans", classId],
    enabled: !!classId,
    queryFn: async (): Promise<RecoveryPlan[]> => {
      const { data, error } = await supabase
        .from("recovery_plans")
        .select("*")
        .eq("class_id", classId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RecoveryPlan[];
    },
  });
}

export function useMyRecoveryPlans(studentId: string | null) {
  return useQuery({
    queryKey: ["my-recovery-plans", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<RecoveryPlan[]> => {
      const { data, error } = await supabase
        .from("recovery_plans")
        .select("*")
        .eq("student_id", studentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RecoveryPlan[];
    },
  });
}

export function useCreateRecoveryPlan(classId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      studentId: string;
      title: string;
      description: string;
      indicatorIds: string[];
      createdBy: string;
    }) => {
      const { error } = await supabase.from("recovery_plans").insert({
        class_id: classId!,
        student_id: input.studentId,
        title: input.title,
        description: input.description,
        indicator_ids: input.indicatorIds,
        created_by: input.createdBy,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recovery-plans", classId] }),
  });
}

export function useUpdateRecoveryPlan(classId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<RecoveryPlan> }) => {
      const { error } = await supabase.from("recovery_plans").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recovery-plans", classId] }),
  });
}

export function useUcResults(classId: string | null) {
  return useQuery({
    queryKey: ["uc-results", classId],
    enabled: !!classId,
    queryFn: async (): Promise<UcResult[]> => {
      const { data, error } = await supabase.from("uc_results").select("*").eq("class_id", classId!);
      if (error) throw error;
      return (data ?? []) as UcResult[];
    },
  });
}

export function useMyUcResult(studentId: string | null) {
  return useQuery({
    queryKey: ["my-uc-result", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<UcResult | null> => {
      const { data, error } = await supabase
        .from("uc_results")
        .select("*")
        .eq("student_id", studentId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as UcResult | null;
    },
  });
}

export function useConfirmUcResult(classId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      studentId: string;
      finalResult: "D" | "ND";
      notes?: string;
      confirmedBy: string;
    }) => {
      const { error } = await supabase.from("uc_results").upsert(
        {
          class_id: classId!,
          student_id: input.studentId,
          final_result: input.finalResult,
          notes: input.notes ?? "",
          confirmed_by: input.confirmedBy,
          confirmed_at: new Date().toISOString(),
        },
        { onConflict: "class_id,student_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["uc-results", classId] }),
  });
}

/* ------------------------------------------------------------------ */
/* Dossiê / portfólio                                                  */
/* ------------------------------------------------------------------ */

export type StudentDossier = {
  runs: { id: string; mission_id: string; status: string; completed_at: string | null }[];
  teEvidences: { id: string; title: string; description: string | null; created_at: string }[];
  teBugs: { id: string; feature: string; problem: string; classification: string; created_at: string }[];
  cases: { id: string; title: string; status: string; context: string; group_id: string | null }[];
  bugs: { id: string; title: string; status: string; severity: string; context: string; group_id: string | null }[];
  qaEvidences: { id: string; title: string; kind: string; context: string; group_id: string | null }[];
  retests: { id: string; bug_id: string; result: string; tested_at: string }[];
  tasks: { id: string; title: string; status: string; area: string; group_id: string }[];
  contributions: { id: string; title: string; kind: string; group_id: string; created_at: string }[];
  missions: { id: string; code: string; title: string }[];
};

export function useStudentDossier(studentId: string | null) {
  return useQuery({
    queryKey: ["student-dossier", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<StudentDossier> => {
      const sid = studentId!;
      const [runs, teEv, teBugs, cases, bugs, qaEv, tasks, contribs, missions] = await Promise.all([
        supabase.from("techeduca_mission_runs").select("id, mission_id, status, completed_at").eq("student_id", sid),
        supabase.from("techeduca_evidences").select("id, title, description, created_at").eq("student_id", sid),
        supabase
          .from("techeduca_bug_reports")
          .select("id, feature, problem, classification, created_at")
          .eq("student_id", sid),
        supabase.from("qa_test_cases").select("id, title, status, context, group_id").eq("author_id", sid),
        supabase.from("qa_bugs").select("id, title, status, severity, context, group_id").eq("author_id", sid),
        supabase.from("qa_evidences").select("id, title, kind, context, group_id").eq("author_id", sid),
        supabase.from("cafe_tasks").select("id, title, status, area, group_id").eq("assignee_id", sid),
        supabase
          .from("cafe_contributions")
          .select("id, title, kind, group_id, created_at")
          .eq("student_id", sid),
        supabase.from("techeduca_missions").select("id, code, title"),
      ]);
      const { data: retests } = await supabase
        .from("qa_retests")
        .select("id, bug_id, result, tested_at")
        .eq("tester_id", sid);
      return {
        runs: (runs.data ?? []) as StudentDossier["runs"],
        teEvidences: (teEv.data ?? []) as StudentDossier["teEvidences"],
        teBugs: (teBugs.data ?? []) as StudentDossier["teBugs"],
        cases: (cases.data ?? []) as StudentDossier["cases"],
        bugs: (bugs.data ?? []) as StudentDossier["bugs"],
        qaEvidences: (qaEv.data ?? []) as StudentDossier["qaEvidences"],
        retests: (retests ?? []) as StudentDossier["retests"],
        tasks: (tasks.data ?? []) as StudentDossier["tasks"],
        contributions: (contribs.data ?? []) as StudentDossier["contributions"],
        missions: (missions.data ?? []) as StudentDossier["missions"],
      };
    },
  });
}

export type GroupPortfolio = {
  group: { id: string; name: string; qa_lead_id: string | null } | null;
  members: { student_id: string; member_function: string }[];
  tasks: { id: string; title: string; status: string; area: string; assignee_id: string | null }[];
  contributions: { id: string; title: string; kind: string; student_id: string; created_at: string }[];
  cases: { id: string; title: string; status: string }[];
  bugs: { id: string; title: string; status: string; severity: string }[];
  evidences: { id: string; title: string; kind: string; author_id: string }[];
  run: { id: string; status: string; deliverable: string; submitted_at: string | null } | null;
};

export function useGroupPortfolio(groupId: string | null) {
  return useQuery({
    queryKey: ["group-portfolio", groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<GroupPortfolio> => {
      const gid = groupId!;
      const [group, members, tasks, contribs, cases, bugs, evidences, run] = await Promise.all([
        supabase.from("groups").select("id, name, qa_lead_id").eq("id", gid).maybeSingle(),
        supabase.from("group_members").select("student_id, member_function").eq("group_id", gid),
        supabase.from("cafe_tasks").select("id, title, status, area, assignee_id").eq("group_id", gid),
        supabase
          .from("cafe_contributions")
          .select("id, title, kind, student_id, created_at")
          .eq("group_id", gid),
        supabase.from("qa_test_cases").select("id, title, status").eq("group_id", gid),
        supabase.from("qa_bugs").select("id, title, status, severity").eq("group_id", gid),
        supabase.from("qa_evidences").select("id, title, kind, author_id").eq("group_id", gid),
        supabase
          .from("cafe_group_runs")
          .select("id, status, deliverable, submitted_at")
          .eq("group_id", gid)
          .maybeSingle(),
      ]);
      return {
        group: (group.data ?? null) as GroupPortfolio["group"],
        members: (members.data ?? []) as GroupPortfolio["members"],
        tasks: (tasks.data ?? []) as GroupPortfolio["tasks"],
        contributions: (contribs.data ?? []) as GroupPortfolio["contributions"],
        cases: (cases.data ?? []) as GroupPortfolio["cases"],
        bugs: (bugs.data ?? []) as GroupPortfolio["bugs"],
        evidences: (evidences.data ?? []) as GroupPortfolio["evidences"],
        run: (run.data ?? null) as GroupPortfolio["run"],
      };
    },
  });
}

/* ------------------------------------------------------------------ */
/* Exportação                                                          */
/* ------------------------------------------------------------------ */

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(escape).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
