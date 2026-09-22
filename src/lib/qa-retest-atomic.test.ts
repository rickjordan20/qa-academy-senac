import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  rpc: vi.fn(),
  useMutation: vi.fn((options: { mutationFn: (...args: unknown[]) => unknown; onSuccess?: () => void }) => ({
    mutateAsync: options.mutationFn,
    onSuccess: options.onSuccess,
  })),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: mocks.useMutation,
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc },
}));

import { useRegisterRetestAtomic } from "./qa-retest-atomic";

describe("useRegisterRetestAtomic", () => {
  beforeEach(() => {
    mocks.invalidateQueries.mockReset();
    mocks.rpc.mockReset();
    mocks.useMutation.mockClear();
  });

  it("chama a RPC atômica e invalida os caches de QA no sucesso", async () => {
    mocks.rpc.mockResolvedValue({
      data: { id: "rt1", bug_id: "bug-1", tester_id: "tester-1", result: "resolvido", notes: "ok" },
      error: null,
    });
    const mutation = useRegisterRetestAtomic({ context: "cafe", groupId: "g1" }, "tester-1");

    const result = await mutation.mutateAsync({
      bug_id: "bug-1",
      status: "pronto_reteste",
      result: "resolvido",
      notes: "  reteste aprovado  ",
    });

    expect(result.id).toBe("rt1");
    expect(mocks.rpc).toHaveBeenCalledWith("qa_register_retest", {
      p_bug_id: "bug-1",
      p_result: "resolvido",
      p_notes: "reteste aprovado",
    });

    mutation.onSuccess?.();
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["qa", "retests"] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["qa", "bugs"] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["qa", "unified"] });
  });

  it("bloqueia entrada inválida antes de chamar RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    const mutation = useRegisterRetestAtomic({ context: "cafe", groupId: "g1" }, "tester-1");

    await expect(
      mutation.mutateAsync({
        bug_id: "bug-1",
        status: "aberto",
        result: "resolvido",
        notes: "sem pronto_reteste",
      }),
    ).rejects.toThrow(/pronto para reteste/i);

    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
