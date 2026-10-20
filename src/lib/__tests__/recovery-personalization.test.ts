import { describe, expect, it } from "vitest";
import { filterSectionsByIndicators, isTargetConcept } from "@/lib/recovery-personalization";
import type { Section } from "@/lib/mission-builder";

const s = (id: string, codes: string[]) => ({ id, indicator_codes: codes }) as unknown as Section;
const sections = [s("intro", []), s("b1", ["I1"]), s("b2", ["I2"]), s("b6a", ["I6"]), s("b6b", ["I6"])];

describe("recuperação personalizada", () => {
  it("PA e NA entram; A e sem menção não", () => {
    expect(isTargetConcept("PA")).toBe(true);
    expect(isTargetConcept("NA")).toBe(true);
    expect(isTargetConcept("A")).toBe(false);
    expect(isTargetConcept(null)).toBe(false);
  });
  it("mostra só blocos dos indicadores pendentes, com I6 juntos", () => {
    expect(filterSectionsByIndicators(sections, ["I6"]).map((x) => x.id)).toEqual(["intro", "b6a", "b6b"]);
  });
  it("sem conjunto (missão comum) não filtra", () => {
    expect(filterSectionsByIndicators(sections, null)).toHaveLength(5);
  });
  it("conjunto vazio oculta todos os blocos de indicador", () => {
    expect(filterSectionsByIndicators(sections, []).map((x) => x.id)).toEqual(["intro"]);
  });
});
