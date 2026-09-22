import { describe, expect, it } from "vitest";
import { BUG_WORKFLOW, canTransitionBug, isBugWorkflowStatus, validateRetest } from "./bug-workflow";

describe("Aula 9: fluxo de bugs", () => {
  it("reconhece apenas status conhecidos", () => {
    expect(isBugWorkflowStatus("aberto")).toBe(true);
    expect(isBugWorkflowStatus("inexistente")).toBe(false);
  });

  it("rejeita transições inexistentes e identidade", () => {
    expect(canTransitionBug("aberto", "resolvido", "developer")).toBe(false);
    expect(canTransitionBug("aberto", "aberto", "developer")).toBe(false);
    expect(canTransitionBug("inexistente", "aberto", "developer")).toBe(false);
  });

  it("reserva análise e correção ao desenvolvedor", () => {
    for (const [from, to] of [
      ["aberto", "em_analise"], ["aberto", "descartado"], ["em_analise", "confirmado"],
      ["em_analise", "descartado"], ["confirmado", "em_correcao"],
      ["confirmado", "descartado"], ["em_correcao", "pronto_reteste"],
      ["reaberto", "em_analise"], ["reaberto", "em_correcao"],
    ]) {
      expect(canTransitionBug(from, to, "developer")).toBe(true);
      expect(canTransitionBug(from, to, "tester")).toBe(false);
    }
  });

  it("reserva reteste e reabertura ao tester", () => {
    for (const [from, to] of [
      ["pronto_reteste", "resolvido"], ["pronto_reteste", "reaberto"],
      ["resolvido", "reaberto"], ["descartado", "reaberto"],
    ]) {
      expect(canTransitionBug(from, to, "tester")).toBe(true);
      expect(canTransitionBug(from, to, "developer")).toBe(false);
    }
  });

  it("não promete override do instrutor que não existe no banco", () => {
    for (const [from, destinations] of Object.entries(BUG_WORKFLOW)) {
      for (const to of destinations) expect(canTransitionBug(from, to, "instructor")).toBe(false);
    }
  });

  it("exige autenticação, estado pronto e observações no reteste", () => {
    const valid = { status: "pronto_reteste", result: "resolvido" as const, notes: "Corrigido e validado", testerId: "tester-1" };
    expect(validateRetest(valid)).toBeNull();
    expect(validateRetest({ ...valid, testerId: null })).toMatch(/autenticado/);
    expect(validateRetest({ ...valid, status: "aberto" })).toMatch(/pronto/);
    expect(validateRetest({ ...valid, notes: "  " })).toMatch(/resultado/);
  });

  it("mantém todos os destinos do fluxo como status válidos", () => {
    for (const destinations of Object.values(BUG_WORKFLOW)) {
      for (const status of destinations) expect(isBugWorkflowStatus(status)).toBe(true);
    }
  });
});
