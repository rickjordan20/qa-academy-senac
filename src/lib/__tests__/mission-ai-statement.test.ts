import { describe, expect, it } from "vitest";
import { oversizedStatements, sanitizeEvaluation, STATEMENT_LIMITS, type AiAnswer, type CtxBlock, type EvalContext } from "@/lib/mission-ai-evaluation";

const code = `function verificarResultado(nota, entregou) {\n  if (entregou === false) { return "Pendente"; }\n  if (nota >= 7) { return "Aprovado"; }\n  return "Revisão";\n}\n`;
const blk = (over: Partial<CtxBlock>): CtxBlock => ({
  section_id: "b", title: "B", kind: "k", description: "", instructions: "", indicator_codes: ["I5"], xp_max: 0,
  required: true, questions: [], answers: [{ label: "Q", value: "resp" }], entries: [], ...over,
});
const ctx = (blocks: CtxBlock[], target: string[] | null = null): EvalContext => ({
  mission: { title: "M", objective: "", description: "", base_xp: 0, xp_cap: 0 }, indicators: [], group: null, blocks, recovery_indicator_codes: target,
});
const ans = (id: string, code: string, mention: string | null): AiAnswer => ({
  blocks: [{ section_id: id, indicators: [{ code, mention, justification: "j" }], xp: 0, feedback: "f", evidence_used: [], needs_review: false, alerts: [] }],
  general_feedback: "Bom trabalho.", member_overrides: [], alerts: [],
});

describe("enunciado completo na avaliação com IA", () => {
  it("enunciado longo com código JavaScript dentro do limite é aceito", () => {
    const body = "OBJETIVO ...\n" + code + "x".repeat(3000);
    expect(oversizedStatements([{ title: "I5", body }])).toEqual([]);
  });
  it("enunciado acima do limite é sinalizado (sem truncar em silêncio)", () => {
    expect(oversizedStatements([{ title: "I5", body: "x".repeat(STATEMENT_LIMITS.instructions + 1) }])).toEqual(["I5"]);
  });
  it("bloco com várias perguntas mantém todas com identificador", () => {
    const b = blk({ questions: [{ id: "q1", label: "P1", required: true }, { id: "q2", label: "P2", required: true }, { id: "q3", label: "P3", required: false }] });
    expect(b.questions!.map((q) => q.id)).toEqual(["q1", "q2", "q3"]);
  });
  it("resposta parcialmente correta: PA é preservado", () => {
    expect(sanitizeEvaluation(ans("b", "I5", "PA"), ctx([blk({})])).finals).toEqual({ I5: "PA" });
  });
  it("bloco opcional sem evidência: sem NA punitivo e com revisão docente", () => {
    const r = sanitizeEvaluation(ans("m2", "I2", "NA"), ctx([blk({ section_id: "m2", indicator_codes: ["I2"], required: false, answers: [] })]));
    expect(r.finals).toEqual({});
    expect(r.blocks[0]!.needs_review).toBe(true);
  });
  it("bloco opcional sem evidência: nunca A automático", () => {
    const r = sanitizeEvaluation(ans("m2", "I2", "A"), ctx([blk({ section_id: "m2", indicator_codes: ["I2"], required: false, answers: [] })]));
    expect(r.finals).toEqual({});
  });
  it("bloco obrigatório sem evidência continua podendo receber NA", () => {
    const r = sanitizeEvaluation(ans("b", "I5", "NA"), ctx([blk({ answers: [] })]));
    expect(r.finals).toEqual({ I5: "NA" });
  });
  it("recuperação com vários indicadores: só os liberados", () => {
    const r = sanitizeEvaluation(ans("b", "I5", "A"), ctx([blk({}), blk({ section_id: "c", indicator_codes: ["I1"] })], ["I5"]));
    expect(Object.keys(r.finals)).toEqual(["I5"]);
  });
  it("missão convencional: todos os blocos avaliados", () => {
    const r = sanitizeEvaluation(ans("b", "I5", "A"), ctx([blk({}), blk({ section_id: "c", indicator_codes: ["I1"] })]));
    expect(r.blocks).toHaveLength(2);
  });
});
