import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BuilderMission, MissionRun, Section } from "@/lib/mission-builder";

/**
 * Personalização da recuperação por indicador pendente.
 * Regra (aplicada no banco; aqui apenas espelhada para exibição):
 * PA/NA → bloco exibido · A → oculto · sem menção → oculto + revisão docente.
 */
export type IndicatorTarget = { code: string; concept: string | null; shown: boolean; needs_review: boolean };

export const isTargetConcept = (c: string | null | undefined) => c === "PA" || c === "NA";

/** Mantém a ordem original; blocos sem indicador seguem visíveis; vários blocos do mesmo indicador ficam juntos. */
export function filterSectionsByIndicators(sections: Section[], target: string[] | null | undefined): Section[] {
  if (!target) return sections;
  const set = new Set(target);
  return sections.filter((s) => {
    const codes = s.indicator_codes ?? [];
    return codes.length === 0 || codes.some((c) => set.has(c));
  });
}

export function personalizeMission(mission: BuilderMission, target: string[] | null | undefined): BuilderMission {
  if (!mission.personalize_by_pending_indicators || !target) return mission;
  return { ...mission, sections: filterSectionsByIndicators(mission.sections ?? [], target) };
}

/** Indicadores do aluno: congelados na tentativa; antes de iniciar, calculados no banco. */
export function useRecoveryTargets(mission: BuilderMission | null | undefined, run: MissionRun | null | undefined, studentId: string | null) {
  const enabled = !!mission?.personalize_by_pending_indicators && !!studentId;
  const q = useQuery({
    queryKey: ["recovery-targets", mission?.id, studentId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("recovery_indicator_targets" as never, {
        _mission_id: mission!.id,
        _student_id: studentId!,
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as IndicatorTarget[];
    },
  });
  if (!enabled) return { target: null as string[] | null, details: [] as IndicatorTarget[] };
  const frozen = run?.target_indicator_codes ?? null;
  const live = q.data ? q.data.filter((t) => t.shown).map((t) => t.code) : null;
  return { target: frozen ?? live ?? [], details: q.data ?? [], frozen: !!frozen };
}

export type PreviewRow = IndicatorTarget & { student_id: string; full_name: string | null };

export function useRecoveryPreview(missionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["recovery-preview", missionId],
    enabled: !!missionId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("recovery_mission_preview" as never, { _mission_id: missionId! } as never);
      if (error) throw error;
      return (data ?? []) as unknown as PreviewRow[];
    },
  });
}
