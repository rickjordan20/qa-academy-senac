import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MissionEntry, Section } from "@/lib/mission-builder";
import type { MissionContribution, MissionTask } from "@/lib/cafe";

/* ==================================================================== */
/* Divisão de tarefas e participação real (missões em grupo)             */
/* SOMENTE LEITURA — reutiliza tarefas, contribuições e registros já     */
/* existentes. Atribuição NUNCA é tratada como prova de execução.        */
/* ==================================================================== */

export type ParticipationState = "done" | "partial" | "none";

export const STATE_LABEL: Record<ParticipationState, string> = {
  done: "✓ Realizado",
  partial: "◐ Parcial",
  none: "○ Sem registro",
};

export const STATE_TONE: Record<ParticipationState, string> = {
  done: "bg-success/15 text-success",
  partial: "bg-warning/15 text-warning",
  none: "bg-secondary text-muted-foreground",
};

export type MemberParticipation = {
  id: string;
  name: string;
  role: string;
  isLead: boolean;
  assignedTasks: MissionTask[];
  doneTasks: MissionTask[];
  assignedSectionIds: string[];
  doneSectionIds: string[];
  contributions: MissionContribution[];
  entries: MissionEntry[];
  evidences: MissionEntry[];
  byKind: Record<string, MissionEntry[]>;
  lastActivity: string | null;
  state: ParticipationState;
};

export type SectionParticipation = {
  section: Section;
  assigned: { id: string; name: string }[];
  performed: { id: string; name: string; at: string }[];
  entries: MissionEntry[];
  contributions: MissionContribution[];
  tasks: MissionTask[];
  state: ParticipationState;
};

export type TaskDivision = {
  task: MissionTask;
  sectionTitle: string | null;
  owners: { id: string; name: string; role: string }[];
  createdByName: string;
  doneAt: string | null;
};

export type AttemptInfo = {
  attempt: number;
  kind: string;
  actorName: string;
  at: string;
};

export type GroupParticipation = {
  groupName: string;
  leadName: string | null;
  members: MemberParticipation[];
  sections: SectionParticipation[];
  tasks: TaskDivision[];
  attempts: AttemptInfo[];
  submittedByName: string | null;
  submittedAt: string | null;
  /** nomes resolvidos por id (histórico/autoria) */
  names: Record<string, string>;
};

export const NO_AUTHOR = "Autor não registrado";

function displayName(p: { full_name: string | null; email: string } | undefined) {
  if (!p) return NO_AUTHOR;
  return (p.full_name || "").trim() || p.email || NO_AUTHOR;
}

function latest(...values: (string | null | undefined)[]) {
  const list = values.filter(Boolean) as string[];
  if (!list.length) return null;
  return list.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

export function useGroupParticipation(runId: string | null) {
  return useQuery({
    queryKey: ["mission-participation", runId],
    enabled: !!runId,
    queryFn: async (): Promise<GroupParticipation | null> => {
      const runRes = await supabase
        .from("builder_mission_runs")
        .select("*, mission:builder_missions(*)")
        .eq("id", runId!)
        .maybeSingle();
      if (runRes.error) throw runRes.error;
      const run = runRes.data as Record<string, unknown> | null;
      if (!run) return null;
      const groupId = run["group_id"] as string | null;
      if (!groupId) return null;

      const mission = run["mission"] as { sections?: Section[] } | null;
      const sections = ((mission?.sections ?? []) as Section[]).filter((s) => s.visible !== false);

      const [groupRes, membersRes, tasksRes, contribRes, entriesRes, eventsRes] = await Promise.all([
        supabase.from("groups").select("id, name, qa_lead_id").eq("id", groupId).maybeSingle(),
        supabase.from("group_members").select("student_id, member_function").eq("group_id", groupId),
        supabase.from("cafe_tasks").select("*").eq("builder_run_id", runId!).order("created_at"),
        supabase.from("cafe_contributions").select("*").eq("builder_run_id", runId!).order("created_at"),
        supabase.from("builder_mission_entries").select("*").eq("run_id", runId!).order("created_at"),
        supabase.from("builder_run_events").select("*").eq("run_id", runId!).order("created_at"),
      ]);
      for (const r of [groupRes, membersRes, tasksRes, contribRes, entriesRes, eventsRes]) {
        if (r.error) throw r.error;
      }

      const group = groupRes.data as { name: string; qa_lead_id: string | null } | null;
      const memberRows = (membersRes.data ?? []) as { student_id: string; member_function: string }[];
      const tasks = (tasksRes.data ?? []) as unknown as MissionTask[];
      const contributions = (contribRes.data ?? []) as unknown as MissionContribution[];
      const entries = (entriesRes.data ?? []) as unknown as MissionEntry[];
      const events = (eventsRes.data ?? []) as unknown as {
        id: string;
        actor_id: string | null;
        kind: string;
        attempt: number;
        created_at: string;
      }[];

      const collabRes = tasks.length
        ? await supabase
            .from("cafe_task_collaborators")
            .select("task_id, student_id")
            .in("task_id", tasks.map((t) => t.id))
        : { data: [], error: null };
      if (collabRes.error) throw collabRes.error;
      const collaborators = (collabRes.data ?? []) as { task_id: string; student_id: string }[];

      // todos os ids que precisam de nome
      const ids = new Set<string>();
      memberRows.forEach((m) => ids.add(m.student_id));
      if (group?.qa_lead_id) ids.add(group.qa_lead_id);
      tasks.forEach((t) => {
        if (t.assignee_id) ids.add(t.assignee_id);
        if (t.created_by) ids.add(t.created_by);
      });
      collaborators.forEach((c) => ids.add(c.student_id));
      contributions.forEach((c) => ids.add(c.student_id));
      entries.forEach((e) => e.author_id && ids.add(e.author_id));
      events.forEach((e) => e.actor_id && ids.add(e.actor_id));
      if (run["submitted_by"]) ids.add(run["submitted_by"] as string);

      const profRes = ids.size
        ? await supabase.from("profiles").select("id, full_name, email").in("id", [...ids])
        : { data: [], error: null };
      if (profRes.error) throw profRes.error;
      const profiles = new Map(
        ((profRes.data ?? []) as { id: string; full_name: string | null; email: string }[]).map((p) => [p.id, p]),
      );
      const nameOf = (id: string | null | undefined) => (id ? displayName(profiles.get(id)) : NO_AUTHOR);
      const names: Record<string, string> = {};
      for (const [id, p] of profiles) names[id] = displayName(p);

      const collabByTask = new Map<string, string[]>();
      for (const c of collaborators) {
        collabByTask.set(c.task_id, [...(collabByTask.get(c.task_id) ?? []), c.student_id]);
      }
      const ownersOf = (t: MissionTask) => {
        const set = new Set<string>();
        if (t.assignee_id) set.add(t.assignee_id);
        (collabByTask.get(t.id) ?? []).forEach((id) => set.add(id));
        return [...set];
      };

      // lista de integrantes (QA Líder incluso mesmo se não estiver em group_members)
      const roleById = new Map(memberRows.map((m) => [m.student_id, m.member_function]));
      const memberIds = new Set(memberRows.map((m) => m.student_id));
      if (group?.qa_lead_id) memberIds.add(group.qa_lead_id);

      const sectionTitle = new Map(sections.map((s) => [s.id, s.title] as const));

      const members: MemberParticipation[] = [...memberIds].map((id) => {
        const assignedTasks = tasks.filter((t) => ownersOf(t).includes(id));
        const doneTasks = assignedTasks.filter((t) => t.status === "done");
        const myEntries = entries.filter((e) => e.author_id === id);
        const myContribs = contributions.filter((c) => c.student_id === id);
        const assignedSectionIds = [
          ...new Set(assignedTasks.map((t) => t.section_id).filter(Boolean) as string[]),
        ];
        const doneSectionIds = [
          ...new Set([
            ...myEntries.map((e) => e.section_id),
            ...(myContribs.map((c) => c.section_id).filter(Boolean) as string[]),
          ]),
        ];
        const byKind: Record<string, MissionEntry[]> = {};
        for (const e of myEntries) byKind[e.kind] = [...(byKind[e.kind] ?? []), e];

        const activity = myEntries.length + myContribs.length;
        let state: ParticipationState = "none";
        if (activity > 0 || doneTasks.length > 0) {
          const pendingTasks = assignedTasks.length > 0 && doneTasks.length < assignedTasks.length;
          const pendingSections = assignedSectionIds.some((s) => !doneSectionIds.includes(s));
          state = activity === 0 || pendingTasks || pendingSections ? "partial" : "done";
        }

        return {
          id,
          name: nameOf(id),
          role: group?.qa_lead_id === id ? "QA Líder" : (roleById.get(id) || "Integrante"),
          isLead: group?.qa_lead_id === id,
          assignedTasks,
          doneTasks,
          assignedSectionIds,
          doneSectionIds,
          contributions: myContribs,
          entries: myEntries,
          evidences: myEntries.filter((e) => e.kind === "evidence" || !!e.link),
          byKind,
          lastActivity: latest(
            ...myEntries.map((e) => e.created_at),
            ...myContribs.map((c) => c.created_at),
          ),
          state,
        };
      });
      members.sort((a, b) => (a.isLead === b.isLead ? a.name.localeCompare(b.name) : a.isLead ? -1 : 1));

      const sectionsOut: SectionParticipation[] = sections.map((section) => {
        const secTasks = tasks.filter((t) => t.section_id === section.id);
        const assignedIds = [...new Set(secTasks.flatMap(ownersOf))];
        const secEntries = entries.filter((e) => e.section_id === section.id);
        const secContribs = contributions.filter((c) => c.section_id === section.id);
        const performedMap = new Map<string, string>();
        for (const e of secEntries) {
          if (!e.author_id) continue;
          performedMap.set(e.author_id, latest(performedMap.get(e.author_id), e.created_at) ?? e.created_at);
        }
        for (const c of secContribs) {
          performedMap.set(c.student_id, latest(performedMap.get(c.student_id), c.created_at) ?? c.created_at);
        }
        const performed = [...performedMap.entries()].map(([id, at]) => ({ id, name: nameOf(id), at }));
        let state: ParticipationState = "none";
        if (performed.length) {
          state = assignedIds.length && assignedIds.some((id) => !performedMap.has(id)) ? "partial" : "done";
        }
        return {
          section,
          assigned: assignedIds.map((id) => ({ id, name: nameOf(id) })),
          performed,
          entries: secEntries,
          contributions: secContribs,
          tasks: secTasks,
          state,
        };
      });

      const division: TaskDivision[] = tasks.map((t) => ({
        task: t,
        sectionTitle: t.section_id ? (sectionTitle.get(t.section_id) ?? null) : null,
        owners: ownersOf(t).map((id) => ({
          id,
          name: nameOf(id),
          role: group?.qa_lead_id === id ? "QA Líder" : (roleById.get(id) || "Integrante"),
        })),
        createdByName: nameOf(t.created_by),
        doneAt: t.status === "done" ? ((t as unknown as { updated_at?: string }).updated_at ?? null) : null,
      }));

      const attempts: AttemptInfo[] = events
        .filter((e) => e.kind === "submitted" || e.kind === "resubmitted")
        .map((e) => ({
          attempt: e.attempt,
          kind: e.kind,
          actorName: e.actor_id ? nameOf(e.actor_id) : NO_AUTHOR,
          at: e.created_at,
        }))
        .sort((a, b) => a.attempt - b.attempt);

      return {
        groupName: group?.name ?? "Grupo",
        leadName: group?.qa_lead_id ? nameOf(group.qa_lead_id) : null,
        members,
        sections: sectionsOut,
        tasks: division,
        attempts,
        submittedByName: run["submitted_by"] ? nameOf(run["submitted_by"] as string) : null,
        submittedAt: (run["submitted_at"] as string | null) ?? null,
        names,
      };
    },
  });
}
