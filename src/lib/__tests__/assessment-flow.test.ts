import { describe, expect, it } from "vitest";
import {
  nextAction,
  ucSituation,
  type EvaluationRow,
  type IndicatorRow,
  type UcResult,
} from "@/lib/assessment";

const inds: IndicatorRow[] = ["I1", "I2", "I3", "I4", "I5", "I6"].map((code, i) => ({
  id: code,
  code,
  description: code,
  position: i,
}));

function ev(
  indicator: string,
  concept: "A" | "PA" | "NA" | null,
  stage: "regular" | "final" | "recuperacao" = "final",
): EvaluationRow {
  return {
    id: indicator,
    class_id: "c",
    student_id: "s",
    indicator_id: indicator,
    concept,
    final_result: null,
    stage,
    notes: null,
    evaluated_at: null,
    evaluated_by: null,
  };
}

const map = (rows: EvaluationRow[]) => new Map(rows.map((r) => [r.indicator_id, r]));
const all = (concept: "A" | "NA", stage: "final" | "recuperacao" = "final") =>
  inds.map((i) => ev(i.id, concept, stage));

describe("fluxo de avaliação UC10", () => {
  it("A — todos A na Avaliação Final sugere D e bloqueia ND", () => {
    const s = ucSituation(inds, map(all("A")));
    expect(s.key).toBe("ready_d");
    expect(s.suggestion).toBe("D");
    expect(s.recoveryDone).toBe(false); // ND indisponível
    expect(nextAction(s).label).toContain("Confirmar resultado D");
  });

  it("B — avaliação parcial permanece em andamento, sem média", () => {
    const s = ucSituation(inds, map([ev("I1", "NA", "regular"), ev("I2", "PA", "regular")]));
    expect(s.key).toBe("in_progress");
    expect(s.suggestion).toBeNull();
  });

  it("B2 — PA em todos os indicadores mantém Avaliação Final em aberto, não recuperação", () => {
    const s = ucSituation(inds, map(inds.map((i) => ev(i.id, "PA", "regular"))));
    expect(s.key).toBe("final_open");
    expect(s.pending).toHaveLength(0);
  });

  it("C — um NA na Avaliação Final exige Recuperação Final e bloqueia ND", () => {
    const rows = all("A").map((r) => (r.indicator_id === "I3" ? ev("I3", "NA") : r));
    const s = ucSituation(inds, map(rows));
    expect(s.key).toBe("needs_recovery");
    expect(s.pending.map((p) => p.code)).toEqual(["I3"]);
    expect(s.suggestion).toBeNull();
    expect(nextAction(s).label).toContain("I3");
  });

  it("D — recuperação bem-sucedida sugere D", () => {
    const rows = all("A").map((r) => (r.indicator_id === "I3" ? ev("I3", "A", "recuperacao") : r));
    const s = ucSituation(inds, map(rows));
    expect(s.key).toBe("ready_d");
    expect(s.suggestion).toBe("D");
  });

  it("E — recuperação sem sucesso libera ND", () => {
    const rows = all("A").map((r) => (r.indicator_id === "I3" ? ev("I3", "NA", "recuperacao") : r));
    const s = ucSituation(inds, map(rows));
    expect(s.key).toBe("ready_nd");
    expect(s.suggestion).toBe("ND");
    expect(s.recoveryDone).toBe(true);
  });

  it("F — dois NA: só libera ND quando ambos passaram pela recuperação", () => {
    const base = all("A").map((r) =>
      r.indicator_id === "I2" || r.indicator_id === "I5" ? ev(r.indicator_id, "NA") : r,
    );
    const parcial = base.map((r) => (r.indicator_id === "I2" ? ev("I2", "NA", "recuperacao") : r));
    const sParcial = ucSituation(inds, map(parcial));
    expect(sParcial.key).toBe("in_recovery");
    expect(sParcial.suggestion).toBeNull();

    const ambos = parcial.map((r) => (r.indicator_id === "I5" ? ev("I5", "NA", "recuperacao") : r));
    expect(ucSituation(inds, map(ambos)).suggestion).toBe("ND");

    const recuperados = ambos.map((r) =>
      r.concept === "NA" ? ev(r.indicator_id, "A", "recuperacao") : r,
    );
    expect(ucSituation(inds, map(recuperados)).suggestion).toBe("D");
  });

  it("resultado confirmado prevalece e ausência de avaliação não vira NA", () => {
    const result: UcResult = {
      id: "r",
      class_id: "c",
      student_id: "s",
      final_result: "D",
      notes: "",
      confirmed_at: new Date().toISOString(),
    };
    expect(ucSituation(inds, map(all("A")), result).key).toBe("D");
    const vazio = ucSituation(inds, map([]));
    expect(vazio.key).toBe("not_evaluated");
    expect(vazio.pending).toHaveLength(0);
  });

  it("próxima ação prioriza reavaliação e avaliação de entregas", () => {
    const s = ucSituation(inds, map(all("A")));
    expect(nextAction(s, { reeval: 1, reevalTitle: "Missão 05" }).label).toBe("Reavaliar Missão 05");
    expect(nextAction(s, { awaiting: 2 }).label).toBe("Avaliar 2 entrega(s)");
  });
});
