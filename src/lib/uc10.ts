import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Indicadores de uma UC específica. A UC é sempre a da turma em uso —
 * não há UC padrão: sem código identificado, nada é carregado (a tela deve
 * avisar e bloquear operações sobre indicadores).
 */
export function useIndicators(ucCode: string | null | undefined) {
  return useQuery({
    queryKey: ["indicators", ucCode ?? null],
    enabled: !!ucCode,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicators")
        .select("*")
        .eq("uc_code", ucCode!)
        .order("position");
      if (error) throw error;
      return data;
    },
  });
}

/** Código da UC vinculada a uma turma (null quando não identificável). */
export function useClassUc(classId: string | null | undefined) {
  return useQuery({
    queryKey: ["class-uc", classId ?? null],
    enabled: !!classId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("uc_code")
        .eq("id", classId!)
        .maybeSingle();
      if (error) throw error;
      const code = (data?.uc_code ?? "").trim();
      return code || null;
    },
  });
}

/**
 * UC da turma + seus indicadores. `ucMissing` = turma selecionada, mas UC não
 * identificada (ou sem indicadores cadastrados): telas devem avisar e bloquear.
 */
export function useClassIndicators(classId: string | null | undefined) {
  const uc = useClassUc(classId);
  const ucCode = uc.data ?? null;
  const ind = useIndicators(ucCode);
  const resolved = !!classId && !uc.isLoading && (!ucCode || !ind.isLoading);
  const ucMissing = resolved && (!ucCode || (ind.data ?? []).length === 0);
  return { ucCode, data: ucCode ? ind.data : undefined, ucMissing, isLoading: !resolved };
}

export function useMyEnrollment(userId: string | null) {
  return useQuery({
    queryKey: ["my-enrollment", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("class_id, classes(id, name, period, description, uc_code)")
        .eq("student_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Indicadores da UC da turma do próprio aluno. */
export function useMyIndicators(userId: string | null) {
  const { data: enrollment } = useMyEnrollment(userId);
  return useClassIndicators(enrollment?.class_id ?? null);
}

export function useMyEvaluations(userId: string | null) {
  return useQuery({
    queryKey: ["my-evaluations", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicator_evaluations")
        .select("indicator_id, concept, final_result, notes, evaluated_at")
        .eq("student_id", userId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useMyClasses(userId: string | null) {
  return useQuery({
    queryKey: ["my-classes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, period, description, uc_code, enrollments(id, student_id), groups(id, name)")
        .eq("instructor_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
