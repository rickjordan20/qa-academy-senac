import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Inventário da Aplicação                                             */
/* ------------------------------------------------------------------ */

export type AppProject = "techeduca" | "cafe_central";

export const PROJECTS = [
  { value: "techeduca", label: "TechEduca" },
  { value: "cafe_central", label: "Café Central" },
] as const;

export function projectLabel(v: string | null | undefined) {
  return PROJECTS.find((p) => p.value === v)?.label ?? "—";
}

/** Escopo real de cada projeto — nenhuma atividade da UC10 pode exigir mais que isto. */
export const PROJECT_SCOPE: Record<AppProject, { modality: string; note: string }> = {
  techeduca: {
    modality: "Prática individual guiada",
    note: "O TechEduca não possui carrinho, checkout, pagamento nem compra de curso. Nenhuma atividade pode exigir essas funcionalidades.",
  },
  cafe_central: {
    modality: "Prática autônoma em grupo",
    note: "Carrinho e pagamento não fazem parte do requisito-base. Alguns grupos implementaram melhorias por conta própria: elas podem ser testadas quando existirem, mas nunca são obrigatórias.",
  },
};

export const TEST_TYPES = [
  { value: "funcional", label: "Teste de funcionalidade" },
  { value: "usabilidade", label: "Teste de usabilidade" },
  { value: "estrutural", label: "Teste estrutural" },
  { value: "carga", label: "Teste de carga/desempenho" },
  { value: "regressao", label: "Teste de regressão" },
  { value: "exploratorio", label: "Teste exploratório" },
] as const;

export function testTypeLabel(v: string | null | undefined) {
  return TEST_TYPES.find((t) => t.value === v)?.label ?? v ?? "—";
}

export type AppModule = {
  id: string;
  project: string;
  group_id: string | null;
  name: string;
  description: string;
  status: string;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AppFeature = {
  id: string;
  project: string;
  group_id: string | null;
  module_id: string | null;
  code: string;
  name: string;
  description: string;
  kind: "base" | "additional" | string;
  origin: string;
  status: string;
  position: number;
  created_by: string | null;
  created_at: string;
};

export function featureKindLabel(kind: string) {
  return kind === "additional" ? "Funcionalidade adicional" : "Funcionalidade-base";
}

/** Módulos/Telas do projeto (e do grupo, no Café Central). */
export function useModules(project: AppProject, groupId: string | null) {
  return useQuery({
    queryKey: ["inventory-modules", project, groupId ?? "base"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      let q = supabase.from("app_modules").select("*").eq("project", project);
      q = groupId ? q.or(`group_id.is.null,group_id.eq.${groupId}`) : q.is("group_id", null);
      const { data, error } = await q.order("position").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as AppModule[];
    },
  });
}

/** Agrupa as funcionalidades por Módulo/Tela, preservando as ainda não associadas. */
export function groupByModule(modules: AppModule[], features: AppFeature[]) {
  const tree = modules.map((m) => ({
    module: m,
    features: features.filter((f) => f.module_id === m.id),
  }));
  const orphans = features.filter((f) => !f.module_id || !modules.some((m) => m.id === f.module_id));
  return { tree, orphans };
}

/**
 * Retorna as funcionalidades-base do projeto e, quando houver grupo,
 * também as funcionalidades adicionais implementadas por aquele grupo.
 */
export function useFeatures(project: AppProject, groupId: string | null) {
  return useQuery({
    queryKey: ["inventory", project, groupId ?? "base"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      let q = supabase.from("app_features").select("*").eq("project", project);
      q = groupId ? q.or(`group_id.is.null,group_id.eq.${groupId}`) : q.is("group_id", null);
      const { data, error } = await q.order("kind").order("position").order("code");
      if (error) throw error;
      return (data ?? []) as unknown as AppFeature[];
    },
  });
}


export type FeatureInput = {
  code: string;
  name: string;
  description: string;
  origin: string;
  module_id?: string | null;
};

/** Converte o erro técnico do backend em uma mensagem clara para o usuário. */
export function friendlyFeatureError(err: unknown): string {
  const e = err as { code?: string; message?: string; details?: string } | null;
  const msg = e?.message ?? "";
  console.error("[inventário] falha ao salvar requisito:", err);
  if (e?.code === "23505" || /duplicate key/i.test(msg)) {
    return "Já existe um requisito com este código neste projeto.";
  }
  if (e?.code === "23503" || /foreign key/i.test(msg)) {
    return "A tela (módulo) selecionada não existe mais. Recarregue a página e tente novamente.";
  }
  if (e?.code === "23514" || /violates check constraint/i.test(msg)) {
    return "Dados inválidos para este projeto. Verifique a tela selecionada e tente novamente.";
  }
  if (e?.code === "42501" || /row-level security|permission denied/i.test(msg)) {
    return "Você não tem permissão para cadastrar requisitos neste escopo. Fale com o instrutor ou com o QA Lead do grupo.";
  }
  return msg || "Não foi possível salvar o requisito.";
}

export function useCreateFeature(project: AppProject, groupId: string | null, userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FeatureInput) => {
      const { error } = await supabase.from("app_features").insert({
        ...input,
        module_id: input.module_id || null,
        project,
        group_id: groupId,
        // A regra do banco exige: base ⇒ sem grupo; adicional ⇒ com grupo.
        kind: groupId ? "additional" : "base",
        created_by: userId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory-modules"] });
      qc.invalidateQueries({ queryKey: ["managed-features"] });
    },
  });
}


/** CRUD de Módulos/Telas — instrutor em qualquer escopo; QA Lead no próprio grupo. */
export function useSaveModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string | undefined; values: Partial<AppModule> }) => {
      const { error } = id
        ? await supabase.from("app_modules").update(values as never).eq("id", id)
        : await supabase.from("app_modules").insert(values as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-modules"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeleteModule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { count, error: cErr } = await supabase
        .from("app_features")
        .select("id", { count: "exact", head: true })
        .eq("module_id", id);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        throw new Error(
          `Exclusão bloqueada: o módulo possui ${count} funcionalidade(s) vinculada(s). Prefira inativar.`,
        );
      }
      const { error } = await supabase.from("app_modules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-modules"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}


export function useDeleteFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("app_features").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}
