import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ucSituation,
  type EvaluationRow,
  type IndicatorRow,
  type UcResult,
  type UcSituation,
} from "@/lib/assessment";

/* ==================================================================== */
/* Relatório de Fechamento da UC10 — SOMENTE LEITURA                     */
/* Reúne matriz I1–I6, etapas, histórico, feedbacks, recuperação,        */
/* resultado D/ND, origem das menções e XP/badges (informativos).        */
/* ==================================================================== */

export type ClosureIndicator = {
  code: string;
  description: string;
  concept: string | null;
  stage: string;
  notes: string;
  evaluatedAt: string | null;
  /** missões que originaram menções para este indicador */
  origins: { mission: string; concept: string; at: string }[];
  history: { stage: string; concept: string | null; notes: string; at: string }[];
};

export type ClosureStudent = {
  id: string;
  name: string;
  email: string;
  situation: UcSituation;
  result: UcResult | null;
  indicators: ClosureIndicator[];
  feedbacks: { message: string; at: string; indicator: string | null }[];
  recovery: { title: string; description: string; status: string; indicators: string[]; at: string }[];
  xpTotal: number;
  xpPending: number;
  badges: { name: string; at: string }[];
};

export type ClosureReport = {
  className: string;
  generatedAt: string;
  indicators: IndicatorRow[];
  students: ClosureStudent[];
  summary: {
    total: number;
    notEvaluated: number;
    inProgress: number;
    finalOpen: number;
    needsRecovery: number;
    inRecovery: number;
    readyToClose: number;
    d: number;
    nd: number;
  };
};

export function useClosureReport(classId: string | null) {
  return useQuery({
    queryKey: ["closure-report", classId],
    enabled: !!classId,
    queryFn: async (): Promise<ClosureReport | null> => {
      const [clsRes, indRes, enrRes] = await Promise.all([
        supabase.from("classes").select("name, code").eq("id", classId!).maybeSingle(),
        supabase.from("indicators").select("*").eq("uc_code", "UC10").order("position"),
        supabase.from("enrollments").select("student_id").eq("class_id", classId!),
      ]);
      if (clsRes.error) throw clsRes.error;
      if (indRes.error) throw indRes.error;
      if (enrRes.error) throw enrRes.error;

      const cls = clsRes.data as { name: string; code: string | null } | null;
      const className = cls ? (cls.code ? `${cls.name} (${cls.code})` : cls.name) : "—";
      const indicators = (indRes.data ?? []) as unknown as IndicatorRow[];
      const studentIds = (enrRes.data ?? []).map((e) => (e as { student_id: string }).student_id);
      if (!studentIds.length)
        return {
          className,
          generatedAt: new Date().toISOString(),
          indicators,
          students: [],
          summary: {
            total: 0,
            notEvaluated: 0,
            inProgress: 0,
            finalOpen: 0,
            needsRecovery: 0,
            inRecovery: 0,
            readyToClose: 0,
            d: 0,
            nd: 0,
          },
        };

      const [profRes, evalRes, histRes, fbRes, recRes, ucRes, xpRes, badgeRes, originRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").in("id", studentIds),
        supabase.from("indicator_evaluations").select("*").eq("class_id", classId!),
        supabase
          .from("eval_history")
          .select("student_id, indicator_id, stage, concept, notes, created_at")
          .in("student_id", studentIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("eval_feedbacks")
          .select("student_id, indicator_id, message, created_at")
          .eq("class_id", classId!)
          .order("created_at", { ascending: false }),
        supabase.from("recovery_plans").select("*").eq("class_id", classId!),
        supabase.from("uc_results").select("*").eq("class_id", classId!),
        supabase.from("gam_xp_events").select("student_id, xp, status").in("student_id", studentIds),
        supabase
          .from("gam_student_badges")
          .select("student_id, awarded_at, badge:gam_badges(name)")
          .in("student_id", studentIds),
        supabase
          .from("builder_run_evaluations")
          .select("target_student_ids, indicator_finals, member_overrides, created_at, is_current, mission:builder_missions(title)")
          .eq("is_current", true),
      ]);
      for (const r of [profRes, evalRes, histRes, fbRes, recRes, ucRes, xpRes, badgeRes, originRes])
        if (r.error) throw r.error;

      const profiles = (profRes.data ?? []) as { id: string; full_name: string | null; email: string }[];
      const evaluations = (evalRes.data ?? []) as unknown as EvaluationRow[];
      const history = (histRes.data ?? []) as {
        student_id: string;
        indicator_id: string;
        stage: string;
        concept: string | null;
        notes: string;
        created_at: string;
      }[];
      const feedbacks = (fbRes.data ?? []) as {
        student_id: string;
        indicator_id: string | null;
        message: string;
        created_at: string;
      }[];
      const plans = (recRes.data ?? []) as unknown as {
        student_id: string;
        title: string;
        description: string;
        status: string;
        indicator_ids: string[];
        created_at: string;
      }[];
      const results = (ucRes.data ?? []) as unknown as UcResult[];
      const xpEvents = (xpRes.data ?? []) as { student_id: string | null; xp: number; status: string }[];
      const badges = (badgeRes.data ?? []) as unknown as {
        student_id: string;
        awarded_at: string;
        badge: { name: string } | null;
      }[];
      const origins = (originRes.data ?? []) as unknown as {
        target_student_ids: string[];
        indicator_finals: Record<string, string>;
        member_overrides: Record<string, Record<string, string>> | null;
        created_at: string;
        mission: { title: string } | null;
      }[];

      const codeById = new Map(indicators.map((i) => [i.id, i.code] as const));

      const students: ClosureStudent[] = profiles
        .map((p) => {
          const mine = evaluations.filter((e) => e.student_id === p.id);
          const byIndicator = new Map(mine.map((e) => [e.indicator_id, e] as const));
          const result = results.find((r) => r.student_id === p.id) ?? null;
          const situation = ucSituation(indicators, byIndicator, result ?? undefined);

          const indicatorRows: ClosureIndicator[] = indicators.map((i) => {
            const row = byIndicator.get(i.id);
            const myOrigins = origins
              .filter((o) => (o.target_student_ids ?? []).includes(p.id))
              .map((o) => {
                const override = o.member_overrides?.[p.id]?.[i.code];
                const concept = override ?? o.indicator_finals?.[i.code];
                return concept
                  ? { mission: o.mission?.title ?? "Missão", concept, at: o.created_at }
                  : null;
              })
              .filter(Boolean) as ClosureIndicator["origins"];
            return {
              code: i.code,
              description: i.description,
              concept: row?.concept ?? null,
              stage: row?.stage ?? "regular",
              notes: row?.notes ?? "",
              evaluatedAt: row?.evaluated_at ?? null,
              origins: myOrigins,
              history: history
                .filter((h) => h.student_id === p.id && h.indicator_id === i.id)
                .map((h) => ({ stage: h.stage, concept: h.concept, notes: h.notes ?? "", at: h.created_at })),
            };
          });

          const myXp = xpEvents.filter((e) => e.student_id === p.id);
          return {
            id: p.id,
            name: (p.full_name || "").trim() || p.email,
            email: p.email,
            situation,
            result,
            indicators: indicatorRows,
            feedbacks: feedbacks
              .filter((f) => f.student_id === p.id)
              .map((f) => ({
                message: f.message,
                at: f.created_at,
                indicator: f.indicator_id ? (codeById.get(f.indicator_id) ?? null) : null,
              })),
            recovery: plans
              .filter((r) => r.student_id === p.id)
              .map((r) => ({
                title: r.title,
                description: r.description,
                status: r.status,
                indicators: (r.indicator_ids ?? []).map((id) => codeById.get(id) ?? "—"),
                at: r.created_at,
              })),
            xpTotal: myXp.filter((e) => e.status === "approved").reduce((s, e) => s + (e.xp ?? 0), 0),
            xpPending: myXp.filter((e) => e.status === "pending").reduce((s, e) => s + (e.xp ?? 0), 0),
            badges: badges
              .filter((b) => b.student_id === p.id)
              .map((b) => ({ name: b.badge?.name ?? "Badge", at: b.awarded_at })),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const count = (key: string) => students.filter((s) => s.situation.key === key).length;
      return {
        className,
        generatedAt: new Date().toISOString(),
        indicators,
        students,
        summary: {
          total: students.length,
          notEvaluated: count("not_evaluated"),
          inProgress: count("in_progress"),
          finalOpen: count("final_open"),
          needsRecovery: count("needs_recovery"),
          inRecovery: count("in_recovery"),
          readyToClose: count("ready_d") + count("ready_nd"),
          d: count("D"),
          nd: count("ND"),
        },
      };
    },
  });
}
