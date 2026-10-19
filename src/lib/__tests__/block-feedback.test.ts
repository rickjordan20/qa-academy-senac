import { describe, expect, it } from "vitest";
import { hasBlockFeedback, pickDisplayEvaluation } from "@/components/missions/BlockFeedback";
import type { RunEvaluation } from "@/lib/mission-submissions";

const ev = (version: number, is_current: boolean) =>
  ({ id: `e${version}`, version, is_current, block_results: [] }) as unknown as RunEvaluation;

describe("avaliação exibida ao aluno", () => {
  it("prefere a avaliação vigente", () => {
    const p = pickDisplayEvaluation([ev(3, false), ev(2, true)]);
    expect(p?.evaluation.version).toBe(2);
    expect(p?.isCurrent).toBe(true);
  });
  it("em revisão (sem vigente) mostra a mais recente, marcada como não vigente", () => {
    const p = pickDisplayEvaluation([ev(1, false), ev(2, false)]);
    expect(p?.evaluation.version).toBe(2);
    expect(p?.isCurrent).toBe(false);
  });
  it("sem avaliações não mostra nada", () => {
    expect(pickDisplayEvaluation([])).toBeNull();
  });
  it("bloco só com comentário é exibido", () => {
    expect(hasBlockFeedback({ section_id: "s", title: "", comment: "Ajuste", indicators: {} })).toBe(true);
  });
  it("bloco sem avaliação não é exibido", () => {
    expect(hasBlockFeedback({ section_id: "s", title: "", comment: " ", indicators: { I1: "" } })).toBe(false);
    expect(hasBlockFeedback(undefined)).toBe(false);
  });
});
