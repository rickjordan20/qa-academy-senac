import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Níveis                                                              */
/* ------------------------------------------------------------------ */

export type Level = { name: string; min: number };

export const LEVELS: Level[] = [
  { name: "QA Rookie", min: 0 },
  { name: "Bug Hunter", min: 100 },
  { name: "Test Explorer", min: 250 },
  { name: "QA Analyst", min: 500 },
  { name: "QA Specialist", min: 900 },
  { name: "QA Master", min: 1500 },
];

export function levelFor(xp: number) {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]!.min) index = i;
  const current = LEVELS[index]!;
  const next = LEVELS[index + 1] ?? null;
  const span = next ? next.min - current.min : 0;
  const progress = next ? Math.round(((xp - current.min) / span) * 100) : 100;
  return { current, next, progress, remaining: next ? next.min - xp : 0 };
}

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export type GamAction = {
  code: string;
  label: string;
  description: string;
  xp: number;
  kind: string;
  context: string;
  requires_validation: boolean;
  enabled: boolean;
  position: number;
};

export type XpEvent = {
  id: string;
  student_id: string | null;
  group_id: string | null;
  context: string;
  kind: string;
  action_code: string;
  xp: number;
  status: string;
  ref_kind: string | null;
  ref_id: string | null;
  note: string;
  created_at: string;
};

export type BadgeMetric =
  | "evidences"
  | "bugs"
  | "executions"
  | "cases"
  | "retests"
  | "uxBugs"
  | "severeBugs"
  | "contributions"
  | "isQaLead";

export const BADGE_METRICS: { value: BadgeMetric; label: string }[] = [
  { value: "evidences", label: "Evidências registradas" },
  { value: "bugs", label: "Bugs registrados" },
  { value: "executions", label: "Execuções de teste" },
  { value: "cases", label: "Casos de teste criados" },
  { value: "retests", label: "Retestes realizados" },
  { value: "uxBugs", label: "Bugs de UX" },
  { value: "severeBugs", label: "Bugs de severidade alta/crítica" },
  { value: "contributions", label: "Contribuições no grupo" },
  { value: "isQaLead", label: "É QA Líder (1 = sim)" },
];

export const BADGE_OPERATORS = [">=", ">", "=", "<=", "<"] as const;
export type BadgeOperator = (typeof BADGE_OPERATORS)[number];

export type BadgeCondition = { metric: BadgeMetric; op: BadgeOperator; value: number };
export type BadgeRuleConfig = { all: BadgeCondition[] };

export type Badge = {
  code: string;
  name: string;
  description: string;
  icon: string;
  criteria: string;
  position: number;
  enabled: boolean;
  rule_config: BadgeRuleConfig;
  updated_at?: string;
};

export function normalizeRule(raw: unknown): BadgeRuleConfig {
  const all = (raw as { all?: unknown })?.all;
  if (!Array.isArray(all)) return { all: [] };
  return {
    all: all
      .map((c) => c as Partial<BadgeCondition>)
      .filter((c) => !!c && !!c.metric)
      .map((c) => ({
        metric: c.metric as BadgeMetric,
        op: (BADGE_OPERATORS as readonly string[]).includes(String(c.op)) ? (c.op as BadgeOperator) : ">=",
        value: Number(c.value) || 0,
      })),
  };
}

export function describeRule(rule: BadgeRuleConfig): string {
  if (rule.all.length === 0) return "Sem regra automática configurada";
  return rule.all
    .map((c) => `${BADGE_METRICS.find((m) => m.value === c.metric)?.label ?? c.metric} ${c.op} ${c.value}`)
    .join(" e ");
}


export type GamSettings = {
  id: boolean;
  ranking_individual_enabled: boolean;
  ranking_teams_enabled: boolean;
};

/* ------------------------------------------------------------------ */
/* Configuração                                                        */
/* ------------------------------------------------------------------ */

export function useGamActions() {
  return useQuery({
    queryKey: ["gam", "actions"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("gam_actions").select("*").order("position");
      if (error) throw error;
      return (data ?? []) as GamAction[];
    },
  });
}

export function useUpdateGamAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, patch }: { code: string; patch: Partial<GamAction> }) => {
      const { error } = await supabase.from("gam_actions").update(patch as never).eq("code", code);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gam"] }),
  });
}

export function useGamSettings() {
  return useQuery({
    queryKey: ["gam", "settings"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("gam_settings").select("*").maybeSingle();
      if (error) throw error;
      return (data ?? null) as GamSettings | null;
    },
  });
}

export function useUpdateGamSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<GamSettings>) => {
      const { error } = await supabase
        .from("gam_settings")
        .update(patch as never)
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gam"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export function useBadgeCatalog() {
  return useQuery({
    queryKey: ["gam", "badges"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("gam_badges").select("*").order("position");
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map(
        (b) => ({ ...b, rule_config: normalizeRule(b["rule_config"]) }) as Badge,
      );

    },
  });
}

export function useMyBadges(userId: string | null) {
  return useQuery({
    queryKey: ["gam", "my-badges", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gam_student_badges")
        .select("badge_code, awarded_at")
        .eq("student_id", userId!);
      if (error) throw error;
      return (data ?? []) as { badge_code: string; awarded_at: string }[];
    },
  });
}

/** Instrutor: edita apenas os textos descritivos, a posição e o status do badge. */
export function useUpdateBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, patch }: { code: string; patch: Partial<Badge> }) => {
      const { error } = await supabase.from("gam_badges").update(patch as never).eq("code", code);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gam"] }),
  });
}

/** Instrutor: cria um novo badge com regra automática. */
export function useCreateBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (badge: {
      code: string;
      name: string;
      description: string;
      icon: string;
      criteria: string;
      position: number;
      rule_config: BadgeRuleConfig;
    }) => {
      const { error } = await supabase.from("gam_badges").insert(badge as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gam"] }),
  });
}

/** Instrutor: exclui um badge do catálogo. */
export function useDeleteBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.from("gam_badges").delete().eq("code", code);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gam"] }),
  });
}



export type BadgeAward = { badge_code: string; awarded_at: string; student_id: string; name: string };

/** Instrutor: todas as conquistas visíveis (RLS limita aos alunos das suas turmas). */
export function useBadgeAwards() {
  return useQuery({
    queryKey: ["gam", "badge-awards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gam_student_badges")
        .select("badge_code, awarded_at, student_id")
        .order("awarded_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as { badge_code: string; awarded_at: string; student_id: string }[];
      const ids = Array.from(new Set(rows.map((r) => r.student_id)));
      let names = new Map<string, string>();
      if (ids.length > 0) {
        const prof = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
        names = new Map(
          ((prof.data ?? []) as { id: string; full_name: string; email: string }[]).map((p) => [
            p.id,
            p.full_name?.trim() || p.email,
          ]),
        );
      }
      return rows.map((r) => ({ ...r, name: names.get(r.student_id) ?? r.student_id })) as BadgeAward[];
    },
  });
}

/** Missões que declaram um badge relacionado. */
export function useMissionsByBadge() {
  return useQuery({
    queryKey: ["gam", "badge-missions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("builder_missions")
        .select("id, title, badge_code")
        .not("badge_code", "is", null);
      if (error) throw error;
      return (data ?? []) as { id: string; title: string; badge_code: string }[];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Eventos de XP                                                       */
/* ------------------------------------------------------------------ */

export function useMyXpEvents(userId: string | null) {
  return useQuery({
    queryKey: ["gam", "xp", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gam_xp_events")
        .select("*")
        .eq("student_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as XpEvent[];
    },
  });
}

export function useGroupXpEvents(groupIds: string[]) {
  const ids = Array.from(new Set(groupIds)).sort();
  return useQuery({
    queryKey: ["gam", "group-xp", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gam_xp_events")
        .select("*")
        .in("group_id", ids)
        .eq("kind", "collective")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as XpEvent[];
    },
  });
}

export function sumXp(events: XpEvent[] | undefined, filter: (e: XpEvent) => boolean) {
  return (events ?? []).filter((e) => e.status === "approved" && filter(e)).reduce((s, e) => s + e.xp, 0);
}

export function pendingXp(events: XpEvent[] | undefined, filter: (e: XpEvent) => boolean = () => true) {
  return (events ?? []).filter((e) => e.status === "pending" && filter(e)).reduce((s, e) => s + e.xp, 0);
}

/* Instrutor: fila de validação */
export function usePendingXpQueue() {
  return useQuery({
    queryKey: ["gam", "pending-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gam_xp_events")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as XpEvent[];
    },
  });
}

export function useReviewXpEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("gam_xp_events").update({ status } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gam"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Ranking                                                             */
/* ------------------------------------------------------------------ */

export function useIndividualRanking(enabled: boolean) {
  return useQuery({
    queryKey: ["gam", "ranking", "individual"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gam_ranking_individual");
      if (error) throw error;
      return (data ?? []) as { student_id: string; full_name: string; xp: number }[];
    },
  });
}

export function useTeamRanking(enabled: boolean) {
  return useQuery({
    queryKey: ["gam", "ranking", "teams"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gam_ranking_teams");
      if (error) throw error;
      return (data ?? []) as { group_id: string; group_name: string; xp: number }[];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Sincronização de XP e badges                                        */
/* ------------------------------------------------------------------ */

type NewEvent = {
  student_id?: string;
  group_id?: string;
  context: string;
  action_code: string;
  ref_kind: string;
  ref_id: string;
  note?: string;
};

export type GamStats = {
  missions: number;
  cases: number;
  executions: number;
  bugs: number;
  uxBugs: number;
  severeBugs: number;
  evidences: number;
  retests: number;
  contributions: number;
  isQaLead: boolean;
};

async function collect(userId: string) {
  // Fonte real dos registros: missões do construtor (TechEduca e Café Central).
  // As tabelas antigas continuam sendo lidas para não perder histórico anterior.
  const [runs, entries, cases, bugs, qaEv, teEv, retests, contribs, leadGroups] = await Promise.all([
    supabase.from("builder_mission_runs").select("id, mission_id, status, answers").eq("student_id", userId),
    supabase
      .from("builder_mission_entries")
      .select("id, kind, title, mission_id, data")
      .eq("author_id", userId),
    supabase.from("qa_test_cases").select("id, context, executed_at").eq("author_id", userId),
    supabase.from("qa_bugs").select("id, context, severity, title, description").eq("author_id", userId),
    supabase.from("qa_evidences").select("id, context").eq("author_id", userId),
    supabase.from("techeduca_evidences").select("id").eq("student_id", userId),
    supabase.from("qa_retests").select("id, bug_id").eq("tester_id", userId),
    supabase.from("cafe_contributions").select("id, group_id").eq("student_id", userId),
    supabase.from("groups").select("id, name").eq("qa_lead_id", userId),
  ]);

  const runRows = (runs.data ?? []) as {
    id: string;
    mission_id: string;
    status: string;
    answers: unknown;
  }[];
  const entryRows = (entries.data ?? []) as {
    id: string;
    kind: string;
    title: string;
    mission_id: string;
    data: Record<string, unknown> | null;
  }[];

  const missionIds = [...new Set([...runRows.map((r) => r.mission_id), ...entryRows.map((e) => e.mission_id)])];
  const templates = new Map<string, string>();
  if (missionIds.length) {
    const { data } = await supabase.from("builder_missions").select("id, template").in("id", missionIds);
    for (const m of (data ?? []) as { id: string; template: string }[]) templates.set(m.id, m.template);
  }
  const ctxOf = (missionId: string) => (templates.get(missionId) === "cafe" ? "cafe" : "techeduca");

  const events: NewEvent[] = [];

  const doneStatus = ["concluida", "concluída", "completed", "submitted", "enviada", "evaluated", "avaliada"];
  for (const r of runRows) {
    const ctx = ctxOf(r.mission_id);
    if (doneStatus.includes(r.status)) {
      events.push({ student_id: userId, context: ctx, action_code: "mission_completed", ref_kind: "mission_run", ref_id: r.id });
    }
    const answers = (r.answers ?? {}) as Record<string, unknown>;
    const answerKeys = Object.keys(answers);
    if (answerKeys.length > 0) {
      events.push({ student_id: userId, context: ctx, action_code: "checkpoint_done", ref_kind: "mission_run", ref_id: r.id });
    }
    const hasReflection = answerKeys.some(
      (k) => /reflex/i.test(k) && String(answers[k] ?? "").trim().length > 0,
    );
    if (hasReflection) {
      events.push({ student_id: userId, context: ctx, action_code: "reflection_done", ref_kind: "mission_run", ref_id: r.id });
    }
  }

  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const entryCases = entryRows.filter((e) => e.kind === "test_case");
  const entryExecs = entryRows.filter((e) => e.kind === "execution");
  const entryBugs = entryRows.filter((e) => e.kind === "bug");
  const entryEvidences = entryRows.filter((e) => e.kind === "evidence");

  for (const c of entryCases)
    events.push({
      student_id: userId,
      context: ctxOf(c.mission_id),
      action_code: "test_case_created",
      ref_kind: "test_case",
      ref_id: c.id,
    });
  for (const x of entryExecs)
    events.push({
      student_id: userId,
      context: ctxOf(x.mission_id),
      action_code: "test_execution",
      ref_kind: "test_case",
      ref_id: x.id,
    });
  for (const b of entryBugs)
    events.push({
      student_id: userId,
      context: ctxOf(b.mission_id),
      action_code: "bug_confirmed",
      ref_kind: "bug",
      ref_id: b.id,
      note: b.title,
    });
  for (const e of entryEvidences)
    events.push({
      student_id: userId,
      context: ctxOf(e.mission_id),
      action_code: "evidence_added",
      ref_kind: "evidence",
      ref_id: e.id,
    });

  const caseRows = (cases.data ?? []) as { id: string; context: string; executed_at: string | null }[];
  for (const c of caseRows) {
    events.push({ student_id: userId, context: c.context, action_code: "test_case_created", ref_kind: "test_case", ref_id: c.id });
    if (c.executed_at) {
      events.push({ student_id: userId, context: c.context, action_code: "test_execution", ref_kind: "test_case", ref_id: c.id });
    }
  }

  const bugRows = (bugs.data ?? []) as { id: string; context: string; severity: string; title: string; description: string }[];
  for (const b of bugRows) {
    events.push({ student_id: userId, context: b.context, action_code: "bug_confirmed", ref_kind: "bug", ref_id: b.id, note: b.title });
  }

  const qaEvRows = (qaEv.data ?? []) as { id: string; context: string }[];
  for (const e of qaEvRows) {
    events.push({ student_id: userId, context: e.context, action_code: "evidence_added", ref_kind: "evidence", ref_id: e.id });
  }
  for (const e of (teEv.data ?? []) as { id: string }[]) {
    events.push({ student_id: userId, context: "techeduca", action_code: "evidence_added", ref_kind: "te_evidence", ref_id: e.id });
  }

  const retestRows = (retests.data ?? []) as { id: string }[];
  for (const r of retestRows) {
    events.push({ student_id: userId, context: "techeduca", action_code: "retest_done", ref_kind: "retest", ref_id: r.id });
  }

  const contribRows = (contribs.data ?? []) as { id: string; group_id: string }[];

  const uxWords = ["ux", "usabilidade", "interface", "layout", "design"];
  const severe = ["alta", "critica", "crítica"];
  const bugText = (b: { title: string; data: Record<string, unknown> | null }) =>
    `${b.title} ${str(b.data?.["descricao"])} ${str(b.data?.["titulo"])}`.toLowerCase();

  const stats: GamStats = {
    missions: events.filter((e) => e.action_code === "mission_completed").length,
    cases: caseRows.length + entryCases.length,
    executions: caseRows.filter((c) => c.executed_at).length + entryExecs.length,
    bugs: bugRows.length + entryBugs.length,
    uxBugs:
      bugRows.filter((b) => uxWords.some((w) => `${b.title} ${b.description}`.toLowerCase().includes(w))).length +
      entryBugs.filter((b) => uxWords.some((w) => bugText(b).includes(w))).length,
    severeBugs:
      bugRows.filter((b) => severe.includes(b.severity.toLowerCase())).length +
      entryBugs.filter((b) => severe.includes(str(b.data?.["severidade"]).toLowerCase())).length,
    evidences: qaEvRows.length + ((teEv.data ?? []) as unknown[]).length + entryEvidences.length,
    retests: retestRows.length,
    contributions: contribRows.length,
    isQaLead: ((leadGroups.data ?? []) as unknown[]).length > 0,
  };

  return { events, stats };
}

/** Avalia a regra estruturada do badge contra as estatísticas reais do aluno. */
export function matchesRule(rule: BadgeRuleConfig, stats: GamStats): boolean {
  if (rule.all.length === 0) return false;
  return rule.all.every((c) => {
    const lhs = c.metric === "isQaLead" ? (stats.isQaLead ? 1 : 0) : Number(stats[c.metric] ?? 0);
    switch (c.op) {
      case ">=":
        return lhs >= c.value;
      case ">":
        return lhs > c.value;
      case "=":
        return lhs === c.value;
      case "<=":
        return lhs <= c.value;
      case "<":
        return lhs < c.value;
      default:
        return false;
    }
  });
}

/** Badges conquistados a partir do catálogo ativo (regras configuradas pelo instrutor). */
export function earnedBadges(stats: GamStats, catalog: Badge[]) {
  return catalog.filter((b) => b.enabled && matchesRule(b.rule_config, stats)).map((b) => b.code);
}


/**
 * Recalcula o XP e as badges do aluno a partir dos registros reais.
 * Os eventos já existentes são ignorados pelo índice único (ação + referência),
 * portanto a sincronização é idempotente.
 */
export function useSyncGamification(userId: string | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["gam", "sync", userId],
    enabled: !!userId,
    staleTime: 30 * 1000,
    retry: false,
    queryFn: async () => {
      const { events, stats } = await collect(userId!);

      const existing = await supabase
        .from("gam_xp_events")
        .select("action_code, ref_id")
        .eq("student_id", userId!);
      const seen = new Set(
        ((existing.data ?? []) as { action_code: string; ref_id: string | null }[]).map(
          (e) => `${e.action_code}:${e.ref_id}`,
        ),
      );
      const missing = events.filter((e) => !seen.has(`${e.action_code}:${e.ref_id}`));
      if (missing.length > 0) {
        await supabase.from("gam_xp_events").insert(missing as never);
      }

      // A concessão de badges é feita no servidor (função segura `gam_sync_my_badges`),
      // que reavalia as mesmas regras configuradas (rule_config) e impede que o aluno
      // conceda badges a si mesmo. Aqui só usamos o catálogo para saber se algo mudou.
      const catalogRes = await supabase.from("gam_badges").select("*");
      const catalog = ((catalogRes.data ?? []) as Record<string, unknown>[]).map(
        (b) => ({ ...b, rule_config: normalizeRule(b["rule_config"]) }) as Badge,
      );
      const badges = earnedBadges(stats, catalog);
      await supabase.rpc("gam_sync_my_badges");


      if (missing.length > 0 || badges.length > 0) {
        void qc.invalidateQueries({ queryKey: ["gam", "xp", userId] });
        void qc.invalidateQueries({ queryKey: ["gam", "my-badges", userId] });
      }
      return stats;
    },
  });
}

/** Registra XP coletivo do grupo (QA Lead ou instrutor). */
export function useGrantTeamXp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      groupId,
      actionCode,
      note,
      refId,
    }: {
      groupId: string;
      actionCode: string;
      note?: string;
      refId?: string | null;
    }) => {
      const { error } = await supabase.from("gam_xp_events").insert({
        group_id: groupId,
        context: "cafe",
        kind: "collective",
        action_code: actionCode,
        note: note ?? "",
        ref_kind: "group_run",
        ref_id: refId ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gam"] }),
  });
}

export function actionLabel(actions: GamAction[] | undefined, code: string) {
  return actions?.find((a) => a.code === code)?.label ?? code;
}
