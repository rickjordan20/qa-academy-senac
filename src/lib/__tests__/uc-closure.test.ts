import { describe, expect, it } from "vitest";
import { closureDivergence, closureOptions, type EvaluationRow, type IndicatorRow, type UcResult } from "@/lib/assessment";

const mk = (codes: string[]): IndicatorRow[] => codes.map((c, i) => ({ id: c, code: c, description: c, position: i }));
const ev = (m: Record<string, [string | null, string]>) =>
  new Map<string, EvaluationRow>(
    Object.entries(m).map(([id, [concept, stage]]) => [
      id,
      { id, class_id: "c", student_id: "s", indicator_id: id, concept: concept as never, final_result: null, stage, notes: null, evaluated_at: null, evaluated_by: null },
    ]),
  );
const res = (r: "D" | "ND"): UcResult => ({ id: "r", class_id: "c", student_id: "s", final_result: r, notes: "", confirmed_at: "2026-10-25" });

describe("fechamento D/ND", () => {
  const uc10 = mk(["I1", "I2", "I3"]);
  it("D só com todos A", () => {
    expect(closureOptions(uc10, ev({ I1: ["A", "final"], I2: ["A", "final"], I3: ["A", "final"] })).d.allowed).toBe(true);
    expect(closureOptions(uc10, ev({ I1: ["A", "final"], I2: ["PA", "recuperacao"], I3: ["A", "final"] })).d.allowed).toBe(false);
  });
  it("ND após recuperação é regular; antes é excepcional", () => {
    const after = closureOptions(uc10, ev({ I1: ["A", "final"], I2: ["NA", "recuperacao"], I3: ["PA", "recuperacao"] }));
    expect(after.nd).toMatchObject({ allowed: true, exceptional: false });
    const before = closureOptions(uc10, ev({ I1: ["A", "final"], I2: ["NA", "final"], I3: ["A", "final"] }));
    expect(before.nd).toMatchObject({ allowed: true, exceptional: true });
  });
  it("bloqueia com indicador sem menção ou UC sem indicadores", () => {
    const o = closureOptions(uc10, ev({ I1: ["A", "final"] }));
    expect(o.d.allowed || o.nd.allowed).toBe(false);
    expect(closureOptions([], new Map()).nd.allowed).toBe(false);
  });
  it("funciona com outro conjunto de indicadores (outra UC)", () => {
    const uc7 = mk(["X1", "X2", "X3", "X4", "X5", "X6", "X7", "X8"]);
    const all = Object.fromEntries(uc7.map((i) => [i.id, ["A", "final"] as [string, string]]));
    expect(closureOptions(uc7, ev(all)).d.allowed).toBe(true);
  });
  it("sinaliza divergência sem alterar o resultado", () => {
    expect(closureDivergence(uc10, ev({ I1: ["A", "final"], I2: ["PA", "final"], I3: ["A", "final"] }), res("D"))).toMatch(/Reanalise/);
    expect(closureDivergence(uc10, ev({ I1: ["A", "final"], I2: ["A", "final"], I3: ["A", "final"] }), res("ND"))).toMatch(/Reanalise/);
    expect(closureDivergence(uc10, ev({ I1: ["A", "final"], I2: ["A", "final"], I3: ["A", "final"] }), res("D"))).toBeNull();
  });
});
