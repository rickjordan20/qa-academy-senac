import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { validateRetest } from "@/lib/bug-workflow";
import type { QaRetest, QaScope } from "@/lib/qa";

export type AtomicRetestInput = {
  bug_id: string;
  status: string;
  result: "resolvido" | "reaberto";
  notes: string;
};

/** Aula 9: nunca grave qa_retests e qa_bugs em duas requisições independentes. */
export function useRegisterRetestAtomic(scope: QaScope, userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AtomicRetestInput): Promise<QaRetest> => {
      const validation = validateRetest({
        status: input.status,
        result: input.result,
        notes: input.notes,
        testerId: userId,
      });
      if (validation) throw new Error(validation);
      if (!input.bug_id) throw new Error("Selecione um bug válido para o reteste.");
      // The migration supplies this RPC. Cast is limited to the not-yet-regenerated
      // Supabase generated types; do not silently fall back to the unsafe two-write path.
      const { data, error } = await supabase.rpc("qa_register_retest" as never, {
        p_bug_id: input.bug_id,
        p_result: input.result,
        p_notes: input.notes.trim(),
      } as never);
      if (error) throw error;
      if (!data) throw new Error("O servidor não confirmou o registro do reteste.");
      return data as unknown as QaRetest;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["qa", "retests"] });
      void qc.invalidateQueries({ queryKey: ["qa", "bugs"] });
      void qc.invalidateQueries({ queryKey: ["qa", "unified"] });
    },
  });
}
