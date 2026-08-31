import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CAFE_MISSION_CODE = "cafe-aula3";

export type TaskStatus = "todo" | "doing" | "review" | "done" | "blocked";

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "A Fazer" },
  { value: "doing", label: "Em andamento" },
  { value: "review", label: "Em revisão" },
  { value: "done", label: "Concluída" },
  { value: "blocked", label: "Bloqueada" },
];

export function taskStatusLabel(status: string) {
  return TASK_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export const CONTRIBUTION_KINDS: { value: string; label: string }[] = [
  { value: "caso", label: "Caso de teste criado" },
  { value: "execucao", label: "Execução realizada" },
  { value: "evidencia", label: "Evidência anexada" },
  { value: "analise", label: "Análise / achado" },
  { value: "nota", label: "Nota do time" },
];

export function contributionKindLabel(kind: string) {
  return CONTRIBUTION_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export type CafeMission = {
  id: string;
  code: string;
  title: string;
  objective: string;
  summary: { topic: string; text: string }[];
  checklist: { id: string; label: string }[];
  practice: { title: string; instructions: string; areas?: string[]; tips?: string[] };
  checkpoint: { id: string; question: string }[];
  indicator_codes: string[];
};

export type GroupMemberInfo = {
  student_id: string;
  member_function: string;
  full_name: string;
  email: string;
  is_qa_lead: boolean;
};

export type CafeGroup = {
  id: string;
  name: string;
  class_id: string;
  class_name: string;
  qa_lead_id: string | null;
  members: GroupMemberInfo[];
};

export type CafeRun = {
  id: string;
  mission_id: string;
  group_id: string;
  status: string;
  deliverable: string;
  submitted_at: string | null;
  submitted_by: string | null;
};

export type CafeTask = {
  id: string;
  run_id: string;
  group_id: string;
  title: string;
  description: string;
  area: string;
  assignee_id: string | null;
  status: TaskStatus;
  created_by: string;
  created_at: string;
};

export type CafeCollaborator = {
  id: string;
  task_id: string;
  student_id: string;
};

export type CafeContribution = {
  id: string;
  run_id: string;
  group_id: string;
  task_id: string | null;
  student_id: string;
  kind: string;
  title: string;
  description: string;
  link: string | null;
  created_at: string;
};

export type CafeEvidenceRequest = {
  id: string;
  run_id: string;
  group_id: string;
  task_id: string | null;
  requested_by: string;
  requested_from: string;
  message: string;
  status: string;
  created_at: string;
};

export function useCafeMission() {
  return useQuery({
    queryKey: ["cafe", "mission"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("techeduca_missions")
        .select("*")
        .eq("code", CAFE_MISSION_CODE)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return {
        id: row["id"] as string,
        code: row["code"] as string,
        title: row["title"] as string,
        objective: row["objective"] as string,
        summary: (row["summary"] as CafeMission["summary"]) ?? [],
        checklist: (row["checklist"] as CafeMission["checklist"]) ?? [],
        practice: (row["practice"] as CafeMission["practice"]) ?? { title: "", instructions: "" },
        checkpoint: (row["checkpoint"] as CafeMission["checkpoint"]) ?? [],
        indicator_codes: (row["indicator_codes"] as string[]) ?? [],
      } satisfies CafeMission;
    },
  });
}

async function loadGroups(groupIds: string[]): Promise<CafeGroup[]> {
  if (groupIds.length === 0) return [];
  const [groupsRes, membersRes] = await Promise.all([
    supabase.from("groups").select("id, name, class_id, qa_lead_id, classes(name)").in("id", groupIds),
    supabase.from("group_members").select("group_id, student_id, member_function").in("group_id", groupIds),
  ]);
  if (groupsRes.error) throw groupsRes.error;
  if (membersRes.error) throw membersRes.error;

  const memberRows = (membersRes.data ?? []) as { group_id: string; student_id: string; member_function: string }[];
  const groupRows = (groupsRes.data ?? []) as Record<string, unknown>[];
  const ids = new Set<string>();
  memberRows.forEach((m) => ids.add(m.student_id));
  groupRows.forEach((g) => {
    const lead = g["qa_lead_id"] as string | null;
    if (lead) ids.add(lead);
  });

  const profilesRes = ids.size
    ? await supabase.from("profiles").select("id, full_name, email").in("id", [...ids])
    : { data: [], error: null };
  if (profilesRes.error) throw profilesRes.error;
  const profileMap = new Map(
    ((profilesRes.data ?? []) as { id: string; full_name: string; email: string }[]).map((p) => [p.id, p]),
  );

  return groupRows.map((g) => {
    const id = g["id"] as string;
    const leadId = (g["qa_lead_id"] as string | null) ?? null;
    const rows = memberRows.filter((m) => m.group_id === id);
    const members: GroupMemberInfo[] = rows.map((m) => ({
      student_id: m.student_id,
      member_function: m.member_function,
      full_name: profileMap.get(m.student_id)?.full_name || profileMap.get(m.student_id)?.email || "Aluno",
      email: profileMap.get(m.student_id)?.email ?? "",
      is_qa_lead: m.student_id === leadId,
    }));
    if (leadId && !members.some((m) => m.student_id === leadId)) {
      members.unshift({
        student_id: leadId,
        member_function: "QA Lead",
        full_name: profileMap.get(leadId)?.full_name || profileMap.get(leadId)?.email || "QA Lead",
        email: profileMap.get(leadId)?.email ?? "",
        is_qa_lead: true,
      });
    }
    const cls = g["classes"] as { name?: string } | null;
    return {
      id,
      name: g["name"] as string,
      class_id: g["class_id"] as string,
      class_name: cls?.name ?? "",
      qa_lead_id: leadId,
      members,
    };
  });
}

/** Grupos do aluno logado (como integrante ou QA Lead). */
export function useMyGroups(userId: string | null) {
  return useQuery({
    queryKey: ["cafe", "my-groups", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [asMember, asLead] = await Promise.all([
        supabase.from("group_members").select("group_id").eq("student_id", userId!),
        supabase.from("groups").select("id").eq("qa_lead_id", userId!),
      ]);
      if (asMember.error) throw asMember.error;
      if (asLead.error) throw asLead.error;
      const ids = new Set<string>();
      (asMember.data ?? []).forEach((r) => ids.add(r.group_id as string));
      (asLead.data ?? []).forEach((r) => ids.add(r.id as string));
      return loadGroups([...ids]);
    },
  });
}

/** Todos os grupos das turmas do instrutor logado. */
export function useInstructorGroups(userId: string | null) {
  return useQuery({
    queryKey: ["cafe", "instructor-groups", userId],
    enabled: !!userId,
    queryFn: async () => {
      const classesRes = await supabase.from("classes").select("id").eq("instructor_id", userId!);
      if (classesRes.error) throw classesRes.error;
      const classIds = (classesRes.data ?? []).map((c) => c.id as string);
      if (classIds.length === 0) return [];
      const groupsRes = await supabase.from("groups").select("id").in("class_id", classIds);
      if (groupsRes.error) throw groupsRes.error;
      return loadGroups((groupsRes.data ?? []).map((g) => g.id as string));
    },
  });
}

/** Garante a execução coletiva da missão para o grupo. */
export function useEnsureGroupRun(groupId: string | null, missionId: string | null, userId: string | null) {
  return useQuery({
    queryKey: ["cafe", "run", groupId, missionId],
    enabled: !!groupId && !!missionId && !!userId,
    queryFn: async () => {
      const existing = await supabase
        .from("cafe_group_runs")
        .select("*")
        .eq("group_id", groupId!)
        .eq("mission_id", missionId!)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return existing.data as CafeRun;

      const created = await supabase
        .from("cafe_group_runs")
        .insert({ group_id: groupId!, mission_id: missionId!, created_by: userId! })
        .select("*")
        .maybeSingle();
      if (created.error) {
        // corrida entre integrantes: recarrega o registro criado por outro
        const retry = await supabase
          .from("cafe_group_runs")
          .select("*")
          .eq("group_id", groupId!)
          .eq("mission_id", missionId!)
          .maybeSingle();
        if (retry.data) return retry.data as CafeRun;
        throw created.error;
      }
      return created.data as CafeRun;
    },
  });
}

export function useGroupRunByGroup(groupId: string | null, missionId: string | null) {
  return useQuery({
    queryKey: ["cafe", "run-readonly", groupId, missionId],
    enabled: !!groupId && !!missionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cafe_group_runs")
        .select("*")
        .eq("group_id", groupId!)
        .eq("mission_id", missionId!)
        .maybeSingle();
      if (error) throw error;
      return (data as CafeRun | null) ?? null;
    },
  });
}

export function useTasks(runId: string | null) {
  return useQuery({
    queryKey: ["cafe", "tasks", runId],
    enabled: !!runId,
    queryFn: async () => {
      const [tasksRes, collabRes] = await Promise.all([
        supabase.from("cafe_tasks").select("*").eq("run_id", runId!).order("created_at"),
        supabase.from("cafe_task_collaborators").select("id, task_id, student_id"),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (collabRes.error) throw collabRes.error;
      return {
        tasks: (tasksRes.data ?? []) as CafeTask[],
        collaborators: (collabRes.data ?? []) as CafeCollaborator[],
      };
    },
  });
}

export function useContributions(runId: string | null) {
  return useQuery({
    queryKey: ["cafe", "contributions", runId],
    enabled: !!runId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cafe_contributions")
        .select("*")
        .eq("run_id", runId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CafeContribution[];
    },
  });
}

export function useEvidenceRequests(runId: string | null) {
  return useQuery({
    queryKey: ["cafe", "evidence-requests", runId],
    enabled: !!runId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cafe_evidence_requests")
        .select("*")
        .eq("run_id", runId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CafeEvidenceRequest[];
    },
  });
}

function useRunInvalidator(runId: string | null) {
  const qc = useQueryClient();
  return (keys: string[]) => {
    keys.forEach((k) => void qc.invalidateQueries({ queryKey: ["cafe", k, runId] }));
  };
}

export function useCreateTask(runId: string | null, groupId: string | null, userId: string | null) {
  const invalidate = useRunInvalidator(runId);
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      area: string;
      assignee_id: string | null;
      collaborators: string[];
    }) => {
      const { data, error } = await supabase
        .from("cafe_tasks")
        .insert({
          run_id: runId!,
          group_id: groupId!,
          title: input.title,
          description: input.description,
          area: input.area,
          assignee_id: input.assignee_id,
          created_by: userId!,
        })
        .select("*")
        .single();
      if (error) throw error;
      const task = data as CafeTask;
      if (input.collaborators.length) {
        const { error: cErr } = await supabase.from("cafe_task_collaborators").insert(
          input.collaborators.map((student_id) => ({
            task_id: task.id,
            group_id: groupId!,
            student_id,
            added_by: userId!,
          })),
        );
        if (cErr) throw cErr;
      }
      return task;
    },
    onSuccess: () => invalidate(["tasks"]),
  });
}

export function useUpdateTask(runId: string | null) {
  const invalidate = useRunInvalidator(runId);
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<CafeTask, "status" | "assignee_id" | "title" | "description" | "area">> }) => {
      const { error } = await supabase.from("cafe_tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["tasks"]),
  });
}

export function useDeleteTask(runId: string | null) {
  const invalidate = useRunInvalidator(runId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cafe_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["tasks", "contributions"]),
  });
}

export function useSetTaskCollaborators(runId: string | null, groupId: string | null, userId: string | null) {
  const invalidate = useRunInvalidator(runId);
  return useMutation({
    mutationFn: async ({ taskId, studentIds }: { taskId: string; studentIds: string[] }) => {
      const del = await supabase.from("cafe_task_collaborators").delete().eq("task_id", taskId);
      if (del.error) throw del.error;
      if (studentIds.length) {
        const { error } = await supabase.from("cafe_task_collaborators").insert(
          studentIds.map((student_id) => ({ task_id: taskId, group_id: groupId!, student_id, added_by: userId! })),
        );
        if (error) throw error;
      }
    },
    onSuccess: () => invalidate(["tasks"]),
  });
}

export function useSetMemberFunction(groupId: string | null, userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, fn }: { studentId: string; fn: string }) => {
      const { error } = await supabase
        .from("group_members")
        .update({ member_function: fn })
        .eq("group_id", groupId!)
        .eq("student_id", studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cafe", "my-groups", userId] });
      void qc.invalidateQueries({ queryKey: ["cafe", "instructor-groups"] });
    },
  });
}

export function useCreateContribution(runId: string | null, groupId: string | null, userId: string | null) {
  const invalidate = useRunInvalidator(runId);
  return useMutation({
    mutationFn: async (input: {
      kind: string;
      title: string;
      description: string;
      link: string | null;
      task_id: string | null;
    }) => {
      const { error } = await supabase.from("cafe_contributions").insert({
        run_id: runId!,
        group_id: groupId!,
        student_id: userId!,
        kind: input.kind,
        title: input.title,
        description: input.description,
        link: input.link,
        task_id: input.task_id,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate(["contributions"]),
  });
}

export function useDeleteContribution(runId: string | null) {
  const invalidate = useRunInvalidator(runId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cafe_contributions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["contributions"]),
  });
}

export function useRequestEvidence(runId: string | null, groupId: string | null, userId: string | null) {
  const invalidate = useRunInvalidator(runId);
  return useMutation({
    mutationFn: async (input: { requested_from: string; message: string; task_id: string | null }) => {
      const { error } = await supabase.from("cafe_evidence_requests").insert({
        run_id: runId!,
        group_id: groupId!,
        requested_by: userId!,
        requested_from: input.requested_from,
        message: input.message,
        task_id: input.task_id,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate(["evidence-requests"]),
  });
}

export function useUpdateEvidenceRequest(runId: string | null) {
  const invalidate = useRunInvalidator(runId);
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("cafe_evidence_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(["evidence-requests"]),
  });
}

export function useUpdateRun(runId: string | null, groupId: string | null, missionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<CafeRun, "deliverable" | "status">> & { submitted_at?: string | null; submitted_by?: string | null }) => {
      const { error } = await supabase.from("cafe_group_runs").update(patch).eq("id", runId!);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cafe", "run", groupId, missionId] });
      void qc.invalidateQueries({ queryKey: ["cafe", "run-readonly", groupId, missionId] });
    },
  });
}
