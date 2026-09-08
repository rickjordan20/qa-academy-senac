import { describe, expect, it } from "vitest";
import { riskFlags, riskScore, type RiskInput } from "@/lib/instructor-overview";
import type { UcSituation } from "@/lib/assessment";

const sit = (key: UcSituation["key"], pending: string[] = []): UcSituation => ({
  key,
  label: key,
  pending: pending.map((code, i) => ({
    id: `i${i}`,
    code,
    description: "",
    uc_code: "UC10",
    uc_title: "",
    position: i,
  })) as UcSituation["pending"],
  suggestion: null,
  recoveryDone: false,
});

const base: RiskInput = {
  situation: sit("in_progress"),
  evaluatedCount: 6,
  totalIndicators: 6,
  deliveries: 3,
  overdueMissing: 0,
  openMissions: 3,
  inGroup: true,
  contributions: 2,
  contributionsTracked: true,
  acknowledged: true,
};

describe("riskFlags", () => {
  it("não aponta risco para aluno em dia", () => {
    expect(riskFlags(base)).toEqual([]);
  });

  it("aponta recuperação necessária como risco máximo", () => {
    const flags = riskFlags({ ...base, situation: sit("needs_recovery", ["I2"]) });
    expect(flags[0]?.code).toBe("needs_recovery");
    expect(flags[0]?.label).toContain("I2");
  });

  it("aponta missões vencidas sem entrega", () => {
    const flags = riskFlags({ ...base, overdueMissing: 2 });
    expect(flags.map((f) => f.code)).toContain("overdue");
  });

  it("aponta ausência total de entregas apenas com missões abertas", () => {
    expect(riskFlags({ ...base, deliveries: 0 }).map((f) => f.code)).toContain("no_delivery");
    expect(
      riskFlags({ ...base, deliveries: 0, openMissions: 0 }).map((f) => f.code),
    ).not.toContain("no_delivery");
  });

  it("aponta poucos indicadores avaliados", () => {
    expect(riskFlags({ ...base, evaluatedCount: 1 }).map((f) => f.code)).toContain("few_evaluated");
  });

  it("não aponta poucos indicadores para UC já confirmada", () => {
    expect(
      riskFlags({ ...base, evaluatedCount: 0, situation: sit("D") }).map((f) => f.code),
    ).not.toContain("few_evaluated");
  });

  it("só aponta falta de participação quando há dados de contribuição", () => {
    expect(riskFlags({ ...base, contributions: 0 }).map((f) => f.code)).toContain("no_participation");
    expect(
      riskFlags({ ...base, contributions: 0, contributionsTracked: false }).map((f) => f.code),
    ).not.toContain("no_participation");
    expect(
      riskFlags({ ...base, contributions: 0, inGroup: false }).map((f) => f.code),
    ).not.toContain("no_participation");
  });

  it("aponta falta de ciência da avaliação com peso baixo", () => {
    const flags = riskFlags({ ...base, acknowledged: false });
    expect(flags).toHaveLength(1);
    expect(flags[0]?.code).toBe("no_ack");
    expect(riskScore(flags)).toBe(10);
  });

  it("ordena por gravidade decrescente", () => {
    const flags = riskFlags({
      ...base,
      situation: sit("needs_recovery", ["I1"]),
      overdueMissing: 1,
      acknowledged: false,
    });
    expect(flags.map((f) => f.weight)).toEqual([...flags.map((f) => f.weight)].sort((a, b) => b - a));
  });
});
