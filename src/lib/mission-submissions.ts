import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BuilderMission, MissionEntry, Section } from "@/lib/mission-builder";

/* ==================================================================== */
/* Fluxo de envios / avaliação das missões (usa as tabelas existentes)   */
/* ==================================================================== */

export type EvalStatus = "none" | "awaiting" | "in_review" | "revision" | "evaluated";

export type SubmissionRun = {
  id: string;
  mission_id: string;
  student_id: string | null;
  group_id: string | null;
  status: string;
  eval_status: EvalStatus;
  attempt: number;
  progress: number;
  xp_awarded: number | null;
  feedback: string;
  evaluated_by: string | null;
  evaluated_at: string | null;
  answers: Record<string, Record<string, string>>;
  checklist_state: Record<string, boolean>;
  submitted_at: string | null;
  submitted_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type RunEvent = {
  id: string;
  run_id: string;
  mission_id: string;
  actor_id: string | null;
  kind: string;
  attempt: number;
  note: string;
  created_at: string;
};

export type SubmissionRow = SubmissionRun & {
  mission: Pick<
    BuilderMission,
    "id" | "title" | "lesson_number" | "template" | "project" | "base_xp" | "modality" | "due_at" | "status" | "indicator_codes" | "objective" | "description" | "subtitle" | "sections" | "opens_at"
  > | null;
  studentName: string;
  studentEmail: string;
  groupName: string | null;
  className: string | null;
  classId: string | null;
};

export const EVAL_LABEL: Record<string, string> = {
  none: "Não enviada",
  awaiting: "Aguardando avaliação",
  in_review: "Em avaliação",
  revision: "Revisão solicitada",
  evaluated: "Avaliada",
};

/** Situação amigável combinando execução + avaliação. */
export function runSituation(run: {
  status: string;
  eval_status: string;
  submitted_at: string | null;
}): { key: string; label: string; tone: string } {
  if (run.eval_status === "evaluated") return { key: "evaluated", label: "🟢 Avaliada", tone: "bg-success/15 text-success" };
  if (run.eval_status === "revision")
    return { key: "revision", label: "🟣 Revisão solicitada", tone: "bg-warning/15 text-warning" };
  if (run.eval_status === "in_review") return { key: "in_review", label: "🔵 Em avaliação", tone: "bg-accent/15 text-accent" };
  if (run.eval_status === "awaiting" || run.submitted_at)
    return { key: "awaiting", label: "🔵 Aguardando avaliação", tone: "bg-accent/15 text-accent" };
  return { key: "in_progress", label: "🟡 Em andamento", tone: "bg-secondary text-muted-foreground" };
}

export const SITUATION_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "in_progress", label: "Em andamento" },
  { key: "awaiting", label: "Aguardando avaliação" },
  { key: "in_review", label: "Em avaliação" },
  { key: "revision", label: "Revisão solicitada" },
  { key: "evaluated", label: "Avaliadas" },
];

export function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function normalizeRun(row: Record<string, unknown>): SubmissionRun {
  return {
    ...(row as unknown as SubmissionRun),
    answers: (row["answers"] as Record<string, Record<string, string>>) ?? {},
    checklist_state: (row["checklist_state"] as Record<string, boolean>) ?? {},
    eval_status: ((row["eval_status"] as EvalStatus) ?? "none") as EvalStatus,
    attempt: (row["attempt"] as number) ?? 1,
    feedback: (row["feedback"] as string) ?? "",
  };
}

const RUN_SELECT = "*, mission:builder_missions(*)";

type JoinedRow = Record<string, unknown> & { mission: Record<string, unknown> | null };

async function decorate(rows: JoinedRow[]): Promise<SubmissionRow[]> {
  const studentIds = new Set<string>();
  const groupIds = new Set<string>();
  for (const r of rows) {
    if (r["student_id"]) studentIds.add(r["student_id"] as string);
    if (r["submitted_by"]) studentIds.add(r["submitted_by"] as string);
    if (r["group_id"]) groupIds.add(r["group_id"] as string);
  }

  const [profilesRes, groupsRes] = await Promise.all([
    studentIds.size
      ? supabase.from("profiles").select("id, full_name, email").in("id", [...studentIds])
      : Promise.resolve({ data: [], error: null }),
    groupIds.size
      ? supabase.from("groups").select("id, name, class_id").in("id", [...groupIds])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (groupsRes.error) throw groupsRes.error;

  const profiles = new Map(
    (profilesRes.data ?? []).map((p) => {
      const row = p as { id: string; full_name: string | null; email: string };
      return [row.id, row] as const;
    }),
  );
  const groups = new Map(
    (groupsRes.data ?? []).map((g) => {
      const row = g as { id: string; name: string; class_id: string };
      return [row.id, row] as const;
    }),
  );

  // turma do aluno (matrícula) e turma do grupo
  const enrollRes = studentIds.size
    ? await supabase.from("enrollments").select("student_id, class_id").in("student_id", [...studentIds])
    : { data: [], error: null };
  if (enrollRes.error) throw enrollRes.error;
  const classByStudent = new Map<string, string>();
  for (const e of (enrollRes.data ?? []) as { student_id: string; class_id: string }[]) {
    if (!classByStudent.has(e.student_id)) classByStudent.set(e.student_id, e.class_id);
  }

  const classIds = new Set<string>([...classByStudent.values(), ...[...groups.values()].map((g) => g.class_id)]);
  const classesRes = classIds.size
    ? await supabase.from("classes").select("id, name, code").in("id", [...classIds])
    : { data: [], error: null };
  if (classesRes.error) throw classesRes.error;
  const classes = new Map(
    (classesRes.data ?? []).map((c) => {
      const row = c as { id: string; name: string; code: string | null };
      return [row.id, row.code ? `${row.name} (${row.code})` : row.name] as const;
    }),
  );

  return rows.map((r) => {
    const run = normalizeRun(r);
    const group = run.group_id ? (groups.get(run.group_id) ?? null) : null;
    const personId = run.student_id ?? run.submitted_by ?? null;
    const profile = personId ? profiles.get(personId) : undefined;
    const classId = group?.class_id ?? (run.student_id ? (classByStudent.get(run.student_id) ?? null) : null);
    return {
      ...run,
      mission: (r.mission as unknown as SubmissionRow["mission"]) ?? null,
      studentName: profile?.full_name?.trim() || profile?.email || (group ? "Envio do grupo" : "Aluno"),
      studentEmail: profile?.email ?? "",
      groupName: group?.name ?? null,
      classId,
      className: classId ? (classes.get(classId) ?? null) : null,
    };
  });
}

/* ---------------------------- ALUNO --------------------------------- */

/** Todas as execuções do aluno: individuais + dos grupos em que participa. */
export function useMySubmissions(userId: string | null) {
  return useQuery({
    queryKey: ["mission-submissions", "mine", userId],
    enabled: !!userId,
    queryFn: async (): Promise<SubmissionRow[]> => {
      const [mine, asMember, asLead] = await Promise.all([
        supabase.from("builder_mission_runs").select(RUN_SELECT).eq("student_id", userId!),
        supabase.from("group_members").select("group_id").eq("student_id", userId!),
        supabase.from("groups").select("id").eq("qa_lead_id", userId!),
      ]);
      if (mine.error) throw mine.error;
      if (asMember.error) throw asMember.error;
      if (asLead.error) throw asLead.error;

      const groupIds = new Set<string>();
      (asMember.data ?? []).forEach((r) => groupIds.add((r as { group_id: string }).group_id));
      (asLead.data ?? []).forEach((r) => groupIds.add((r as { id: string }).id));

      let groupRuns: unknown[] = [];
      if (groupIds.size) {
        const res = await supabase.from("builder_mission_runs").select(RUN_SELECT).in("group_id", [...groupIds]);
        if (res.error) throw res.error;
        groupRuns = res.data ?? [];
      }

      const all = [...((mine.data ?? []) as unknown[]), ...groupRuns] as JoinedRow[];
      const unique = new Map(all.map((r) => [r["id"] as string, r]));
      const rows = await decorate([...unique.values()]);
      return rows.sort(
        (a, b) =>
          new Date(b.submitted_at ?? b.updated_at ?? b.created_at).getTime() -
          new Date(a.submitted_at ?? a.updated_at ?? a.created_at).getTime(),
      );
    },
  });
}

/* -------------------------- INSTRUTOR -------------------------------- */

/** Todos os envios/execuções (RLS já limita ao instrutor). */
export function useAllSubmissions() {
  return useQuery({
    queryKey: ["mission-submissions", "all"],
    queryFn: async (): Promise<SubmissionRow[]> => {
      const { data, error } = await supabase
        .from("builder_mission_runs")
        .select(RUN_SELECT)
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return decorate((data ?? []) as unknown as JoinedRow[]);
    },
  });
}

/** Uma execução com missão, registros, histórico e integrantes do grupo. */
export function useSubmission(runId: string | null) {
  return useQuery({
    queryKey: ["mission-submissions", "one", runId],
    enabled: !!runId,
    queryFn: async () => {
      const { data, error } = await supabase.from("builder_mission_runs").select(RUN_SELECT).eq("id", runId!).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [row] = await decorate([data as unknown as JoinedRow]);
      if (!row) return null;

      const [entriesRes, eventsRes] = await Promise.all([
        supabase.from("builder_mission_entries").select("*").eq("run_id", runId!).order("created_at"),
        supabase.from("builder_run_events").select("*").eq("run_id", runId!).order("created_at"),
      ]);
      if (entriesRes.error) throw entriesRes.error;
      if (eventsRes.error) throw eventsRes.error;

      let members: { id: string; name: string; role: string }[] = [];
      if (row.group_id) {
        const gm = await supabase.from("group_members").select("student_id, member_function").eq("group_id", row.group_id);
        if (gm.error) throw gm.error;
        const ids = (gm.data ?? []).map((m) => (m as { student_id: string }).student_id);
        if (ids.length) {
          const profs = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
          if (profs.error) throw profs.error;
          const byId = new Map(
            (profs.data ?? []).map((p) => {
              const r = p as { id: string; full_name: string | null; email: string };
              return [r.id, r.full_name?.trim() || r.email] as const;
            }),
          );
          members = (gm.data ?? []).map((m) => {
            const r = m as { student_id: string; member_function: string };
            return { id: r.student_id, name: byId.get(r.student_id) ?? "Aluno", role: r.member_function };
          });
        }
      }

      return {
        run: row,
        entries: (entriesRes.data ?? []) as unknown as MissionEntry[],
        events: (eventsRes.data ?? []) as unknown as RunEvent[],
        members,
      };
    },
  });
}

export function useIndicatorResults(classId: string | null, studentId: string | null) {
  return useQuery({
    queryKey: ["mission-submissions", "indicators", classId, studentId],
    enabled: !!classId && !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicator_evaluations")
        .select("indicator_id, concept, notes, evaluated_at")
        .eq("class_id", classId!)
        .eq("student_id", studentId!);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const r of (data ?? []) as { indicator_id: string; concept: string | null }[]) {
        if (r.concept) map[r.indicator_id] = r.concept;
      }
      return map;
    },
  });
}

async function logEvent(input: {
  runId: string;
  missionId: string;
  actorId: string;
  kind: string;
  attempt: number;
  note?: string;
}) {
  await supabase.from("builder_run_events").insert({
    run_id: input.runId,
    mission_id: input.missionId,
    actor_id: input.actorId,
    kind: input.kind,
    attempt: input.attempt,
    note: input.note ?? "",
  } as never);
}

export const EVENT_LABEL: Record<string, string> = {
  started: "Aluno iniciou a missão",
  submitted: "Aluno realizou envio",
  resubmitted: "Aluno realizou novo envio",
  in_review: "Instrutor iniciou a avaliação",
  revision: "Instrutor solicitou revisão",
  evaluated: "Instrutor concluiu a avaliação",
};

/** Envio do aluno (1ª vez ou reenvio) — nunca apaga a tentativa anterior. */
export function useSubmitRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      run: SubmissionRun;
      missionId: string;
      actorId: string;
      progress: number;
      answers: Record<string, Record<string, string>>;
      checklist: Record<string, boolean>;
    }) => {
      const isResubmit = !!input.run.submitted_at;
      const attempt = isResubmit ? input.run.attempt + 1 : 1;
      const { error } = await supabase
        .from("builder_mission_runs")
        .update({
          status: "completed",
          eval_status: "awaiting",
          attempt,
          progress: input.progress,
          answers: input.answers as never,
          checklist_state: input.checklist as never,
          submitted_at: new Date().toISOString(),
          submitted_by: input.actorId,
        } as never)
        .eq("id", input.run.id);
      if (error) throw error;
      await logEvent({
        runId: input.run.id,
        missionId: input.missionId,
        actorId: input.actorId,
        kind: isResubmit ? "resubmitted" : "submitted",
        attempt,
      });
      return attempt;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mission-submissions"] });
      void qc.invalidateQueries({ queryKey: ["builder-run"] });
      void qc.invalidateQueries({ queryKey: ["builder-participation"] });
    },
  });
}

/** Avaliação do instrutor: status, XP, feedback e indicadores A/PA/NA. */
export function useEvaluateSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      run: SubmissionRow;
      instructorId: string;
      decision: "draft" | "evaluated" | "revision";
      xp: number | null;
      feedback: string;
      indicators: Record<string, string>; // indicator_id -> A|PA|NA
    }) => {
      const evalStatus: EvalStatus =
        input.decision === "evaluated" ? "evaluated" : input.decision === "revision" ? "revision" : "in_review";

      const { error } = await supabase
        .from("builder_mission_runs")
        .update({
          eval_status: evalStatus,
          xp_awarded: input.decision === "evaluated" ? input.xp : input.run.xp_awarded,
          feedback: input.feedback,
          evaluated_by: input.instructorId,
          evaluated_at: input.decision === "draft" ? null : new Date().toISOString(),
          status: input.decision === "revision" ? "in_progress" : input.run.status,
        } as never)
        .eq("id", input.run.id);
      if (error) throw error;

      await logEvent({
        runId: input.run.id,
        missionId: input.run.mission_id,
        actorId: input.instructorId,
        kind: input.decision === "evaluated" ? "evaluated" : input.decision === "revision" ? "revision" : "in_review",
        attempt: input.run.attempt,
        note: input.feedback,
      });

      // Indicadores A/PA/NA — usa a matriz de avaliação existente
      const targets = input.run.student_id
        ? [input.run.student_id]
        : []; // envios de grupo: avaliação por indicador é feita por aluno na matriz
      if (input.run.classId && targets.length) {
        for (const [indicatorId, concept] of Object.entries(input.indicators)) {
          if (!concept) continue;
          const { error: evalErr } = await supabase.from("indicator_evaluations").upsert(
            {
              class_id: input.run.classId,
              student_id: targets[0]!,
              indicator_id: indicatorId,
              concept,
              stage: "regular",
              notes: input.feedback,
              evaluated_by: input.instructorId,
              evaluated_at: new Date().toISOString(),
            } as never,
            { onConflict: "class_id,student_id,indicator_id" },
          );
          if (evalErr) throw evalErr;
        }
      }

      // XP — registrado uma única vez por execução (regravado se a nota mudar)
      if (input.decision === "evaluated" && input.run.student_id) {
        const del = await supabase
          .from("gam_xp_events")
          .delete()
          .eq("ref_kind", "builder_run")
          .eq("ref_id", input.run.id);
        if (del.error) throw del.error;
        if ((input.xp ?? 0) > 0) {
          const ins = await supabase.from("gam_xp_events").insert({
            student_id: input.run.student_id,
            group_id: input.run.group_id,
            context: input.run.mission?.template === "cafe" ? "cafe" : "techeduca",
            kind: "individual",
            action_code: "builder_mission_evaluated",
            xp: input.xp,
            status: "approved",
            ref_kind: "builder_run",
            ref_id: input.run.id,
            note: `Avaliação da missão ${input.run.mission?.title ?? ""}`,
          } as never);
          if (ins.error) throw ins.error;
        }
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mission-submissions"] });
      void qc.invalidateQueries({ queryKey: ["gam"] });
      void qc.invalidateQueries({ queryKey: ["builder-participation"] });
    },
  });
}

/** Perguntas/respostas do envio, na ordem dos blocos da missão. */
export function answerSummary(sections: Section[], answers: Record<string, Record<string, string>>) {
  const out: { section: Section; pairs: { label: string; value: string }[] }[] = [];
  for (const s of sections ?? []) {
    const values = answers?.[s.id] ?? {};
    const pairs = Object.entries(values)
      .filter(([, v]) => (v ?? "").toString().trim())
      .map(([k, v]) => {
        const item = ((s.items ?? []) as { key?: string; label?: string }[]).find((i) => i.key === k);
        return { label: item?.label ?? k, value: v };
      });
    if (pairs.length) out.push({ section: s, pairs });
  }
  return out;
}
