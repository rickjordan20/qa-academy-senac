import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ==================================================================== */
/* Teste cruzado (Dev × Tester) — motor reutilizável por tipo de bloco   */
/* ==================================================================== */

export type CrossPairing = {
  id: string;
  mission_id: string;
  section_id: string;
  class_id: string;
  tester_group_id: string;
  developer_group_id: string;
  created_at: string;
};

export type CrossGroup = {
  id: string;
  name: string;
  class_id: string;
  members: { student_id: string; name: string }[];
};

export type CrossBug = {
  id: string;
  title: string;
  description: string;
  environment: string;
  steps: string;
  expected_result: string;
  obtained_result: string;
  severity: string;
  priority: string;
  status: string;
  author_id: string;
  assignee_id: string | null;
  group_id: string | null;
  developer_group_id: string | null;
  pairing_id: string | null;
  test_case_id: string | null;
  section_id: string | null;
  created_at: string;
};

export type CrossRetest = {
  id: string;
  bug_id: string;
  tester_id: string;
  result: string;
  notes: string;
  tested_at: string;
};

export type CrossEvidence = {
  id: string;
  bug_id: string | null;
  title: string;
  kind: string;
  link: string | null;
  content: string | null;
  author_id: string;
  created_at: string;
};

const rpc = (name: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
    name,
    args,
  );

/* ------------------------------------------------------------------ */
/* Pareamentos                                                         */
/* ------------------------------------------------------------------ */

export function useCrossPairings(missionId: string | null) {
  return useQuery({
    queryKey: ["cross-test", "pairings", missionId],
    enabled: !!missionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cross_test_pairings")
        .select("*")
        .eq("mission_id", missionId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as CrossPairing[];
    },
  });
}

/** Grupos (com integrantes) das turmas informadas — usado na configuração e na exibição. */
export function useCrossGroups(classIds: string[]) {
  const ids = Array.from(new Set(classIds.filter(Boolean))).sort();
  return useQuery({
    queryKey: ["cross-test", "groups", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id, name, class_id, qa_lead_id")
        .in("class_id", ids)
        .order("name");
      if (error) throw error;
      const rows = (data ?? []) as { id: string; name: string; class_id: string; qa_lead_id: string | null }[];
      if (rows.length === 0) return [] as CrossGroup[];

      const membersRes = await supabase
        .from("group_members")
        .select("group_id, student_id")
        .in("group_id", rows.map((r) => r.id));
      if (membersRes.error) throw membersRes.error;
      const memberRows = (membersRes.data ?? []) as { group_id: string; student_id: string }[];

      const people = new Set<string>();
      memberRows.forEach((m) => people.add(m.student_id));
      rows.forEach((r) => r.qa_lead_id && people.add(r.qa_lead_id));

      const profiles = people.size
        ? await supabase.from("profiles").select("id, full_name").in("id", [...people])
        : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      const nameOf = new Map(
        ((profiles.data ?? []) as { id: string; full_name: string | null }[]).map((p) => [
          p.id,
          (p.full_name ?? "").trim() || "Integrante sem nome cadastrado",
        ]),
      );

      return rows.map<CrossGroup>((r) => {
        const ids2 = memberRows.filter((m) => m.group_id === r.id).map((m) => m.student_id);
        if (r.qa_lead_id && !ids2.includes(r.qa_lead_id)) ids2.unshift(r.qa_lead_id);
        return {
          id: r.id,
          name: r.name,
          class_id: r.class_id,
          members: ids2.map((sid) => ({ student_id: sid, name: nameOf.get(sid) ?? "Aluno" })),
        };
      });
    },
  });
}

export function useSavePairing(missionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sectionId: string; testerGroupId: string; developerGroupId: string; classId: string }) => {
      const { error } = await supabase.from("cross_test_pairings").insert({
        mission_id: missionId,
        section_id: input.sectionId,
        class_id: input.classId,
        tester_group_id: input.testerGroupId,
        developer_group_id: input.developerGroupId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cross-test", "pairings", missionId] }),
  });
}

export function useRemovePairing(missionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cross_test_pairings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cross-test", "pairings", missionId] }),
  });
}

/* ------------------------------------------------------------------ */
/* Bugs do teste cruzado                                               */
/* ------------------------------------------------------------------ */

export function useCrossBugs(pairingIds: string[]) {
  const ids = Array.from(new Set(pairingIds.filter(Boolean))).sort();
  return useQuery({
    queryKey: ["cross-test", "bugs", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qa_bugs")
        .select("*")
        .in("pairing_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CrossBug[];
    },
  });
}

export function useCrossBugRelations(bugIds: string[]) {
  const ids = Array.from(new Set(bugIds.filter(Boolean))).sort();
  return useQuery({
    queryKey: ["cross-test", "relations", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [retests, evidences] = await Promise.all([
        supabase.from("qa_retests").select("*").in("bug_id", ids).order("tested_at", { ascending: false }),
        supabase
          .from("qa_evidences")
          .select("id, bug_id, title, kind, link, content, author_id, created_at")
          .in("bug_id", ids)
          .order("created_at", { ascending: false }),
      ]);
      if (retests.error) throw retests.error;
      if (evidences.error) throw evidences.error;
      return {
        retests: (retests.data ?? []) as unknown as CrossRetest[],
        evidences: (evidences.data ?? []) as unknown as CrossEvidence[],
      };
    },
  });
}

export type LinkableCase = {
  id: string;
  title: string;
  label: string;
  feature_id: string | null;
  source: "qa" | "mission";
};

/**
 * Casos de teste que o tester pode vincular a um bug do teste cruzado.
 * Duas origens: casos do módulo QA (qa_test_cases) e casos criados dentro da
 * própria missão (builder_mission_entries com kind = 'test_case').
 * Sempre restrito à missão do pareamento e ao grupo tester / autoria do usuário.
 */
export function useLinkableCases(missionId: string | null, groupId: string | null, userId: string | null) {
  return useQuery({
    queryKey: ["cross-test", "cases", missionId, groupId, userId],
    enabled: !!missionId && !!(groupId || userId),
    queryFn: async () => {
      const entriesQuery = supabase
        .from("builder_mission_entries")
        .select("id, title, feature_id, created_at, author_id, group_id")
        .eq("mission_id", missionId!)
        .eq("kind", "test_case");

      const [entriesRes, qaRes] = await Promise.all([
        groupId
          ? entriesQuery.eq("group_id", groupId).order("created_at", { ascending: true })
          : entriesQuery.eq("author_id", userId!).order("created_at", { ascending: true }),
        (() => {
          const q = supabase
            .from("qa_test_cases")
            .select("id, title, feature, feature_id, created_at");
          return groupId
            ? q.eq("group_id", groupId).order("created_at", { ascending: true })
            : q.eq("author_id", userId!).order("created_at", { ascending: true });
        })(),
      ]);
      if (entriesRes.error) throw entriesRes.error;
      if (qaRes.error) throw qaRes.error;

      const entries = (entriesRes.data ?? []) as unknown as {
        id: string;
        title: string | null;
        feature_id: string | null;
      }[];
      const qaCases = (qaRes.data ?? []) as unknown as {
        id: string;
        title: string | null;
        feature: string | null;
        feature_id: string | null;
      }[];

      const out: LinkableCase[] = [];
      let n = 0;
      const push = (
        id: string,
        title: string | null,
        feature_id: string | null,
        source: "qa" | "mission",
      ) => {
        n += 1;
        const name = (title ?? "").trim() || "Caso sem título";
        out.push({
          id,
          title: name,
          label: `CT-${String(n).padStart(2, "0")} — ${name}`,
          feature_id,
          source,
        });
      };

      entries.forEach((e) => push(e.id, e.title, e.feature_id, "mission"));
      qaCases.forEach((c) => push(c.id, c.title ?? c.feature, c.feature_id, "qa"));
      return out;
    },
  });
}

function invalidateCross(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["cross-test"] });
  qc.invalidateQueries({ queryKey: ["qa"] });
}

export function useReportCrossBug() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      pairingId: string;
      title: string;
      description: string;
      environment?: string;
      steps?: string;
      expectedResult?: string;
      obtainedResult?: string;
      severity: string;
      priority: string;
      testCaseId: string | null;
      testCaseSource: "qa" | "mission" | null;
      featureId: string | null;
      assigneeId: string | null;
    }) => {
      const { data, error } = await rpc("cross_test_report_bug", {
        _pairing_id: input.pairingId,
        _title: input.title,
        _description: input.description,
        _environment: input.environment ?? "",
        _steps: input.steps ?? "",
        _expected_result: input.expectedResult ?? "",
        _obtained_result: input.obtainedResult ?? "",
        _severity: input.severity,
        _priority: input.priority,
        _test_case_id: input.testCaseId,
        _test_case_source: input.testCaseId ? (input.testCaseSource ?? "qa") : null,
        _feature_id: input.featureId,
        _assignee_id: input.assigneeId,
      });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: () => invalidateCross(qc),
  });
}

export function useClaimCrossBug() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bugId: string) => {
      const { error } = await rpc("cross_test_claim_bug", { _bug_id: bugId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateCross(qc),
  });
}

export function useSetCrossAssignee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bugId, assigneeId }: { bugId: string; assigneeId: string | null }) => {
      const { error } = await rpc("cross_test_set_assignee", { _bug_id: bugId, _assignee_id: assigneeId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateCross(qc),
  });
}

export function useCrossTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bugId, status, note }: { bugId: string; status: string; note?: string }) => {
      const { error } = await rpc("cross_test_transition", {
        _bug_id: bugId,
        _status: status,
        _note: note ?? "",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateCross(qc),
  });
}

export function useCrossRetest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bugId, result, notes }: { bugId: string; result: "resolvido" | "reaberto"; notes: string }) => {
      const { error } = await rpc("cross_test_retest", { _bug_id: bugId, _result: result, _notes: notes });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateCross(qc),
  });
}

/** Evidência vinculada a um bug do teste cruzado (reutiliza qa_evidences). */
export function useAddCrossEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      bugId: string;
      groupId: string;
      authorId: string;
      title: string;
      kind: string;
      description: string;
      link: string | null;
      content: string | null;
    }) => {
      const { error } = await supabase.from("qa_evidences").insert({
        context: "cafe",
        group_id: input.groupId,
        project: "cafe_central",
        bug_id: input.bugId,
        kind: input.kind,
        title: input.title,
        description: input.description,
        link: input.link,
        content: input.content,
        author_id: input.authorId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => invalidateCross(qc),
  });
}

/* Transições exibidas na interface (espelham a regra do banco). */
export const CROSS_DEV_TRANSITIONS: Record<string, string[]> = {
  aberto: ["em_analise", "confirmado", "descartado"],
  confirmado: ["em_analise", "em_correcao", "descartado"],
  em_analise: ["confirmado", "em_correcao", "pronto_reteste", "descartado"],
  em_correcao: ["pronto_reteste", "em_analise"],
  reaberto: ["em_analise", "em_correcao", "pronto_reteste"],
};
