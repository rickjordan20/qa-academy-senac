import { describe, expect, it } from "vitest";
import { consolidate, extractVotes, type EvalRow, type Vote } from "@/lib/indicator-consolidation";

const v = (concept: "A" | "PA" | "NA", date: string, id = date): Vote => ({
  missionId: id, missionTitle: id, version: 1, concept, date, individual: false,
});

describe("consolidação por predominância", () => {
  it("moda simples: 3 A e 2 PA resulta em A", () => {
    const r = consolidate([v("A", "1"), v("PA", "2"), v("A", "3"), v("PA", "4"), v("A", "5")], "PA", null);
    expect(r.mode).toBe("A");
    expect(r.effective).toBe("A");
    expect(r.status).toBe("ok");
    expect(r.changesMatrix).toBe(true);
  });

  it("empate não escolhe automaticamente e mantém a menção atual", () => {
    const r = consolidate([v("A", "1"), v("PA", "2")], "PA", null);
    expect(r.mode).toBe("tie");
    expect(r.effective).toBe("PA");
    expect(r.status).toBe("tie_pending");
  });

  it("redução de A não é aplicada automaticamente", () => {
    const r = consolidate([v("PA", "1"), v("PA", "2"), v("A", "3")], "A", null);
    expect(r.mode).toBe("PA");
    expect(r.effective).toBe("A");
    expect(r.status).toBe("reduction_review");
  });

  it("homologação docente prevalece sobre a moda", () => {
    const h = { id: "h", concept: "PA" as const, decision: "override", reason: "x".repeat(10), decided_at: "9" };
    const r = consolidate([v("A", "1"), v("A", "2")], "A", h);
    expect(r.effective).toBe("PA");
    expect(r.status).toBe("homologated");
  });

  it("nova evidência divergente após homologação é sinalizada, sem sobrescrever", () => {
    const h = { id: "h", concept: "PA" as const, decision: "override", reason: "x".repeat(10), decided_at: "2" };
    const r = consolidate([v("A", "1"), v("A", "3"), v("A", "4")], "PA", h);
    expect(r.effective).toBe("PA");
    expect(r.status).toBe("divergent_after_homologation");
  });
});

describe("extração de votos", () => {
  const S = "s1";
  const rows: EvalRow[] = [
    { mission_id: "m1", version: 1, created_at: "1", indicator_finals: { I2: "PA" }, member_overrides: {}, target_student_ids: [S] },
    { mission_id: "m1", version: 3, created_at: "3", indicator_finals: { I2: "A" }, member_overrides: {}, target_student_ids: [S] },
    { mission_id: "m2", version: 1, created_at: "2", indicator_finals: { I2: "A" }, member_overrides: { [S]: { I2: "PA" } }, target_student_ids: [S, "s2"] },
    { mission_id: "m3", version: 1, created_at: "4", indicator_finals: {}, member_overrides: {}, target_student_ids: [S] },
    { mission_id: "m4", version: 1, created_at: "5", indicator_finals: { I2: "NA" }, member_overrides: {}, target_student_ids: ["s2"] },
  ];

  it("um voto por missão, usando a versão mais recente", () => {
    const votes = extractVotes(rows, S, "I2");
    expect(votes.map((x) => x.missionId)).toEqual(["m2", "m1"]);
    expect(votes.find((x) => x.missionId === "m1")?.concept).toBe("A");
  });

  it("diferenciação individual prevalece sobre a menção do grupo", () => {
    const m2 = extractVotes(rows, S, "I2").find((x) => x.missionId === "m2");
    expect(m2?.concept).toBe("PA");
    expect(m2?.individual).toBe(true);
    expect(extractVotes(rows, "s2", "I2").find((x) => x.missionId === "m2")?.concept).toBe("A");
  });

  it("missões sem menção e de outros estudantes não contam", () => {
    expect(extractVotes(rows, S, "I2").some((x) => x.missionId === "m3" || x.missionId === "m4")).toBe(false);
  });
});
