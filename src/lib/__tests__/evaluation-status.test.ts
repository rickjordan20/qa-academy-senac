import { describe, expect, it } from "vitest";
import { evaluationNextStatus } from "@/lib/mission-submissions";

describe("status da execução após decisão do instrutor", () => {
  it("avaliação definitiva sempre conclui a execução, mesmo após revisão anterior", () => {
    // Caso real: execução ficou 'in_progress' após pedido de revisão e,
    // ao ser avaliada em definitivo, deve virar 'completed'.
    expect(evaluationNextStatus("evaluated", "in_progress")).toBe("completed");
    expect(evaluationNextStatus("evaluated", "completed")).toBe("completed");
  });

  it("pedido de revisão devolve a execução ao aluno", () => {
    expect(evaluationNextStatus("revision", "completed")).toBe("in_progress");
    expect(evaluationNextStatus("revision", "in_progress")).toBe("in_progress");
  });

  it("rascunho de avaliação não altera o status atual", () => {
    expect(evaluationNextStatus("draft", "completed")).toBe("completed");
    expect(evaluationNextStatus("draft", "in_progress")).toBe("in_progress");
  });
});
