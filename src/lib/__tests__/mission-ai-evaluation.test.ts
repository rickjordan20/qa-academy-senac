import { describe, expect, it } from "vitest";
import { mergeSuggestion, missionXpCap, sanitizeEvaluation, type AiAnswer, type EvalContext, type FormState } from "@/lib/mission-ai-evaluation";

const ctx = (over: Partial<EvalContext> = {}): EvalContext => ({
  mission: { title: "M", objective: "", description: "", base_xp: 50, xp_cap: 50 },
  indicators: [],
  blocks: [
    { section_id: "b1", title: "Bugs", kind: "bugs", description: "", instructions: "", indicator_codes: ["I1", "I2"], xp_max: 30, answers: [{ label: "Q", value: "resposta" }], entries: [] },
    { section_id: "b2", title: "Casos", kind: "cases", description: "", instructions: "", indicator_codes: ["I2"], xp_max: 30, answers: [], entries: [{ title: "CT1", kind: "case", author: null, data: {}, link: null }] },
    { section_id: "b3", title: "Vazio", kind: "report", description: "", instructions: "", indicator_codes: ["I3"], xp_max: 20, answers: [], entries: [] },
  ],
  group: null,
  ...over,
});

const ai = (over: Partial<AiAnswer> = {}): AiAnswer => ({
  blocks: [
    { section_id: "b1", indicators: [{ code: "I1", mention: "A", justification: "ok" }, { code: "I2", mention: "PA", justification: "parcial" }], xp: 999, feedback: "Bom", evidence_used: ["Q"], needs_review: false, alerts: [] },
    { section_id: "b2", indicators: [{ code: "I2", mention: "A", justification: "ok" }], xp: 25, feedback: "Ótimo", evidence_used: ["CT1"], needs_review: false, alerts: [] },
    { section_id: "b3", indicators: [{ code: "I3", mention: "A", justification: "inventado" }], xp: 20, feedback: "", evidence_used: [], needs_review: false, alerts: [] },
  ],
  general_feedback: "Geral",
  member_overrides: [],
  alerts: [],
  ...over,
});

const empty: FormState = { xp: "", feedback: "", blockConcepts: {}, blockComments: {}, finals: {}, memberOverrides: {}, overrideNotes: "" };

describe("avaliação assistida por IA", () => {
  it("XP de cada bloco respeita o limite do bloco", () => {
    const r = sanitizeEvaluation(ai(), ctx());
    expect(r.blocks[0]!.xp).toBe(30);
    expect(r.blocks[1]!.xp).toBe(25);
  });
  it("XP total respeita o XP máximo da missão", () => {
    expect(sanitizeEvaluation(ai(), ctx()).xp).toBe(50);
  });
  it("teto da missão: XP base; sem base, soma dos blocos", () => {
    expect(missionXpCap(50, [30, 30])).toBe(50);
    expect(missionXpCap(0, [30, 20])).toBe(50);
  });
  it("bloco sem evidência não recebe A/PA nem XP e pede revisão docente", () => {
    const b3 = sanitizeEvaluation(ai(), ctx()).blocks[2]!;
    expect(b3.indicators["I3"]).toBeUndefined();
    expect(b3.xp).toBe(0);
    expect(b3.needs_review).toBe(true);
  });
  it("indicador fora do bloco é descartado", () => {
    const r = sanitizeEvaluation(ai({ blocks: [{ section_id: "b2", indicators: [{ code: "I9", mention: "A", justification: "" }], xp: 1, feedback: "", evidence_used: [], needs_review: false, alerts: [] }] }), ctx());
    expect(r.blocks[1]!.indicators).toEqual({});
  });
  it("menção final usa a regra existente (qualquer PA → PA)", () => {
    const r = sanitizeEvaluation(ai(), ctx());
    expect(r.finals).toEqual({ I1: "A", I2: "PA" });
  });
  it("resposta inválida da IA não quebra e exige revisão", () => {
    const r = sanitizeEvaluation({} as AiAnswer, ctx());
    expect(r.blocks.every((b) => b.needs_review)).toBe(true);
    expect(r.finals).toEqual({});
  });
  it("diferenciação individual só para integrante real e com justificativa", () => {
    const g = ctx({ group: { members: [{ id: "s1", name: "Ana", role: "", tasks_assigned: 0, tasks_done: 0, contributions: 2, entries: 1 }] } });
    const r = sanitizeEvaluation(
      ai({ member_overrides: [
        { student_id: "s1", code: "I1", mention: "PA", reason: "sem evidências do bloco atribuído" },
        { student_id: "x", code: "I1", mention: "NA", reason: "integrante inexistente aqui" },
        { student_id: "s1", code: "I2", mention: "NA", reason: "curta" },
      ] }),
      g,
    );
    expect(r.memberOverrides).toEqual({ s1: { I1: "PA" } });
  });
  it("aplicar preenche campos vazios sem salvar nada", () => {
    const r = sanitizeEvaluation(ai(), ctx());
    const { next, conflicts } = mergeSuggestion(empty, r, new Set(), false);
    expect(conflicts).toHaveLength(0);
    expect(next.blockConcepts["b1"]).toEqual({ I1: "A", I2: "PA" });
    expect(next.xp).toBe("50");
    expect(next.feedback).toBe("Geral");
  });
  it("campos editados pelo instrutor são preservados até confirmar substituição", () => {
    const r = sanitizeEvaluation(ai(), ctx());
    const form = { ...empty, feedback: "Meu texto", blockConcepts: { b1: { I1: "NA" } } };
    const touched = new Set(["feedback", "block:b1:I1"]);
    const kept = mergeSuggestion(form, r, touched, false);
    expect(kept.next.feedback).toBe("Meu texto");
    expect(kept.next.blockConcepts["b1"]!["I1"]).toBe("NA");
    expect(kept.conflicts.map((c) => c.field).sort()).toEqual(["block:b1:I1", "feedback"]);
    const replaced = mergeSuggestion(form, r, touched, true);
    expect(replaced.next.feedback).toBe("Geral");
    expect(replaced.next.blockConcepts["b1"]!["I1"]).toBe("A");
  });
  it("aplicar não altera o objeto do formulário original", () => {
    const r = sanitizeEvaluation(ai(), ctx());
    const form = { ...empty, blockConcepts: { b1: {} } };
    mergeSuggestion(form, r, new Set(), true);
    expect(form.blockConcepts.b1).toEqual({});
  });
  it("blocos sem XP próprio: não sugere XP e pede revisão docente", () => {
    const c = ctx();
    c.blocks = c.blocks.map((b) => ({ ...b, xp_max: 0 }));
    const r = sanitizeEvaluation(ai(), c);
    expect(r.xp).toBeNull();
    expect(r.alerts.some((a) => a.includes("XP manualmente"))).toBe(true);
    const { next } = mergeSuggestion({ ...empty, xp: "50" }, r, new Set(), true);
    expect(next.xp).toBe("50");
  });
});
