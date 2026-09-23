import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Domínio                                                             */
/* ------------------------------------------------------------------ */

export type QaScope = { context: "techeduca" | "cafe"; groupId: string | null };

export const CASE_STATUSES = [
  { value: "nao_executado", label: "Não executado" },
  { value: "aprovado", label: "Aprovado" },
  { value: "reprovado", label: "Reprovado" },
  { value: "bloqueado", label: "Bloqueado" },
] as const;

export const BUG_STATUSES = [
  { value: "aberto", label: "Aberto" },
  { value: "em_analise", label: "Em análise" },
  { value: "confirmado", label: "Confirmado" },
  { value: "em_correcao", label: "Em correção" },
  { value: "pronto_reteste", label: "Pronto para reteste" },
  { value: "resolvido", label: "Resolvido" },
  { value: "reaberto", label: "Reaberto" },
  { value: "descartado", label: "Descartado" },
] as const;

export const SEVERITIES = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
] as const;

export const PRIORITIES = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
] as const;

export const EVIDENCE_KINDS = [
  { value: "imagem", label: "Imagem / Print" },
  { value: "documento", label: "Documento / PDF" },
  { value: "video", label: "Vídeo" },
  { value: "log", label: "Log" },
  { value: "github", label: "GitHub / Código" },
  { value: "app", label: "Aplicação publicada" },
  { value: "texto", label: "Texto" },
  { value: "link", label: "Link" },
  { value: "outro", label: "Outro" },
] as const;

/** Tipos que podem ser registrados apenas como texto/log, sem URL. */
export const TEXT_EVIDENCE_KINDS = ["texto", "log"];

export function isValidEvidenceUrl(url: string) {
  try {
    return new URL(url.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

export function labelOf(
  list: readonly { value: string; label: string }[],
  value: string | null | undefined,
) {
  return list.find((i) => i.value === value)?.label ?? value ?? "—";
}

export function caseStatusLabel(v: string) {
  return labelOf(CASE_STATUSES, v);
}
export function bugStatusLabel(v: string) {
  return labelOf(BUG_STATUSES, v);
}

export type QaTestCase = {
  id: string;
  context: string;
  group_id: string | null;
  mission_id: string | null;
  project: string;
  feature_id: string | null;
  test_type: string;
  title: string;
  feature: string;
  precondition: string;
  input_data: string;
  steps: string;
  expected_result: string;
  obtained_result: string;
  status: string;
  author_id: string;
  assignee_id: string | null;
  executed_at: string | null;
  executed_by: string | null;
  created_at: string;
};

export type QaBug = {
  id: string;
  context: string;
  group_id: string | null;
  mission_id: string | null;
  test_case_id: string | null;
  feature_id: string | null;
  project: string;
  title: string;
  description: string;
  environment: string;
  steps: string;
  expected_result: string;
  obtained_result: string;
  severity: string;
  priority: string;
  status: string;
  author_id: string;
  assignee_id: string | null;
  created_at: string;
};

export type QaRetest = {
  id: string;
  bug_id: string;
  tester_id: string;
  result: string;
  notes: string;
  tested_at: string;
};

export type QaEvidence = {
  id: string;
  context: string;
  group_id: string | null;
  mission_id: string | null;
  test_case_id: string | null;
  bug_id: string | null;
  retest_id: string | null;
  project: string;
  kind: string;
  title: string;
  description: string;
  content: string | null;
  link: string | null;
  file_path: string | null;
  author_id: string;
  created_at: string;
};

export type QaMissionOption = { id: string; code: string; title: string; track: string };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function scopeKey(scope: QaScope, userId: string | null) {
  return scope.context === "cafe" ? `cafe:${scope.groupId}` : `techeduca:${userId}`;
}

function applyScope<T extends { eq: (c: string, v: string) => T; is: (c: string, v: null) => T }>(
  q: T,
  scope: QaScope,
  userId: string | null,
) {
  if (scope.context === "cafe") return q.eq("context", "cafe").eq("group_id", scope.groupId!);
  return q.eq("context", "techeduca").eq("author_id", userId!).is("group_id", null);
}

function scopeEnabled(scope: QaScope, userId: string | null) {
  return scope.context === "cafe" ? !!scope.groupId : !!userId;
}

function scopeInsertFields(scope: QaScope) {
  return scope.context === "cafe"
    ? { context: "cafe", group_id: scope.groupId }
    : { context: "techeduca", group_id: null };
}

/* ------------------------------------------------------------------ */
/* Missões e pessoas                                                   */
/* ------------------------------------------------------------------ */

export function useQaMissions() {
  return useQuery({
    queryKey: ["qa", "missions"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("techeduca_missions")
        .select("id, code, title, track")
        .order("position");
      if (error) throw error;
      return (data ?? []) as QaMissionOption[];
    },
  });
}

export function useProfileNames(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean))).sort();
  return useQuery({
    queryKey: ["qa", "profiles", unique.join(",")],
    enabled: unique.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", unique);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const p of data ?? []) {
        const row = p as { id: string; full_name: string | null; email: string };
        map[row.id] = row.full_name?.trim() || row.email;
      }
      return map;
    },
  });
}

/* ------------------------------------------------------------------ */
/* Casos de teste                                                      */
/* ------------------------------------------------------------------ */

export function useTestCases(scope: QaScope, userId: string | null) {
  return useQuery({
    queryKey: ["qa", "cases", scopeKey(scope, userId)],
    enabled: scopeEnabled(scope, userId),
    queryFn: async () => {
      let q = supabase.from("qa_test_cases").select("*");
      q = applyScope(q as never, scope, userId) as never;
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as QaTestCase[];
    },
  });
}

export type TestCaseInput = {
  title: string;
  project: string;
  feature_id: string | null;
  test_type: string;
  mission_id: string | null;
  assignee_id: string | null;
  feature: string;
  precondition: string;
  input_data: string;
  steps: string;
  expected_result: string;
  obtained_result: string;
  status: string;
};

export function useCreateTestCase(scope: QaScope, userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TestCaseInput) => {
      const { data, error } = await supabase
        .from("qa_test_cases")
        .insert({ ...input, ...scopeInsertFields(scope), author_id: userId! } as never)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as QaTestCase;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa", "cases", scopeKey(scope, userId)] });
      qc.invalidateQueries({ queryKey: ["qa-unified"] });
    },
  });
}

export function useUpdateTestCase(scope: QaScope, userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<QaTestCase> }) => {
      const { error } = await supabase.from("qa_test_cases").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa", "cases", scopeKey(scope, userId)] });
      qc.invalidateQueries({ queryKey: ["qa-unified"] });
    },
  });
}

export function useDeleteTestCase(scope: QaScope, userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("qa_test_cases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa", "cases", scopeKey(scope, userId)] });
      qc.invalidateQueries({ queryKey: ["qa-unified"] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Bugs                                                                */
/* ------------------------------------------------------------------ */

export function useBugs(scope: QaScope, userId: string | null) {
  return useQuery({
    queryKey: ["qa", "bugs", scopeKey(scope, userId)],
    enabled: scopeEnabled(scope, userId),
    queryFn: async () => {
      let q = supabase.from("qa_bugs").select("*");
      q = applyScope(q as never, scope, userId) as never;
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as QaBug[];
    },
  });
}

export type BugInput = {
  title: string;
  project: string;
  feature_id: string | null;
  mission_id: string | null;
  test_case_id: string | null;
  assignee_id: string | null;
  description: string;
  environment: string;
  steps: string;
  expected_result: string;
  obtained_result: string;
  severity: string;
  priority: string;
  status: string;
};

export function useCreateBug(scope: QaScope, userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BugInput) => {
      const { data, error } = await supabase
        .from("qa_bugs")
        .insert({ ...input, ...scopeInsertFields(scope), author_id: userId! } as never)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as QaBug;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa", "bugs", scopeKey(scope, userId)] });
      qc.invalidateQueries({ queryKey: ["qa-unified"] });
    },
  });
}

export function useUpdateBug(scope: QaScope, userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<QaBug> }) => {
      const { error } = await supabase.from("qa_bugs").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa", "bugs", scopeKey(scope, userId)] });
      qc.invalidateQueries({ queryKey: ["qa-unified"] });
    },
  });
}

export function useDeleteBug(scope: QaScope, userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("qa_bugs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["qa", "bugs", scopeKey(scope, userId)] });
      void qc.invalidateQueries({ queryKey: ["qa", "retests"] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Retestes                                                            */
/* ------------------------------------------------------------------ */

export function useRetests(bugIds: string[]) {
  const ids = Array.from(new Set(bugIds)).sort();
  return useQuery({
    queryKey: ["qa", "retests", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qa_retests")
        .select("*")
        .in("bug_id", ids)
        .order("tested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as QaRetest[];
    },
  });
}

/** Registra o reteste e move o bug para Resolvido ou Reaberto. */
export function useCreateRetest(scope: QaScope, userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { bug_id: string; result: "resolvido" | "reaberto"; notes: string }) => {
      const { data, error } = await supabase
        .from("qa_retests")
        .insert({ ...input, tester_id: userId! } as never)
        .select("*")
        .single();
      if (error) throw error;
      const { error: upErr } = await supabase
        .from("qa_bugs")
        .update({ status: input.result } as never)
        .eq("id", input.bug_id);
      if (upErr) throw upErr;
      return data as unknown as QaRetest;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["qa", "retests"] });
      void qc.invalidateQueries({ queryKey: ["qa", "bugs", scopeKey(scope, userId)] });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Evidências                                                          */
/* ------------------------------------------------------------------ */

export function useQaEvidences(scope: QaScope, userId: string | null) {
  return useQuery({
    queryKey: ["qa", "evidences", scopeKey(scope, userId)],
    enabled: scopeEnabled(scope, userId),
    queryFn: async () => {
      let q = supabase.from("qa_evidences").select("*");
      q = applyScope(q as never, scope, userId) as never;
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as QaEvidence[];
    },
  });
}

export type QaEvidenceInput = {
  title: string;
  kind: string;
  description: string;
  content: string | null;
  link: string | null;
  project: string;
  mission_id: string | null;
  test_case_id: string | null;
  bug_id: string | null;
  retest_id: string | null;
};

export function useCreateQaEvidence(scope: QaScope, userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: QaEvidenceInput) => {
      const { error } = await supabase.from("qa_evidences").insert({
        ...input,
        ...scopeInsertFields(scope),
        file_path: null,
        author_id: userId!,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa", "evidences", scopeKey(scope, userId)] });
      qc.invalidateQueries({ queryKey: ["qa-unified"] });
    },
  });
}

export function useUpdateQaEvidence(scope: QaScope, userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<QaEvidenceInput> }) => {
      const { error } = await supabase.from("qa_evidences").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa", "evidences", scopeKey(scope, userId)] });
      qc.invalidateQueries({ queryKey: ["qa-unified"] });
    },
  });
}

export function useDeleteQaEvidence(scope: QaScope, userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ev: QaEvidence) => {
      const { error } = await supabase.from("qa_evidences").delete().eq("id", ev.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa", "evidences", scopeKey(scope, userId)] });
      qc.invalidateQueries({ queryKey: ["qa-unified"] });
    },
  });
}

export async function openQaFile(path: string) {
  const { data, error } = await supabase.storage.from("evidencias").createSignedUrl(path, 60);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}

export function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}
