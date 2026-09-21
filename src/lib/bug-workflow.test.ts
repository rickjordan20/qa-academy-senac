import { describe, expect, it } from "vitest";
import { BUG_WORKFLOW, canTransitionBug, isBugWorkflowStatus, validateRetest } from "./bug-workflow";

describe("Aula 9: fluxo de bugs", () => {
  it("reconhece apenas status conhecidos", () => {
    expect(isBugWorkflowStatus("aberto")).toBe(true);
    expect(isBugWorkflowStatus("inexistente")).toBe(false);
  });

  it("não permite transições inexistentes ou para o mesmo status", () => {
    expect(canTransitionBug("aberto", "resolvido", "instructor")).toBe(false);
    expect(canTransitionBug("aberto", "aberto", "instructor")).toBe(false);
    expect(canTransitionBug("inexistente", "aberto", "instructor")).toBe(false);
  });

  it("reserva confirmação e correção ao desenvolvedor ou instrutor", () => {
    expect(canTransitionBug("em_analise", "confirmado", "tester")).toBe(false);
    expect(canTransitionBug("em_analise", "confirmado", "developer")).toBe(true);
    expect(canTransitionBug("confirmado", "em_correcao", "tester")).toBe(false);
    expect(canTransitionBug("em_correcao", "pronto_reteste", "developer")).toBe(true);
    expect(canTransitionBug("em_correcao", "pronto_reteste", "instructor")).toBe(true);
  });

  it("reserva validação do reteste ao tester ou instrutor", () => {
    expect(canTransitionBug("pronto_reteste", "resolvido", "developer")).toBe(false);
    expect(canTransitionBug("pronto_reteste", "reaberto", "developer")).toBe(false);
    expect(canTransitionBug("pronto_reteste", "resolvido", "tester")).toBe(true);
    expect(canTransitionBug("pronto_reteste", "reaberto", "tester")).toBe(true);
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
