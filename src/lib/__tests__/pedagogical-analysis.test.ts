import { describe, expect, it } from "vitest";
import { buildAnalysisContext, evidenceFingerprint, sanitizeAnswer, type SourceEval } from "@/lib/pedagogical-analysis";

const S = "stu-1";
const ev = (mission: string, version: number, concept: string, date: string, extra: Partial<SourceEval> = {}): SourceEval => ({
  id: `${mission}-${version}`,
  mission_id: mission,
  missionTitle: `Missão ${mission}`,
  version,
  created_at: date,
  indicator_finals: { I2: concept },
  member_overrides: null,
  target_student_ids: [S],
  feedback: "Bom trabalho",
  block_results: [{ section_id: "b", title: "Casos de teste", comment: "Cobertura boa", indicators: { I2: concept } }],
  override_notes: null,
  ...extra,
});
const base = { studentId: S, indicatorCode: "I2", indicatorDescription: "Desc", stage: "regular", matrixConcept: null, homologation: null, feedbacks: [], history: [] };

describe("análise pedagógica — contexto", () => {
  it("várias missões: conta um voto por missão em ordem cronológica", () => {
    const c = buildAnalysisContext({ ...base, evals: [ev("m2", 1, "A", "2026-10-02"), ev("m1", 1, "PA", "2026-10-01"), ev("m3", 1, "A", "2026-10-03")] });
    expect(c.counts).toEqual({ A: 2, PA: 1, NA: 0 });
    expect(c.missions.map((m) => m.missionId)).toEqual(["m1", "m2", "m3"]);
    expect(c.sufficient).toBe(true);
  });
  it("poucas evidências: sinaliza limitação", () => {
    const c = buildAnalysisContext({ ...base, evals: [ev("m1", 1, "A", "2026-10-01")] });
    expect(c.limitations.some((l) => l.includes("Apenas uma missão"))).toBe(true);
  });
  it("sem evidências: insuficiente", () => {
    const c = buildAnalysisContext({ ...base, evals: [] });
    expect(c.sufficient).toBe(false);
  });
  it("diferenciação individual prevalece sobre a menção do grupo", () => {
    const c = buildAnalysisContext({ ...base, evals: [ev("m1", 1, "A", "2026-10-01", { member_overrides: { [S]: { I2: "PA" } } })] });
    expect(c.missions[0]).toMatchObject({ concept: "PA", individual: true });
  });
  it("reavaliação da mesma missão não duplica o voto", () => {
    const c = buildAnalysisContext({ ...base, evals: [ev("m1", 1, "NA", "2026-10-01"), ev("m1", 2, "A", "2026-10-05")] });
    expect(c.counts).toEqual({ A: 1, PA: 0, NA: 0 });
  });
  it("empate e redução de A aparecem como limitação", () => {
    const tie = buildAnalysisContext({ ...base, evals: [ev("m1", 1, "A", "2026-10-01"), ev("m2", 1, "PA", "2026-10-02")] });
    expect(tie.status).toBe("tie_pending");
    const red = buildAnalysisContext({ ...base, matrixConcept: "A", evals: [ev("m1", 1, "PA", "2026-10-01")] });
    expect(red.status).toBe("reduction_review");
  });
  it("homologação docente existente é respeitada", () => {
    const c = buildAnalysisContext({
      ...base,
      homologation: { id: "h", concept: "A", decision: "override", reason: "Decisão docente fundamentada", decided_at: "2026-09-01" },
      evals: [ev("m1", 1, "PA", "2026-10-01")],
    });
    expect(c.status).toBe("divergent_after_homologation");
    expect(c.homologation?.concept).toBe("A");
  });
});

describe("análise pedagógica — resposta da IA", () => {
  const ctx = buildAnalysisContext({ ...base, evals: [ev("m1", 1, "A", "2026-10-01"), ev("m2", 1, "A", "2026-10-02")] });
  it("descarta fontes inventadas", () => {
    const r = sanitizeAnswer({ suggested_mention: "A", feedback: "Texto", evidence_used: [{ mission_id: "m1", reason: "ok" }, { mission_id: "fake", reason: "x" }], limitations: [] }, ctx);
    expect(r.sources.map((s) => s.missionId)).toEqual(["m1"]);
    expect(r.limitations.some((l) => l.includes("descartadas"))).toBe(true);
  });
  it("sem evidência suficiente nunca sugere menção", () => {
    const empty = buildAnalysisContext({ ...base, evals: [] });
    expect(sanitizeAnswer({ suggested_mention: "A", feedback: "t", evidence_used: [], limitations: [] }, empty).suggestedMention).toBeNull();
  });
  it("impressão digital muda quando as evidências mudam", () => {
    expect(evidenceFingerprint([1, "a"])).not.toBe(evidenceFingerprint([1, "b"]));
  });
});
