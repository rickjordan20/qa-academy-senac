import { describe, expect, it } from "vitest";
import { mergeSuggestion, sanitizeEvaluation, scopeBlocksToTarget, type AiAnswer, type CtxBlock, type EvalContext } from "@/lib/mission-ai-evaluation";

const blk = (id: string, codes: string[], answered = true): CtxBlock => ({
  section_id: id, title: id, kind: "k", description: "", instructions: "", indicator_codes: codes, xp_max: 0,
  answers: answered ? [{ label: "Q", value: "resposta" }] : [], entries: [],
});
// Os 7 blocos reais da Recuperação Final
const all = [blk("p1", ["I1"]), blk("m2", ["I2"], false), blk("c3", ["I3"]), blk("u4", ["I4"]), blk("e5", ["I5"]), blk("c6", ["I6"]), blk("v6", ["I6"])];
const ctx = (target: string[] | null): EvalContext => ({
  mission: { title: "Rec", objective: "", description: "", base_xp: 0, xp_cap: 0 }, indicators: [], group: null,
  blocks: all, recovery_indicator_codes: target,
});
// IA "erra" e devolve menção NA para todos os blocos
const aiAll: AiAnswer = {
  blocks: all.map((b) => ({ section_id: b.section_id, indicators: b.indicator_codes.map((c) => ({ code: c, mention: "NA", justification: "x" })), xp: 0, feedback: "f", evidence_used: [], needs_review: false, alerts: [`Faltou ${b.indicator_codes[0]}`] })),
  general_feedback: "Você foi bem no I5. Porém não fez o I1. Continue estudando.",
  member_overrides: [], alerts: ["Bloco do I3 sem resposta."],
};
const ids = (t: string[] | null) => scopeBlocksToTarget(all, t).map((b) => b.section_id);

describe("avaliação com IA respeita os indicadores da recuperação", () => {
  it("somente I5", () => expect(ids(["I5"])).toEqual(["e5"]));
  it("I2, I3 e I5", () => expect(ids(["I2", "I3", "I5"])).toEqual(["m2", "c3", "e5"]));
  it("I4, I5 e I6 mantém os dois blocos do I6", () => expect(ids(["I4", "I5", "I6"])).toEqual(["u4", "e5", "c6", "v6"]));
  it("somente I6: dois blocos juntos", () => expect(ids(["I6"])).toEqual(["c6", "v6"]));
  it("todos em A: nenhum bloco", () => expect(ids([])).toEqual([]));
  it("missão convencional: todos os blocos", () => expect(ids(null)).toHaveLength(7));

  it("sugestões, menções finais, alertas e feedback ignoram indicadores dispensados", () => {
    const r = sanitizeEvaluation(aiAll, ctx(["I5"]));
    expect(r.blocks.map((b) => b.section_id)).toEqual(["e5"]);
    expect(Object.keys(r.finals)).toEqual(["I5"]);
    expect(r.alerts.join(" ")).not.toMatch(/\bI3\b/);
    expect(r.generalFeedback).toContain("I5");
    expect(r.generalFeedback).not.toMatch(/\bI1\b/);
    const { next } = mergeSuggestion({ xp: "", feedback: "", blockConcepts: {}, blockComments: {}, finals: {}, memberOverrides: {}, overrideNotes: "" }, r, new Set(), false);
    expect(Object.keys(next.blockConcepts)).toEqual(["e5"]);
    expect(Object.keys(next.finals)).toEqual(["I5"]);
  });
  it("bloco liberado sem resposta pede revisão, sem tocar nos ocultos", () => {
    const r = sanitizeEvaluation(aiAll, ctx(["I2", "I5"]));
    expect(r.blocks.find((b) => b.section_id === "m2")!.needs_review).toBe(true);
    expect(Object.keys(r.finals).sort()).toEqual(["I2", "I5"]);
  });
  it("missão convencional continua igual", () => {
    expect(Object.keys(sanitizeEvaluation(aiAll, ctx(null)).finals)).toHaveLength(6);
  });
});
