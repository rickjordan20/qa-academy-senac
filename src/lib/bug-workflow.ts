/* Regras de domínio da Aula 9. Validação no cliente não substitui RLS/RPC no banco. */
export const BUG_WORKFLOW = {
  aberto: ["em_analise", "descartado"],
  em_analise: ["confirmado", "descartado"],
  confirmado: ["em_correcao", "descartado"],
  em_correcao: ["pronto_reteste"],
  pronto_reteste: ["resolvido", "reaberto"],
  resolvido: ["reaberto"],
  reaberto: ["em_analise", "em_correcao"],
  descartado: ["reaberto"],
} as const;

export type BugWorkflowStatus = keyof typeof BUG_WORKFLOW;
export type BugWorkflowRole = "tester" | "developer" | "instructor";

export function isBugWorkflowStatus(value: string): value is BugWorkflowStatus {
  return Object.prototype.hasOwnProperty.call(BUG_WORKFLOW, value);
}

/** Apenas autorização de interface; a autorização definitiva deve ocorrer no banco. */
export function canTransitionBug(from: string, to: string, role: BugWorkflowRole): boolean {
  if (!isBugWorkflowStatus(from) || !isBugWorkflowStatus(to) || from === to) return false;
  if (!(BUG_WORKFLOW[from] as readonly string[]).includes(to)) return false;
  if (role === "instructor") return true;
  if (from === "pronto_reteste") return role === "tester";
  if (to === "confirmado" || to === "em_correcao" || to === "pronto_reteste") return role === "developer";
  if (to === "em_analise" && from === "aberto") return role === "developer";
  if (to === "descartado") return role === "developer";
  if (from === "resolvido" || from === "descartado") return role === "tester";
  return role === "tester" || role === "developer";
}

export function validateRetest(input: {
  status: string;
  result: "resolvido" | "reaberto";
  notes: string;
  testerId: string | null;
}): string | null {
  if (!input.testerId) return "É necessário estar autenticado para registrar o reteste.";
  if (input.status !== "pronto_reteste") return "O bug precisa estar pronto para reteste.";
  if (!input.notes.trim()) return "Descreva o resultado observado no reteste.";
  if (!canTransitionBug(input.status, input.result, "tester")) return "Transição de status inválida.";
  return null;
}
