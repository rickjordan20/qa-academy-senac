import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MissionSummaryItem = { topic: string; text: string };
export type ChecklistItem = { id: string; label: string };
export type CheckpointQuestion = { id: string; question: string };
export type MissionPractice = { title: string; instructions: string; tips?: string[] };

export type Mission = {
  id: string;
  code: string;
  title: string;
  objective: string;
  summary: MissionSummaryItem[];
  indicator_codes: string[];
  checklist: ChecklistItem[];
  practice: MissionPractice;
  checkpoint: CheckpointQuestion[];
  position: number;
};

export type MissionRun = {
  id: string;
  mission_id: string;
  student_id: string;
  status: string;
  checklist_state: Record<string, boolean>;
  checkpoint_answers: Record<string, string>;
  reflection: string | null;
  started_at: string;
  completed_at: string | null;
};

export type BugReport = {
  id: string;
  run_id: string | null;
  mission_id: string | null;
  student_id: string;
  feature: string;
  problem: string;
  classification: string;
  steps: string;
  expected_result: string;
  obtained_result: string;
  note: string | null;
  created_at: string;
};

export type Evidence = {
  id: string;
  student_id: string;
  run_id: string | null;
  bug_report_id: string | null;
  title: string;
  description: string | null;
  link: string | null;
  file_path: string | null;
  created_at: string;
};

export const CLASSIFICATIONS = ["erro", "defeito", "falha", "melhoria", "dúvida"] as const;

function mapMission(row: Record<string, unknown>): Mission {
  return {
    id: row["id"] as string,
    code: row["code"] as string,
    title: row["title"] as string,
    objective: row["objective"] as string,
    summary: (row["summary"] as MissionSummaryItem[]) ?? [],
    indicator_codes: (row["indicator_codes"] as string[]) ?? [],
    checklist: (row["checklist"] as ChecklistItem[]) ?? [],
    practice: (row["practice"] as MissionPractice) ?? { title: "", instructions: "" },
    checkpoint: (row["checkpoint"] as CheckpointQuestion[]) ?? [],
    position: row["position"] as number,
  };
}

function mapRun(row: Record<string, unknown>): MissionRun {
  return {
    id: row["id"] as string,
    mission_id: row["mission_id"] as string,
    student_id: row["student_id"] as string,
    status: row["status"] as string,
    checklist_state: (row["checklist_state"] as Record<string, boolean>) ?? {},
    checkpoint_answers: (row["checkpoint_answers"] as Record<string, string>) ?? {},
    reflection: (row["reflection"] as string | null) ?? null,
    started_at: row["started_at"] as string,
    completed_at: (row["completed_at"] as string | null) ?? null,
  };
}

export function useMissions() {
  return useQuery({
    queryKey: ["techeduca", "missions"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("techeduca_missions")
        .select("*")
        .eq("track", "techeduca")
        .order("position");
      if (error) throw error;
      return (data ?? []).map((d) => mapMission(d as Record<string, unknown>));
    },
  });
}

export function useMission(code: string) {
  return useQuery({
    queryKey: ["techeduca", "mission", code],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("techeduca_missions")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (error) throw error;
      return data ? mapMission(data as Record<string, unknown>) : null;
    },
  });
}

export function useMyRuns(userId: string | null) {
  return useQuery({
    queryKey: ["techeduca", "runs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("techeduca_mission_runs")
        .select("*")
        .eq("student_id", userId!)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((d) => mapRun(d as Record<string, unknown>));
    },
  });
}

/** Garante que exista uma execução individual da missão para o usuário logado (autoria automática). */
export function useEnsureRun(userId: string | null, missionId: string | null) {
  return useQuery({
    queryKey: ["techeduca", "run", userId, missionId],
    enabled: !!userId && !!missionId,
    queryFn: async () => {
      const existing = await supabase
        .from("techeduca_mission_runs")
        .select("*")
        .eq("student_id", userId!)
        .eq("mission_id", missionId!)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return mapRun(existing.data as Record<string, unknown>);

      const created = await supabase
        .from("techeduca_mission_runs")
        .insert({ student_id: userId!, mission_id: missionId! })
        .select("*")
        .single();
      if (created.error) throw created.error;
      return mapRun(created.data as Record<string, unknown>);
    },
  });
}

export function useUpdateRun(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      runId,
      patch,
    }: {
      runId: string;
      patch: Partial<Pick<MissionRun, "checklist_state" | "checkpoint_answers" | "reflection" | "status">> & {
        completed_at?: string | null;
      };
    }) => {
      const { error } = await supabase.from("techeduca_mission_runs").update(patch).eq("id", runId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["techeduca", "run"] });
      void qc.invalidateQueries({ queryKey: ["techeduca", "runs", userId] });
    },
  });
}

export function useMyBugReports(userId: string | null) {
  return useQuery({
    queryKey: ["techeduca", "bugs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("techeduca_bug_reports")
        .select("*")
        .eq("student_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BugReport[];
    },
  });
}

export function useCreateBugReport(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      run_id: string | null;
      mission_id: string | null;
      feature: string;
      problem: string;
      classification: string;
      steps: string;
      expected_result: string;
      obtained_result: string;
      note: string | null;
    }) => {
      const { data, error } = await supabase
        .from("techeduca_bug_reports")
        .insert({ ...input, student_id: userId! })
        .select("*")
        .single();
      if (error) throw error;
      return data as BugReport;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["techeduca", "bugs", userId] });
    },
  });
}

export function useDeleteBugReport(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("techeduca_bug_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["techeduca", "bugs", userId] });
      void qc.invalidateQueries({ queryKey: ["techeduca", "evidences", userId] });
    },
  });
}

export function useMyEvidences(userId: string | null) {
  return useQuery({
    queryKey: ["techeduca", "evidences", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("techeduca_evidences")
        .select("*")
        .eq("student_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Evidence[];
    },
  });
}

export function useCreateEvidence(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description: string | null;
      link: string | null;
      run_id: string | null;
      bug_report_id: string | null;
    }) => {
      const { error } = await supabase.from("techeduca_evidences").insert({
        student_id: userId!,
        title: input.title,
        description: input.description,
        link: input.link,
        run_id: input.run_id,
        bug_report_id: input.bug_report_id,
        file_path: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["techeduca", "evidences", userId] });
    },
  });
}

export function useUpdateEvidence(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      description: string | null;
      link: string | null;
    }) => {
      const { error } = await supabase
        .from("techeduca_evidences")
        .update({ title: input.title, description: input.description, link: input.link })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["techeduca", "evidences", userId] });
    },
  });
}

export function useDeleteEvidence(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ev: Evidence) => {
      const { error } = await supabase.from("techeduca_evidences").delete().eq("id", ev.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["techeduca", "evidences", userId] });
    },
  });
}

export async function openEvidenceFile(path: string) {
  const { data, error } = await supabase.storage.from("evidencias").createSignedUrl(path, 60);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}
