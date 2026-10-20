import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Consolidação por predominância (moda) das menções vigentes.
 * Este módulo calcula e exibe a consolidação; a gravação na matriz ocorre no
 * banco (consolidate_evaluation) a cada avaliação definitiva, com as mesmas regras.
 */

export type Concept = "A" | "PA" | "NA";
const CONCEPTS: Concept[] = ["A", "PA", "NA"];

export type Vote = {
  missionId: string;
  missionTitle: string;
  version: number;
  concept: Concept;
  date: string;
  individual: boolean; // veio de member_overrides
};

export type Homologation = {
  id: string;
  concept: Concept;
  decision: string;
  reason: string;
  decided_at: string;
};

export type ConsolidationStatus =
  | "no_evidence"
  | "ok"
  | "tie_pending"
  | "reduction_review"
  | "homologated"
  | "divergent_after_homologation";

export type Consolidation = {
  counts: Record<Concept, number>;
  total: number;
  mode: Concept | "tie" | null;
  effective: Concept | null;
  status: ConsolidationStatus;
  changesMatrix: boolean;
  votes: Vote[];
};

export type EvalRow = {
  mission_id: string;
  version: number;
  created_at: string;
  indicator_finals: Record<string, string> | null;
  member_overrides: Record<string, Record<string, string>> | null;
  target_student_ids: string[] | null;
  missionTitle?: string;
};

const isConcept = (v: unknown): v is Concept => v === "A" || v === "PA" || v === "NA";

/** Um voto por missão vigente; diferenciação individual prevalece sobre a menção do grupo. */
export function extractVotes(rows: EvalRow[], studentId: string, indicatorCode: string): Vote[] {
  const byMission = new Map<string, Vote>();
  for (const r of rows) {
    if (!(r.target_student_ids ?? []).includes(studentId)) continue;
    const ov = r.member_overrides?.[studentId]?.[indicatorCode];
    const base = r.indicator_finals?.[indicatorCode];
    const concept = isConcept(ov) ? ov : isConcept(base) ? base : null;
    if (!concept) continue;
    const prev = byMission.get(r.mission_id);
    if (prev && prev.version >= r.version) continue;
    byMission.set(r.mission_id, {
      missionId: r.mission_id,
      missionTitle: r.missionTitle ?? "Missão",
      version: r.version,
      concept,
      date: r.created_at,
      individual: isConcept(ov),
    });
  }
  return [...byMission.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function consolidate(
  votes: Vote[],
  matrixConcept: Concept | null,
  homologation: Homologation | null,
): Consolidation {
  const counts: Record<Concept, number> = { A: 0, PA: 0, NA: 0 };
  for (const v of votes) counts[v.concept]++;
  const total = votes.length;
  const base = { counts, total, votes };

  if (total === 0) {
    const effective = homologation?.concept ?? matrixConcept;
    return { ...base, mode: null, effective, status: homologation ? "homologated" : "no_evidence", changesMatrix: false };
  }

  const max = Math.max(...CONCEPTS.map((c) => counts[c]));
  const leaders = CONCEPTS.filter((c) => counts[c] === max);
  const mode: Concept | "tie" = leaders.length > 1 ? "tie" : (leaders[0] as Concept);

  // Decisão docente vigente nunca é sobrescrita automaticamente.
  if (homologation) {
    const newer = votes.some((v) => v.date > homologation.decided_at);
    const diverges = mode !== homologation.concept;
    return {
      ...base,
      mode,
      effective: homologation.concept,
      status: newer && diverges ? "divergent_after_homologation" : "homologated",
      changesMatrix: homologation.concept !== matrixConcept,
    };
  }

  if (mode === "tie") {
    return { ...base, mode, effective: matrixConcept, status: "tie_pending", changesMatrix: false };
  }

  if (matrixConcept === "A" && mode !== "A") {
    return { ...base, mode, effective: "A", status: "reduction_review", changesMatrix: false };
  }

  return { ...base, mode, effective: mode, status: "ok", changesMatrix: mode !== matrixConcept };
}

export const STATUS_LABEL: Record<ConsolidationStatus, string> = {
  no_evidence: "Sem evidências",
  ok: "Predominância",
  tie_pending: "Empate — decisão pendente",
  reduction_review: "Redução de A — revisão pendente",
  homologated: "Homologado",
  divergent_after_homologation: "Divergência após homologação",
};

export const needsReview = (s: ConsolidationStatus) =>
  s === "tie_pending" || s === "reduction_review" || s === "divergent_after_homologation";

/* ----------------------------- dados ----------------------------- */

export function useStudentConsolidation(studentId: string, classId: string | null) {
  return useQuery({
    queryKey: ["indicator-consolidation", classId, studentId],
    enabled: !!classId && !!studentId,
    queryFn: async () => {
      const [evRes, matrixRes, homRes] = await Promise.all([
        supabase
          .from("builder_run_evaluations")
          .select("mission_id, version, created_at, indicator_finals, member_overrides, target_student_ids, builder_mission_runs!inner(eval_status), builder_missions(title)")
          .eq("is_current", true)
          .eq("builder_mission_runs.eval_status", "evaluated")
          .contains("target_student_ids", [studentId]),
        supabase
          .from("indicator_evaluations")
          .select("indicator_id, concept")
          .eq("class_id", classId!)
          .eq("student_id", studentId),
        supabase
          .from("indicator_homologations")
          .select("id, indicator_id, concept, decision, reason, decided_at")
          .eq("class_id", classId!)
          .eq("student_id", studentId)
          .eq("is_current", true),
      ]);
      if (evRes.error) throw evRes.error;
      if (matrixRes.error) throw matrixRes.error;
      if (homRes.error) throw homRes.error;
      const rows: EvalRow[] = (evRes.data ?? []).map((r) => {
        const row = r as unknown as EvalRow & { builder_missions: { title: string } | null };
        return { ...row, missionTitle: row.builder_missions?.title ?? "Missão" };
      });
      const matrix = new Map((matrixRes.data ?? []).map((m) => [m.indicator_id, (m.concept as Concept | null) ?? null]));
      const homs = new Map((homRes.data ?? []).map((h) => [h.indicator_id, h as unknown as Homologation]));
      return { rows, matrix, homs };
    },
  });
}

export function useHomologate(classId: string | null, studentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      indicatorId: string;
      concept: Concept;
      decision: "confirm_mode" | "override" | "tie_resolution" | "keep_A";
      reason: string;
      basis: Record<string, unknown>;
      decidedBy: string;
    }) => {
      if (input.reason.trim().length < 10) throw new Error("Justificativa obrigatória (mínimo 10 caracteres).");
      const prev = await supabase
        .from("indicator_homologations")
        .update({ is_current: false })
        .eq("class_id", classId!)
        .eq("student_id", studentId)
        .eq("indicator_id", input.indicatorId)
        .eq("is_current", true);
      if (prev.error) throw prev.error;
      const { error } = await supabase.from("indicator_homologations").insert({
        class_id: classId!,
        student_id: studentId,
        indicator_id: input.indicatorId,
        concept: input.concept,
        decision: input.decision,
        reason: input.reason.trim(),
        basis: input.basis as never,
        decided_by: input.decidedBy,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["indicator-consolidation", classId, studentId] }),
  });
}
