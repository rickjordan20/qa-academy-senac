import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  blockDef,
  type BuilderMission,
  type ChecklistItemDef,
  type MissionEntry,
  type QuestionDef,
  type Section,
} from "@/lib/mission-builder";
import type { BlockResult, RunEvaluation } from "@/lib/mission-submissions";

/* ==================================================================== */
/* Relatório de Entregas por Missão — SOMENTE LEITURA                    */
/* ==================================================================== */

export type ReportIndicator = { code: string; description: string };

export type ReportBlock = {
  section: Section;
  /** indicadores previstos no bloco (configuração da missão) */
  planned: ReportIndicator[];
  /** conteúdo entregue: pares rótulo/valor e registros */
  pairs: { label: string; value: string }[];
  checklist: { label: string; done: boolean }[];
  entries: { title: string; fields: { label: string; value: string }[]; link: string | null }[];
  /** avaliação do bloco (quando existir) */
  result: BlockResult | null;
};

export type ReportParticipant = {
  name: string;
  isLead: boolean;
  assignedTasks: string[];
  doneTasks: string[];
  entries: number;
  contributions: number;
  evidences: number;
  lastActivity: string | null;
};

export type ReportEvaluationVersion = {
  version: number;
  is_current: boolean;
  created_at: string;
  xp: number | null;
  feedback: string;
  superseded_reason: string;
};

export type ReportTarget = {
  key: string;
  /** nome do aluno ou do grupo */
  name: string;
  members: string[];
  run: {
    id: string;
    status: string;
    eval_status: string;
    progress: number;
    attempt: number;
    xp_awarded: number | null;
    feedback: string;
    submitted_at: string | null;
  } | null;
  blocks: ReportBlock[];
  indicatorFinals: Record<string, string>;
  hasPreviousAttempts: boolean;
  /** avaliações individuais (missão em grupo) */
  individual: { name: string; indicators: Record<string, string> }[];
  /** justificativa registrada para a diferenciação individual */
  overrideNotes: string;
  /** divisão de tarefas e participação real (missão em grupo) */
  participation: ReportParticipant[];
  /** versões da avaliação (vigente + histórico) */
  evaluationHistory: ReportEvaluationVersion[];
};

export type MissionReport = {
  mission: BuilderMission;
  className: string;
  isGroup: boolean;
  indicators: ReportIndicator[];
  targets: ReportTarget[];
  summary: {
    expected: number;
    delivered: number;
    notStarted: number;
    inProgress: number;
    awaiting: number;
    inReview: number;
    revision: number;
    reeval: number;
    evaluated: number;
  };
};


type Row = Record<string, unknown>;

/** Missões relacionadas a uma turma (atribuídas a ela ou sem restrição de turma). */
export function useClassMissions(classId: string | null) {
  return useQuery({
    queryKey: ["mission-report", "missions", classId],
    enabled: !!classId,
    queryFn: async (): Promise<BuilderMission[]> => {
      const [missionsRes, assignRes] = await Promise.all([
        supabase
          .from("builder_missions")
          .select("*")
          .eq("is_library_template", false)
          .order("lesson_number", { ascending: true, nullsFirst: false }),
        supabase.from("builder_mission_assignments").select("mission_id, class_id"),
      ]);
      if (missionsRes.error) throw missionsRes.error;
      if (assignRes.error) throw assignRes.error;
      const assigns = (assignRes.data ?? []) as { mission_id: string; class_id: string }[];
      const restricted = new Set(assigns.map((a) => a.mission_id));
      const mine = new Set(assigns.filter((a) => a.class_id === classId).map((a) => a.mission_id));
      return ((missionsRes.data ?? []) as Row[])
        .map((m) => ({ ...(m as unknown as BuilderMission), sections: (m["sections"] as Section[]) ?? [] }))
        .filter((m) => !restricted.has(m.id) || mine.has(m.id));
    },
  });
}

function entriesOf(section: Section, entries: MissionEntry[]) {
  const def = blockDef(section.kind);
  return entries
    .filter((e) => e.section_id === section.id)
    .map((e) => {
      const data = (e.data ?? {}) as Record<string, string>;
      const fields = (def.fields ?? []).map((f) => ({
        label: f.label,
        value: (data[f.key] ?? "").toString().trim(),
      }));
      // campos extras não previstos no catálogo
      for (const [k, v] of Object.entries(data)) {
        if ((def.fields ?? []).some((f) => f.key === k)) continue;
        if (!(v ?? "").toString().trim()) continue;
        fields.push({ label: k, value: String(v) });
      }
      const shown = fields.filter((f) => f.value);
      const missingRequired = (def.fields ?? [])
        .filter((f) => f.required && !(data[f.key] ?? "").toString().trim())
        .map((f) => ({ label: f.label, value: "Não preenchido" }));
      return {
        title: e.title || "Registro",
        fields: [...shown, ...missingRequired],
        link: e.link ?? null,
      };
    });
}

export function buildTargetBlocks(
  mission: BuilderMission,
  run: { answers?: Record<string, Record<string, string>>; checklist_state?: Record<string, boolean> } | null,
  entries: MissionEntry[],
  evaluation: RunEvaluation | null,
  indicatorMap: Map<string, string>,
): ReportBlock[] {
  const sections = (mission.sections ?? []).filter((s) => s.visible !== false);
  const resultBySection = new Map((evaluation?.block_results ?? []).map((b) => [b.section_id, b]));
  const out: ReportBlock[] = [];

  for (const section of sections) {
    const def = blockDef(section.kind);
    const answers = (run?.answers?.[section.id] ?? {}) as Record<string, string>;
    const pairs = Object.entries(answers)
      .filter(([, v]) => (v ?? "").toString().trim())
      .map(([k, v]) => {
        const item = ((section.items ?? []) as (QuestionDef & { key?: string })[]).find((i) => i.key === k);
        const field = (def.answerFields ?? []).find((f) => f.key === k);
        return { label: item?.label ?? field?.label ?? k, value: String(v) };
      });

    const checklist =
      section.kind === "checklist"
        ? ((section.items ?? []) as ChecklistItemDef[]).map((i) => ({
            label: i.label,
            done: !!run?.checklist_state?.[i.id],
          }))
        : [];

    const blockEntries = entriesOf(section, entries);
    const planned = (section.indicator_codes ?? []).map((code) => ({
      code,
      description: indicatorMap.get(code) ?? "",
    }));
    const result = resultBySection.get(section.id) ?? null;

    const hasProduction = pairs.length > 0 || checklist.length > 0 || blockEntries.length > 0;
    // blocos apenas de conteúdo, sem produção e sem indicadores previstos, ficam fora do PDF
    if (def.family === "content" && !hasProduction && planned.length === 0) continue;
    if (!hasProduction && planned.length === 0) continue;

    out.push({ section, planned, pairs, checklist, entries: blockEntries, result });
  }
  return out;
}

export function useMissionReport(classId: string | null, missionId: string | null) {
  return useQuery({
    queryKey: ["mission-report", "data", classId, missionId],
    enabled: !!classId && !!missionId,
    queryFn: async (): Promise<MissionReport | null> => {
      const [missionRes, classRes, indRes] = await Promise.all([
        supabase.from("builder_missions").select("*").eq("id", missionId!).maybeSingle(),
        supabase.from("classes").select("id, name, code").eq("id", classId!).maybeSingle(),
        supabase.from("indicators").select("id, code, description").eq("uc_code", "UC10").order("position"),
      ]);
      if (missionRes.error) throw missionRes.error;
      if (classRes.error) throw classRes.error;
      if (indRes.error) throw indRes.error;
      if (!missionRes.data) return null;

      const missionRow = missionRes.data as Row;
      const mission: BuilderMission = {
        ...(missionRow as unknown as BuilderMission),
        sections: (missionRow["sections"] as Section[]) ?? [],
      };
      const cls = classRes.data as { name: string; code: string | null } | null;
      const className = cls ? (cls.code ? `${cls.name} (${cls.code})` : cls.name) : "—";
      const indicators = ((indRes.data ?? []) as { code: string; description: string }[]).map((i) => ({
        code: i.code,
        description: i.description,
      }));
      const indicatorMap = new Map(indicators.map((i) => [i.code, i.description] as const));

      const isGroup = mission.template === "cafe";

      const [runsRes, entriesRes, evalsRes, enrollRes, groupsRes] = await Promise.all([
        supabase.from("builder_mission_runs").select("*").eq("mission_id", mission.id),
        supabase.from("builder_mission_entries").select("*").eq("mission_id", mission.id),
        supabase.from("builder_run_evaluations").select("*").eq("mission_id", mission.id),
        supabase.from("enrollments").select("student_id").eq("class_id", classId!),
        supabase.from("groups").select("id, name, qa_lead_id, class_id").eq("class_id", classId!),
      ]);
      if (runsRes.error) throw runsRes.error;
      if (entriesRes.error) throw entriesRes.error;
      if (evalsRes.error) throw evalsRes.error;
      if (enrollRes.error) throw enrollRes.error;
      if (groupsRes.error) throw groupsRes.error;

      const studentIds = (enrollRes.data ?? []).map((e) => (e as { student_id: string }).student_id);
      const groupRows = (groupsRes.data ?? []) as { id: string; name: string; qa_lead_id: string | null }[];
      const groupIds = groupRows.map((g) => g.id);

      const [membersRes, profilesRes] = await Promise.all([
        groupIds.length
          ? supabase.from("group_members").select("group_id, student_id").in("group_id", groupIds)
          : Promise.resolve({ data: [], error: null }),
        studentIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", studentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (membersRes.error) throw membersRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const memberRows = (membersRes.data ?? []) as { group_id: string; student_id: string }[];
      const extraIds = memberRows.map((m) => m.student_id).filter((id) => !studentIds.includes(id));
      const extraProfiles = extraIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", extraIds)
        : { data: [], error: null };
      if (extraProfiles.error) throw extraProfiles.error;

      const nameById = new Map(
        [...((profilesRes.data ?? []) as Row[]), ...((extraProfiles.data ?? []) as Row[])].map((p) => {
          const r = p as unknown as { id: string; full_name: string | null; email: string };
          return [r.id, (r.full_name || "").trim() || r.email] as const;
        }),
      );

      const runs = (runsRes.data ?? []) as unknown as (Row & {
        id: string;
        student_id: string | null;
        group_id: string | null;
        status: string;
        eval_status: string;
        progress: number;
        attempt: number;
        xp_awarded: number | null;
        feedback: string | null;
        submitted_at: string | null;
        answers: Record<string, Record<string, string>>;
        checklist_state: Record<string, boolean>;
      })[];
      const entries = (entriesRes.data ?? []) as unknown as MissionEntry[];
      const evaluations = (evalsRes.data ?? []) as unknown as RunEvaluation[];

      const currentEval = new Map<string, RunEvaluation>();
      for (const ev of evaluations) {
        const cur = currentEval.get(ev.run_id);
        if (!cur || ev.is_current || ev.version > cur.version) currentEval.set(ev.run_id, ev);
      }

      /* participação real (somente leitura) para missões em grupo */
      const runIds = runs.map((r) => r.id);
      type TaskRow = { id: string; title: string; status: string; assignee_id: string | null; builder_run_id: string | null };
      type CollabRow = { task_id: string; student_id: string };
      type ContribRow = { builder_run_id: string | null; student_id: string; created_at: string };
      let taskRows: TaskRow[] = [];
      let collabRows: CollabRow[] = [];
      let contribRows: ContribRow[] = [];
      if (isGroup && runIds.length) {
        const [tRes, cRes] = await Promise.all([
          supabase.from("cafe_tasks").select("id, title, status, assignee_id, builder_run_id").in("builder_run_id", runIds),
          supabase
            .from("cafe_contributions")
            .select("builder_run_id, student_id, created_at")
            .in("builder_run_id", runIds),
        ]);
        if (tRes.error) throw tRes.error;
        if (cRes.error) throw cRes.error;
        taskRows = (tRes.data ?? []) as unknown as TaskRow[];
        contribRows = (cRes.data ?? []) as unknown as ContribRow[];
        const taskIds = taskRows.map((t) => t.id);
        if (taskIds.length) {
          const colRes = await supabase.from("cafe_task_collaborators").select("task_id, student_id").in("task_id", taskIds);
          if (colRes.error) throw colRes.error;
          collabRows = (colRes.data ?? []) as unknown as CollabRow[];
        }
      }

      const mkTarget = (
        key: string,
        name: string,
        members: string[],
        run: (typeof runs)[number] | undefined,
        memberIds: string[] = [],
        leadId: string | null = null,
      ): ReportTarget => {
        const evaluation = run ? (currentEval.get(run.id) ?? null) : null;
        const runEntries = run ? entries.filter((e) => e.run_id === run.id) : [];
        const history: ReportEvaluationVersion[] = run
          ? evaluations
              .filter((e) => e.run_id === run.id)
              .sort((a, b) => b.version - a.version)
              .map((e) => ({
                version: e.version,
                is_current: e.is_current,
                created_at: e.created_at,
                xp: e.xp ?? null,
                feedback: e.feedback ?? "",
                superseded_reason: e.superseded_reason ?? "",
              }))
          : [];

        const participation: ReportParticipant[] = [];
        if (isGroup && run) {
          const runTasks = taskRows.filter((t) => t.builder_run_id === run.id);
          const runContribs = contribRows.filter((c) => c.builder_run_id === run.id);
          for (const sid of memberIds) {
            const mine = runTasks.filter(
              (t) => t.assignee_id === sid || collabRows.some((c) => c.task_id === t.id && c.student_id === sid),
            );
            const myContribs = runContribs.filter((c) => c.student_id === sid);
            const myEntries = runEntries.filter((e) => e.author_id === sid);
            const times = [
              ...myContribs.map((c) => c.created_at),
              ...myEntries.map((e) => e.created_at as string),
            ].filter(Boolean);
            participation.push({
              name: nameById.get(sid) ?? "Aluno",
              isLead: leadId === sid,
              assignedTasks: mine.map((t) => t.title),
              doneTasks: mine.filter((t) => t.status === "done").map((t) => t.title),
              entries: myEntries.length,
              contributions: myContribs.length,
              evidences: myEntries.filter((e) => e.kind === "evidence").length,
              lastActivity: times.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null,
            });
          }
        }

        return {
          key,
          name,
          members,
          run: run
            ? {
                id: run.id,
                status: run.status,
                eval_status: run.eval_status ?? "none",
                progress: run.progress ?? 0,
                attempt: run.attempt ?? 1,
                xp_awarded: run.xp_awarded ?? null,
                feedback: run.feedback ?? "",
                submitted_at: run.submitted_at ?? null,
              }
            : null,
          blocks: buildTargetBlocks(mission, run ?? null, runEntries, evaluation, indicatorMap),
          indicatorFinals: evaluation?.indicator_finals ?? {},
          hasPreviousAttempts: (run?.attempt ?? 1) > 1,
          individual: [],
          overrideNotes: evaluation?.override_notes ?? "",
          participation,
          evaluationHistory: history,
        };
      };


      let targets: ReportTarget[] = [];
      if (isGroup) {
        targets = groupRows
          .map((g) => {
            const members = memberRows
              .filter((m) => m.group_id === g.id)
              .map((m) => nameById.get(m.student_id) ?? "Aluno");
            if (g.qa_lead_id) {
              const lead = nameById.get(g.qa_lead_id);
              if (lead && !members.includes(lead)) members.unshift(lead);
            }
            const run = runs.find((r) => r.group_id === g.id);
            return mkTarget(g.id, g.name, members, run);
          })
          .sort((a, b) => a.name.localeCompare(b.name));
      } else {
        targets = studentIds
          .map((sid) => mkTarget(sid, nameById.get(sid) ?? "Aluno", [], runs.find((r) => r.student_id === sid)))
          .sort((a, b) => a.name.localeCompare(b.name));
      }

      // avaliações individuais registradas na matriz a partir desta missão
      if (isGroup) {
        const codeByIndicatorId = new Map(
          ((indRes.data ?? []) as { id: string; code: string }[]).map((i) => [i.id, i.code] as const),
        );
        const indEvalRes = await supabase
          .from("indicator_evaluations")
          .select("student_id, indicator_id, concept")
          .eq("class_id", classId!)
          .eq("source_mission_id", mission.id);
        if (indEvalRes.error) throw indEvalRes.error;
        const rows = (indEvalRes.data ?? []) as {
          student_id: string;
          indicator_id: string;
          concept: string | null;
        }[];
        for (const t of targets) {
          const ids = memberRows.filter((m) => m.group_id === t.key).map((m) => m.student_id);
          for (const sid of ids) {
            const mine = rows.filter((r) => r.student_id === sid && r.concept);
            if (!mine.length) continue;
            const map: Record<string, string> = {};
            let differs = false;
            for (const r of mine) {
              const code = codeByIndicatorId.get(r.indicator_id);
              if (!code) continue;
              map[code] = r.concept!;
              if (t.indicatorFinals[code] && t.indicatorFinals[code] !== r.concept) differs = true;
            }
            if (differs) t.individual.push({ name: nameById.get(sid) ?? "Aluno", indicators: map });
          }
        }
      }

      const summary = {
        expected: targets.length,
        delivered: targets.filter((t) => !!t.run?.submitted_at).length,
        notStarted: targets.filter((t) => !t.run).length,
        inProgress: targets.filter((t) => t.run && !t.run.submitted_at).length,
        awaiting: targets.filter((t) => t.run?.eval_status === "awaiting").length,
        inReview: targets.filter((t) => t.run?.eval_status === "in_review").length,
        revision: targets.filter((t) => t.run?.eval_status === "revision").length,
        reeval: targets.filter((t) => t.run?.eval_status === "reeval").length,
        evaluated: targets.filter((t) => t.run?.eval_status === "evaluated").length,

      };

      return { mission, className, isGroup, indicators, targets, summary };
    },
  });
}
