import { consolidate, extractVotes, type Concept, type EvalRow, type Homologation } from "@/lib/indicator-consolidation";

/**
 * Análise pedagógica por indicador: monta o contexto (só do aluno × indicador)
 * enviado à IA e valida a resposta. Nada aqui grava no banco.
 */

export type SourceEval = EvalRow & {
  id: string;
  feedback: string | null;
  block_results: { section_id: string; title: string; comment: string; indicators: Record<string, string> }[] | null;
  override_notes: string | null;
};

export type AnalysisInput = {
  studentId: string;
  indicatorCode: string;
  indicatorDescription: string;
  stage: string;
  evals: SourceEval[];
  matrixConcept: Concept | null;
  homologation: Homologation | null;
  feedbacks: { message: string; created_at: string }[];
  history: { concept: string | null; stage: string; notes: string | null; created_at: string }[];
};

export type MissionEvidence = {
  missionId: string;
  title: string;
  date: string;
  concept: Concept;
  individual: boolean;
  blocks: { title: string; result: string; comment: string }[];
  generalFeedback: string;
};

export type AnalysisContext = ReturnType<typeof buildAnalysisContext>;

const clip = (s: string | null | undefined, n = 400) => (s ?? "").trim().replace(/\s+/g, " ").slice(0, n);

export function buildAnalysisContext(input: AnalysisInput) {
  const votes = extractVotes(input.evals, input.studentId, input.indicatorCode);
  const cons = consolidate(votes, input.matrixConcept, input.homologation);
  const byMission = new Map<string, SourceEval>();
  for (const e of input.evals) {
    const prev = byMission.get(e.mission_id);
    if (!prev || e.version > prev.version) byMission.set(e.mission_id, e);
  }
  const missions: MissionEvidence[] = votes.map((v) => {
    const e = byMission.get(v.missionId)!;
    return {
      missionId: v.missionId,
      title: v.missionTitle,
      date: v.date,
      concept: v.concept,
      individual: v.individual,
      blocks: (e.block_results ?? [])
        .filter((b) => b.indicators?.[input.indicatorCode])
        .map((b) => ({ title: b.title, result: b.indicators[input.indicatorCode], comment: clip(b.comment, 300) })),
      generalFeedback: clip(e.feedback),
    };
  });
  const limitations: string[] = [];
  if (missions.length === 0) limitations.push("Nenhuma missão avaliada de forma definitiva para este indicador.");
  else if (missions.length < 2) limitations.push("Apenas uma missão avaliada: evidência limitada para inferir evolução.");
  if (cons.status === "tie_pending") limitations.push("Empate na predominância: decisão docente pendente.");
  if (cons.status === "reduction_review") limitations.push("Predominância abaixo do A vigente: redução de A requer revisão docente.");
  if (cons.status === "divergent_after_homologation")
    limitations.push("Novas evidências divergem da homologação docente vigente.");
  return {
    indicator: { code: input.indicatorCode, description: input.indicatorDescription },
    stage: input.stage,
    matrixConcept: input.matrixConcept,
    counts: cons.counts,
    mode: cons.mode,
    status: cons.status,
    homologation: input.homologation
      ? { concept: input.homologation.concept, reason: clip(input.homologation.reason, 300) }
      : null,
    missions,
    feedbacks: input.feedbacks.slice(0, 5).map((f) => clip(f.message, 300)),
    history: input.history.slice(0, 5).map((h) => ({ concept: h.concept, stage: h.stage, notes: clip(h.notes, 200) })),
    limitations,
    sufficient: missions.length > 0,
  };
}

export type AiAnswer = {
  suggested_mention: Concept | null;
  feedback: string;
  evidence_used: { mission_id: string; reason: string }[];
  limitations: string[];
};

/** Descarta fontes inventadas e menções inválidas. */
export function sanitizeAnswer(ans: AiAnswer, ctx: AnalysisContext) {
  const known = new Map(ctx.missions.map((m) => [m.missionId, m]));
  const sources = (ans.evidence_used ?? [])
    .filter((e) => known.has(e.mission_id))
    .map((e) => ({ missionId: e.mission_id, title: known.get(e.mission_id)!.title, concept: known.get(e.mission_id)!.concept, reason: clip(e.reason, 240) }));
  const invented = (ans.evidence_used ?? []).length - sources.length;
  const limitations = [...ctx.limitations, ...(ans.limitations ?? []).map((l) => clip(l, 240)).filter(Boolean)];
  if (invented > 0) limitations.push(`${invented} fonte(s) citada(s) pela IA não existiam e foram descartadas.`);
  const mention: Concept | null =
    ctx.sufficient && (ans.suggested_mention === "A" || ans.suggested_mention === "PA" || ans.suggested_mention === "NA")
      ? ans.suggested_mention
      : null;
  return { suggestedMention: mention, feedback: (ans.feedback ?? "").trim(), sources, limitations: [...new Set(limitations)] };
}

/** Impressão digital das evidências: muda quando avaliações, feedbacks, histórico ou homologação mudam. */
export function evidenceFingerprint(parts: unknown[]): string {
  const s = JSON.stringify(parts);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}
