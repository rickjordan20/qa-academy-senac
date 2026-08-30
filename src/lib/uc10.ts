import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useIndicators() {
  return useQuery({
    queryKey: ["indicators"],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicators")
        .select("*")
        .eq("uc_code", "UC10")
        .order("position");
      if (error) throw error;
      return data;
    },
  });
}

export function useMyEnrollment(userId: string | null) {
  return useQuery({
    queryKey: ["my-enrollment", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("class_id, classes(id, name, period, description)")
        .eq("student_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
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
        .select("id, name, period, description, enrollments(id, student_id), groups(id, name)")
        .eq("instructor_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
