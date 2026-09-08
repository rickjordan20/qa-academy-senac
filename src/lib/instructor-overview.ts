import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ucSituation,
  nextAction,
  type EvaluationRow,
  type IndicatorRow,
  type NextAction,
  type RecoveryPlan,
  type StudentInfo,
  type UcResult,
  type UcSituation,
  EVALUATION_ACK_VERSION,
} from "@/lib/assessment";
type EvalRowX = EvaluationRow & { invalidated_at?: string | null };

import { temporalStatus } from "@/lib/mission-schedule";
import type { SubmissionRow } from "@/lib/mission-submissions";

/* ==================================================================== */
/* Visão geral do instrutor — SOMENTE LEITURA.                          */
/* Nenhuma regra pedagógica nova: reaproveita ucSituation()/nextAction() */
/* ==================================================================== */

export type RiskCode =
  | "needs_recovery"
  | "in_recovery"
  | "no_delivery"
  | "overdue"
  | "few_evaluated"
  | "no_participation"
  | "no_ack";

export type RiskFlag = { code: RiskCode; label: string; weight: number };

export type RiskInput = {
  situation: UcSituation;
  evaluatedCount: number;
  totalIndicators: number;
  deliveries: number;
  overdueMissing: number;
  openMissions: number;
  inGroup: boolean;
  contributions: number;
  contributionsTracked: boolean;
  acknowledged: boolean;
};

/** Regra pura de risco — testável e auditável. */
export function riskFlags(input: RiskInput): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (input.situation.key === "needs_recovery")
    flags.push({
      code: "needs_recovery",
      label: `Precisa de Recuperação Final (${input.situation.pending.map((p) => p.code).join(", ")})`,
      weight: 100,
    });
  else if (input.situation.key === "in_recovery")
    flags.push({
      code: "in_recovery",
      label: `Em Recuperação Final (${input.situation.pending.map((p) => p.code).join(", ")})`,
      weight: 80,
    });

  if (input.overdueMissing > 0)
    flags.push({
      code: "overdue",
      label: `${input.overdueMissing} missão(ões) com prazo vencido sem entrega`,
      weight: 70,
    });

  if (input.deliveries === 0 && input.openMissions > 0)
    flags.push({ code: "no_delivery", label: "Nenhuma entrega registrada", weight: 60 });

  if (
    input.totalIndicators > 0 &&
    input.evaluatedCount < Math.ceil(input.totalIndicators / 2) &&
    input.situation.key !== "D" &&
    input.situation.key !== "ND"
  )
    flags.push({
      code: "few_evaluated",
      label: `Apenas ${input.evaluatedCount} de ${input.totalIndicators} indicadores avaliados`,
      weight: 40,
    });

  if (input.inGroup && input.contributionsTracked && input.contributions === 0)
    flags.push({ code: "no_participation", label: "Sem participação registrada no Café Central", weight: 50 });

  if (!input.acknowledged)
    flags.push({ code: "no_ack", label: "Ainda não deu ciência de como será avaliado", weight: 10 });

  return flags.sort((a, b) => b.weight - a.weight);
}

export function riskScore(flags: RiskFlag[]) {
  return flags.reduce((n, f) => n + f.weight, 0);
}

/* ------------------------------- dados ------------------------------ */

type ClassLite = { id: string; name: string };

export type OverviewStudent = {
  student: StudentInfo;
  classId: string;
  className: string;
  situation: UcSituation;
  evaluatedCount: number;
  deliveries: number;
  awaiting: number;
  reeval: number;
  overdueMissing: number;
  contributions: number;
  inGroup: boolean;
  acknowledged: boolean;
  flags: RiskFlag[];
  score: number;
  next: NextAction;
};

export type MissionProgress = {
  id: string;
  title: string;
  dueAt: string | null;
  temporal: string;
  expected: number;
  delivered: number;
};

export type InstructorOverview = {
  classes: ClassLite[];
  students: OverviewStudent[];
  evaluations: EvaluationRow[];
  results: UcResult[];
  recoveries: RecoveryPlan[];
  missions: MissionProgress[];
  totals: {
    students: number;
    groups: number;
    awaiting: number;
    revision: number;
    reeval: number;
    noDelivery: number;
    readyToConfirm: number;
  };
};

/**
 * Carrega, apenas com SELECT, tudo o que o painel precisa.
 * classIds = turmas do instrutor já filtradas na tela.
 */
export function useInstructorOverview(
  classIds: string[],
  indicators: IndicatorRow[] | undefined,
  submissions: SubmissionRow[] | undefined,
) {
  const key = [...classIds].sort().join(",");
  return useQuery({
    queryKey: ["instructor-overview", key, indicators?.length ?? 0, submissions?.length ?? 0],
    enabled: classIds.length > 0 && !!indicators && !!submissions,
    queryFn: async (): Promise<InstructorOverview> => {
      const inds = indicators ?? [];
      const runs = (submissions ?? []).filter((r) => !r.classId || classIds.includes(r.classId));

      const [classesRes, enrollRes, evalRes, resultRes, recRes, groupRes, memberRes, assignRes] =
        await Promise.all([
          supabase.from("classes").select("id, name").in("id", classIds),
          supabase.from("enrollments").select("class_id, student_id").in("class_id", classIds),
          supabase.from("indicator_evaluations").select("*").in("class_id", classIds),
          supabase.from("uc_results").select("*").in("class_id", classIds),
          supabase.from("recovery_plans").select("*").in("class_id", classIds),
          supabase.from("groups").select("id, name, class_id").in("class_id", classIds),
          supabase.from("group_members").select("group_id, student_id"),
          supabase.from("builder_mission_assignments").select("mission_id, class_id").in("class_id", classIds),
        ]);
      for (const r of [classesRes, enrollRes, evalRes, resultRes, recRes, groupRes, memberRes, assignRes])
        if (r.error) throw r.error;

      const classes = (classesRes.data ?? []) as ClassLite[];
      const enrollments = (enrollRes.data ?? []) as { class_id: string; student_id: string }[];
      const studentIds = [...new Set(enrollments.map((e) => e.student_id))];

      const [profRes, ackRes, contribRes] = await Promise.all([
        studentIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", studentIds)
          : Promise.resolve({ data: [], error: null } as never),
        supabase
          .from("evaluation_acknowledgments")
          .select("student_id, content_version")
          .eq("content_version", EVALUATION_ACK_VERSION),
        supabase.from("cafe_contributions").select("student_id"),
      ]);
      if (profRes.error) throw profRes.error;
      if (ackRes.error) throw ackRes.error;

      const profiles = new Map(
        ((profRes.data ?? []) as StudentInfo[]).map((p) => [p.id, p]),
      );
      const ackSet = new Set(((ackRes.data ?? []) as { student_id: string }[]).map((a) => a.student_id));
      const contribList = (contribRes.data ?? []) as { student_id: string }[];
      const contributionsTracked = contribList.length > 0;
      const contribCount = new Map<string, number>();
      for (const c of contribList) contribCount.set(c.student_id, (contribCount.get(c.student_id) ?? 0) + 1);

      const evaluations = (evalRes.data ?? []) as EvaluationRow[];
      const results = (resultRes.data ?? []) as UcResult[];
      const recoveries = (recRes.data ?? []) as RecoveryPlan[];
      const groups = (groupRes.data ?? []) as { id: string; name: string; class_id: string }[];
      const groupIds = new Set(groups.map((g) => g.id));
      const members = ((memberRes.data ?? []) as { group_id: string; student_id: string }[]).filter((m) =>
        groupIds.has(m.group_id),
      );
      const groupsOfStudent = new Map<string, string[]>();
      for (const m of members) {
        const arr = groupsOfStudent.get(m.student_id) ?? [];
        arr.push(m.group_id);
        groupsOfStudent.set(m.student_id, arr);
      }
      const assignments = (assignRes.data ?? []) as { mission_id: string; class_id: string }[];
      const missionsOfClass = new Map<string, string[]>();
      for (const a of assignments) {
        const arr = missionsOfClass.get(a.class_id) ?? [];
        arr.push(a.mission_id);
        missionsOfClass.set(a.class_id, arr);
      }

      /* ------- entregas por aluno (individuais + do grupo) ------- */
      const delivered = (r: SubmissionRow) => !!r.submitted_at || r.eval_status !== "none";
      const runsOfStudent = (studentId: string) => {
        const gids = groupsOfStudent.get(studentId) ?? [];
        return runs.filter(
          (r) => r.student_id === studentId || (r.group_id && gids.includes(r.group_id)),
        );
      };

      /* ------- missões com prazo, para progresso e atraso ------- */
      const missionInfo = new Map<string, SubmissionRow["mission"]>();
      for (const r of runs) if (r.mission) missionInfo.set(r.mission.id, r.mission);
      const allMissionIds = new Set<string>([...missionInfo.keys(), ...assignments.map((a) => a.mission_id)]);
      const missingIds = [...allMissionIds].filter((id) => !missionInfo.has(id));
      if (missingIds.length) {
        const { data } = await supabase
          .from("builder_missions")
          .select("id, title, due_at, opens_at, status, template")
          .in("id", missingIds);
        for (const m of (data ?? []) as Record<string, unknown>[])
          missionInfo.set(m["id"] as string, m as unknown as SubmissionRow["mission"]);
      }

      const students: OverviewStudent[] = enrollments.map((e) => {
        const profile =
          profiles.get(e.student_id) ?? ({ id: e.student_id, full_name: "", email: "" } as StudentInfo);
        const byIndicator = new Map<string, EvaluationRow>();
        for (const ev of evaluations)
          if (ev.student_id === e.student_id && ev.class_id === e.class_id && !(ev as EvalRowX).invalidated_at)
            byIndicator.set(ev.indicator_id, ev);
        const result = results.find((r) => r.student_id === e.student_id && r.class_id === e.class_id);
        const situation = ucSituation(inds, byIndicator, result);
        const evaluatedCount = inds.filter((i) => byIndicator.get(i.id)?.concept).length;

        const myRuns = runsOfStudent(e.student_id);
        const deliveries = myRuns.filter(delivered).length;
        const awaiting = myRuns.filter((r) => r.eval_status === "awaiting").length;
        const reeval = myRuns.filter((r) => r.eval_status === "reeval").length;

        const classMissions = missionsOfClass.get(e.class_id) ?? [];
        let openMissions = 0;
        let overdueMissing = 0;
        for (const mid of classMissions) {
          const m = missionInfo.get(mid);
          if (!m || m.status !== "published") continue;
          const t = temporalStatus(m);
          if (t.key === "scheduled") continue;
          openMissions += 1;
          const has = myRuns.some((r) => r.mission_id === mid && delivered(r));
          if (!has && t.key === "overdue") overdueMissing += 1;
        }

        const gids = groupsOfStudent.get(e.student_id) ?? [];
        const flags = riskFlags({
          situation,
          evaluatedCount,
          totalIndicators: inds.length,
          deliveries,
          overdueMissing,
          openMissions,
          inGroup: gids.length > 0,
          contributions: contribCount.get(e.student_id) ?? 0,
          contributionsTracked,
          acknowledged: ackSet.has(e.student_id),
        });

        return {
          student: profile,
          classId: e.class_id,
          className: classes.find((c) => c.id === e.class_id)?.name ?? "",
          situation,
          evaluatedCount,
          deliveries,
          awaiting,
          reeval,
          overdueMissing,
          contributions: contribCount.get(e.student_id) ?? 0,
          inGroup: gids.length > 0,
          acknowledged: ackSet.has(e.student_id),
          flags,
          score: riskScore(flags),
          next: nextAction(situation, { awaiting, reeval }),
        };
      });

      /* --------------------- progresso das missões --------------------- */
      const missions: MissionProgress[] = [];
      for (const [mid, m] of missionInfo) {
        if (!m || m.status !== "published") continue;
        const t = temporalStatus(m);
        if (t.key === "scheduled") continue;
        const expected = students.filter((s) => (missionsOfClass.get(s.classId) ?? []).includes(mid)).length;
        const deliveredCount = students.filter((s) =>
          runsOfStudent(s.student.id).some((r) => r.mission_id === mid && delivered(r)),
        ).length;
        missions.push({
          id: mid,
          title: m.title,
          dueAt: m.due_at ?? null,
          temporal: t.key,
          expected,
          delivered: deliveredCount,
        });
      }
      missions.sort((a, b) => {
        const rank = (x: MissionProgress) => (x.temporal === "overdue" ? 0 : 1);
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        return (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999");
      });

      const totals = {
        students: students.length,
        groups: groups.length,
        awaiting: runs.filter((r) => r.eval_status === "awaiting").length,
        revision: runs.filter((r) => r.eval_status === "revision").length,
        reeval: runs.filter((r) => r.eval_status === "reeval").length,
        noDelivery: students.filter((s) => s.deliveries === 0).length,
        readyToConfirm: students.filter((s) => s.situation.key === "ready_d" || s.situation.key === "ready_nd")
          .length,
      };

      return { classes, students, evaluations, results, recoveries, missions: missions.slice(0, 8), totals };
    },
  });
}

/** Distribuição A/PA/NA/não avaliado por indicador, considerando os alunos da visão. */
export function indicatorBreakdown(
  indicators: IndicatorRow[],
  evaluations: EvaluationRow[],
  students: OverviewStudent[],
) {
  const ids = new Set(students.map((s) => `${s.classId}:${s.student.id}`));
  return indicators.map((ind) => {
    const rows = evaluations.filter(
      (e) => e.indicator_id === ind.id && !(e as EvalRowX).invalidated_at && ids.has(`${e.class_id}:${e.student_id}`),
    );
    const count = (c: string) => rows.filter((r) => r.concept === c).length;
    const a = count("A");
    const pa = count("PA");
    const na = count("NA");
    return { ind, a, pa, na, none: Math.max(students.length - (a + pa + na), 0), total: students.length };
  });
}

export const SITUATION_ORDER: { key: string; label: string; tone: string }[] = [
  { key: "not_evaluated", label: "Não avaliados", tone: "bg-secondary text-muted-foreground" },
  { key: "in_progress", label: "Em andamento", tone: "bg-accent/15 text-accent" },
  { key: "final_open", label: "Avaliação Final aberta", tone: "bg-accent/15 text-accent" },
  { key: "needs_recovery", label: "Necessitam recuperação", tone: "bg-danger/15 text-danger" },
  { key: "in_recovery", label: "Em recuperação", tone: "bg-warning/15 text-warning" },
  { key: "ready_d", label: "Prontos para D", tone: "bg-success/15 text-success" },
  { key: "ready_nd", label: "Prontos para ND", tone: "bg-warning/15 text-warning" },
  { key: "D", label: "D confirmado", tone: "bg-success text-success-foreground" },
  { key: "ND", label: "ND confirmado", tone: "bg-danger text-danger-foreground" },
];
