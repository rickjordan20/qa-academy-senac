import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ==================================================================== */
/* Gestão administrativa da UC10                                        */
/* ==================================================================== */

export const CLASS_STATUS = [
  { value: "active", label: "Ativa" },
  { value: "closed", label: "Encerrada" },
  { value: "archived", label: "Arquivada" },
] as const;

export const ENROLLMENT_STATUS = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
  { value: "transferred", label: "Transferido" },
  { value: "completed", label: "Concluído" },
] as const;

export const GROUP_STATUS = [
  { value: "active", label: "Ativo" },
  { value: "archived", label: "Arquivado" },
] as const;

export const FEATURE_STATUS = [
  { value: "active", label: "Ativa" },
  { value: "in_progress", label: "Em desenvolvimento" },
  { value: "inactive", label: "Inativa" },
  { value: "removed", label: "Removida" },
  { value: "archived", label: "Arquivada" },
] as const;

export const FEATURE_ORIGIN = [
  { value: "base_inicial", label: "Base inicial" },
  { value: "instrutor", label: "Adicionada pelo instrutor" },
  { value: "melhoria_grupo", label: "Melhoria do grupo" },
  { value: "outra", label: "Outra" },
] as const;

export const FEATURE_CATEGORY = [
  { value: "navegacao", label: "Navegação" },
  { value: "conteudo", label: "Conteúdo" },
  { value: "formulario", label: "Formulário" },
  { value: "autenticacao", label: "Autenticação" },
  { value: "transacional", label: "Transacional" },
  { value: "geral", label: "Geral" },
] as const;

export const MEMBER_FUNCTIONS = [
  "QA Lead",
  "Analista de testes",
  "Documentação",
  "Evidências",
  "Rastreabilidade",
  "Relatórios",
  "Integrante",
] as const;

type Opt = readonly { value: string; label: string }[];
export function labelOf(list: Opt, v: string | null | undefined) {
  return list.find((o) => o.value === v)?.label ?? v ?? "—";
}

/* ------------------------------ Turmas ----------------------------- */

export type AdminClass = {
  id: string;
  name: string;
  code: string | null;
  course: string | null;
  uc_code: string;
  workload: string | null;
  start_date: string | null;
  end_date: string | null;
  shift: string | null;
  period: string | null;
  status: string;
  notes: string;
  description: string | null;
  instructor_id: string;
  created_at: string;
  enrollments?: { id: string; student_id: string; status: string }[];
  groups?: { id: string; name: string; status: string }[];
};

export function useAdminClasses(instructorId: string | null) {
  return useQuery({
    queryKey: ["admin-classes", instructorId],
    enabled: !!instructorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*, enrollments(id, student_id, status), groups(id, name, status)")
        .eq("instructor_id", instructorId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AdminClass[];
    },
  });
}

export type ClassInput = Partial<Omit<AdminClass, "id" | "enrollments" | "groups">>;

export function useSaveClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string | undefined; values: ClassInput }) => {
      const { error } = id
        ? await supabase.from("classes").update(values as never).eq("id", id)
        : await supabase.from("classes").insert(values as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
      qc.invalidateQueries({ queryKey: ["my-classes"] });
      qc.invalidateQueries({ queryKey: ["class"] });
    },
  });
}

/* ------------------------------ Alunos ----------------------------- */

export type RosterRow = {
  id: string;
  class_id: string;
  student_id: string;
  status: string;
  student_code: string | null;
  notes: string;
  profile: { id: string; full_name: string; email: string; avatar_url: string | null } | null;
};

export function useRoster(classIds: string[]) {
  const key = [...classIds].sort().join(",");
  return useQuery({
    queryKey: ["admin-roster", key],
    enabled: classIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, class_id, student_id, status, student_code, notes")
        .in("class_id", classIds);
      if (error) throw error;
      const ids = (data ?? []).map((e) => e.student_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", ids)
        : { data: [] as never[] };
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((e) => ({
        ...e,
        profile: map.get(e.student_id) ?? null,
      })) as unknown as RosterRow[];
    },
  });
}

export function useUpdateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: { status?: string; student_code?: string | null; notes?: string; class_id?: string };
    }) => {
      const { error } = await supabase.from("enrollments").update(values as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-roster"] });
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
      qc.invalidateQueries({ queryKey: ["class-members"] });
    },
  });
}

export function useRemoveEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("enrollments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-roster"] });
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
    },
  });
}

export function useEnrollByEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ classId, email }: { classId: string; email: string }) => {
      const { error } = await supabase.rpc("enroll_student_by_email", {
        _class_id: classId,
        _email: email,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-roster"] });
      qc.invalidateQueries({ queryKey: ["admin-classes"] });
      qc.invalidateQueries({ queryKey: ["class-members"] });
    },
  });
}

/* ------------------------------ Grupos ----------------------------- */

export type AdminGroup = {
  id: string;
  class_id: string;
  name: string;
  description: string;
  status: string;
  qa_lead_id: string | null;
  group_members: { id: string; student_id: string; member_function: string }[];
};

export function useAdminGroups(classIds: string[]) {
  const key = [...classIds].sort().join(",");
  return useQuery({
    queryKey: ["admin-groups", key],
    enabled: classIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, class_id, name, description, status, qa_lead_id, group_members(id, student_id, member_function)")
        .in("class_id", classIds)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as AdminGroup[];
    },
  });
}

function invalidateGroups(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["admin-groups"] });
  qc.invalidateQueries({ queryKey: ["class-groups"] });
  qc.invalidateQueries({ queryKey: ["instructor-groups"] });
}

export function useSaveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id?: string | undefined;
      values: Partial<Omit<AdminGroup, "id" | "group_members">>;
    }) => {
      const { error } = id
        ? await supabase.from("groups").update(values as never).eq("id", id)
        : await supabase.from("groups").insert(values as never);
      if (error) throw error;
    },
    onSuccess: () => invalidateGroups(qc),
  });
}

export function useGroupMemberActions() {
  const qc = useQueryClient();
  const done = { onSuccess: () => invalidateGroups(qc) };

  const add = useMutation({
    mutationFn: async ({ groupId, studentId }: { groupId: string; studentId: string }) => {
      const { error } = await supabase
        .from("group_members")
        .insert({ group_id: groupId, student_id: studentId } as never);
      if (error) throw error;
    },
    ...done,
  });

  const remove = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("group_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    ...done,
  });

  const move = useMutation({
    mutationFn: async ({ memberId, groupId }: { memberId: string; groupId: string }) => {
      const { error } = await supabase
        .from("group_members")
        .update({ group_id: groupId } as never)
        .eq("id", memberId);
      if (error) throw error;
    },
    ...done,
  });

  const setFunction = useMutation({
    mutationFn: async ({ memberId, fn }: { memberId: string; fn: string }) => {
      const { error } = await supabase
        .from("group_members")
        .update({ member_function: fn } as never)
        .eq("id", memberId);
      if (error) throw error;
    },
    ...done,
  });

  const setQaLead = useMutation({
    mutationFn: async ({ groupId, studentId }: { groupId: string; studentId: string | null }) => {
      const { error } = await supabase
        .from("groups")
        .update({ qa_lead_id: studentId } as never)
        .eq("id", groupId);
      if (error) throw error;
    },
    ...done,
  });

  return { add, remove, move, setFunction, setQaLead };
}

/* -------------------------- Funcionalidades ------------------------ */

export type ManagedFeature = {
  id: string;
  project: string;
  group_id: string | null;
  code: string;
  name: string;
  description: string;
  kind: string;
  origin: string;
  category: string;
  status: string;
  position: number;
  notes: string;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function useManagedFeatures(project: string, groupId: string | null) {
  return useQuery({
    queryKey: ["managed-features", project, groupId ?? "base"],
    queryFn: async () => {
      let q = supabase.from("app_features").select("*").eq("project", project);
      q = groupId ? q.or(`group_id.is.null,group_id.eq.${groupId}`) : q.is("group_id", null);
      const { data, error } = await q.order("position").order("code");
      if (error) throw error;
      return (data ?? []) as unknown as ManagedFeature[];
    },
  });
}

function invalidateFeatures(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["managed-features"] });
  qc.invalidateQueries({ queryKey: ["inventory"] });
}

export function useSaveFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id?: string | undefined;
      values: Partial<ManagedFeature>;
    }) => {
      const { error } = id
        ? await supabase.from("app_features").update(values as never).eq("id", id)
        : await supabase.from("app_features").insert(values as never);
      if (error) throw error;
    },
    onSuccess: () => invalidateFeatures(qc),
  });
}

export function useReorderFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { id: string; position: number }[]) => {
      for (const r of rows) {
        const { error } = await supabase
          .from("app_features")
          .update({ position: r.position } as never)
          .eq("id", r.id);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidateFeatures(qc),
  });
}

/** Conta registros vinculados a uma funcionalidade (rastreabilidade). */
export async function countFeatureLinks(featureId: string) {
  const tables = ["qa_test_cases", "qa_bugs", "builder_mission_entries"] as const;
  let total = 0;
  for (const t of tables) {
    const { count, error } = await supabase
      .from(t)
      .select("id", { count: "exact", head: true })
      .eq("feature_id", featureId);
    if (error) throw error;
    total += count ?? 0;
  }
  return total;
}

export function useDeleteFeatureSafe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const links = await countFeatureLinks(id);
      if (links > 0) {
        throw new Error(
          `Exclusão bloqueada: existem ${links} registro(s) vinculados. Use "Arquivar" ou "Desativar" para preservar a rastreabilidade.`,
        );
      }
      const { error } = await supabase.from("app_features").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateFeatures(qc),
  });
}

/* ------------------------ Sugestões de aluno ----------------------- */

export type FeatureSuggestion = {
  id: string;
  project: string;
  group_id: string | null;
  name: string;
  description: string;
  justification: string;
  status: string;
  author_id: string;
  reviewed_by: string | null;
  created_at: string;
};

export function useFeatureSuggestions(project: string, groupId: string | null) {
  return useQuery({
    queryKey: ["feature-suggestions", project, groupId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("feature_suggestions").select("*").eq("project", project);
      if (groupId) q = q.eq("group_id", groupId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FeatureSuggestion[];
    },
  });
}

export function useCreateSuggestion(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      project: string;
      group_id: string | null;
      name: string;
      description: string;
      justification: string;
    }) => {
      const { error } = await supabase
        .from("feature_suggestions")
        .insert({ ...input, author_id: userId } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feature-suggestions"] }),
  });
}

export function useReviewSuggestion(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      suggestion,
      approve,
    }: {
      suggestion: FeatureSuggestion;
      approve: boolean;
    }) => {
      if (approve) {
        const { data: existing } = await supabase
          .from("app_features")
          .select("position")
          .eq("project", suggestion.project)
          .order("position", { ascending: false })
          .limit(1);
        const position = ((existing?.[0]?.position as number | undefined) ?? 0) + 1;
        const { error: fErr } = await supabase.from("app_features").insert({
          project: suggestion.project,
          group_id: suggestion.group_id,
          code: `EX${String(position).padStart(2, "0")}`,
          name: suggestion.name,
          description: suggestion.description,
          kind: "additional",
          origin: "melhoria_grupo",
          category: "geral",
          status: "active",
          position,
          created_by: userId,
        } as never);
        if (fErr) throw fErr;
      }
      const { error } = await supabase
        .from("feature_suggestions")
        .update({
          status: approve ? "approved" : "rejected",
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq("id", suggestion.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feature-suggestions"] });
      invalidateFeatures(qc);
    },
  });
}

/* ------------------------------ Auditoria -------------------------- */

export type AuditRow = {
  id: string;
  entity: string;
  entity_id: string | null;
  action: string;
  actor_id: string | null;
  old_value: Record<string, unknown>;
  new_value: Record<string, unknown>;
  created_at: string;
};

export function useAuditLog(entity?: string, entityId?: string | null, limit = 50) {
  return useQuery({
    queryKey: ["audit-log", entity ?? "all", entityId ?? "all", limit],
    queryFn: async () => {
      let q = supabase.from("audit_log").select("*");
      if (entity) q = q.eq("entity", entity);
      if (entityId) q = q.eq("entity_id", entityId);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
  });
}

export const ENTITY_LABEL: Record<string, string> = {
  classes: "Turma",
  enrollments: "Matrícula",
  groups: "Grupo",
  group_members: "Integrante",
  app_features: "Funcionalidade",
};

export const ACTION_LABEL: Record<string, string> = {
  insert: "Criação",
  update: "Alteração",
  delete: "Exclusão",
};

/** Campos que mudaram entre valor anterior e novo. */
export function diffFields(oldV: Record<string, unknown>, newV: Record<string, unknown>) {
  const keys = new Set([...Object.keys(oldV ?? {}), ...Object.keys(newV ?? {})]);
  const skip = new Set(["updated_at", "created_at", "id"]);
  const out: { key: string; from: string; to: string }[] = [];
  for (const k of keys) {
    if (skip.has(k)) continue;
    const a = JSON.stringify(oldV?.[k] ?? null);
    const b = JSON.stringify(newV?.[k] ?? null);
    if (a !== b) out.push({ key: k, from: a === "null" ? "—" : a.replace(/^"|"$/g, ""), to: b === "null" ? "—" : b.replace(/^"|"$/g, "") });
  }
  return out;
}
