-- Ponto de restauração imutável + registro da ativação da consolidação por predominância.
CREATE TABLE public.indicator_consolidation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch text NOT NULL,
  evaluation_id uuid NOT NULL,
  class_id uuid NOT NULL,
  student_id uuid NOT NULL,
  indicator_id uuid NOT NULL,
  concept_before public.evaluation_concept,
  concept_after public.evaluation_concept,
  mode_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text NOT NULL,
  row_before jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.indicator_consolidation_snapshots TO authenticated;
GRANT ALL ON public.indicator_consolidation_snapshots TO service_role;
ALTER TABLE public.indicator_consolidation_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snap_select" ON public.indicator_consolidation_snapshots FOR SELECT TO authenticated
  USING (public.is_class_instructor(class_id, auth.uid()));
CREATE TRIGGER zz_student_view_guard BEFORE INSERT OR DELETE OR UPDATE ON public.indicator_consolidation_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.student_view_write_guard();

ALTER TABLE public.indicator_evaluations
  ADD COLUMN consolidation_status text,
  ADD COLUMN consolidation_counts jsonb;

-- Backfill controlado (lote único, transacional).
CREATE TEMP TABLE _plan ON COMMIT DROP AS
WITH ev AS (
  SELECT e.mission_id, e.version, e.indicator_finals, e.member_overrides, s.sid
  FROM public.builder_run_evaluations e
  JOIN public.builder_mission_runs r ON r.id = e.run_id AND r.eval_status = 'evaluated'
  CROSS JOIN LATERAL unnest(e.target_student_ids) s(sid) WHERE e.is_current),
votes AS (
  SELECT DISTINCT ON (sid, i.id, mission_id) sid, i.id ind,
    coalesce(member_overrides->sid::text->>i.code, indicator_finals->>i.code) c
  FROM ev JOIN public.indicators i
    ON coalesce(member_overrides->sid::text->>i.code, indicator_finals->>i.code) IN ('A','PA','NA')
  ORDER BY sid, i.id, mission_id, version DESC),
cnt AS (SELECT sid, ind, count(*) FILTER (WHERE c='A') a, count(*) FILTER (WHERE c='PA') pa,
          count(*) FILTER (WHERE c='NA') na FROM votes GROUP BY 1,2),
m AS (SELECT *, CASE WHEN a>pa AND a>na THEN 'A' WHEN pa>a AND pa>na THEN 'PA'
                     WHEN na>a AND na>pa THEN 'NA' ELSE 'tie' END mode FROM cnt)
SELECT ie.id, ie.class_id, m.sid, m.ind, ie.concept cur, m.mode,
  jsonb_build_object('A', m.a, 'PA', m.pa, 'NA', m.na) counts,
  CASE WHEN h.id IS NOT NULL THEN 'homologated' WHEN m.mode='tie' THEN 'tie_pending'
       WHEN ie.concept='A' AND m.mode<>'A' THEN 'reduction_review'
       WHEN ie.concept::text IS NOT DISTINCT FROM m.mode THEN 'unchanged' ELSE 'applied' END outcome,
  to_jsonb(ie) row_before
FROM m JOIN public.indicator_evaluations ie ON ie.student_id = m.sid AND ie.indicator_id = m.ind
LEFT JOIN public.indicator_homologations h ON h.is_current AND h.class_id = ie.class_id
  AND h.student_id = m.sid AND h.indicator_id = m.ind;

DO $$
DECLARE n_apply int; n_tie int; n_red int; n_hom int;
BEGIN
  SELECT count(*) FILTER (WHERE outcome='applied'), count(*) FILTER (WHERE outcome='tie_pending'),
         count(*) FILTER (WHERE outcome='reduction_review'), count(*) FILTER (WHERE outcome='homologated')
    INTO n_apply, n_tie, n_red, n_hom FROM _plan;
  -- Conferência imediata: aborta se os dados divergirem da conferência pré-ativação.
  IF n_apply <> 7 OR n_tie <> 11 OR n_red <> 8 OR n_hom <> 0 THEN
    RAISE EXCEPTION 'Dados mudaram desde a conferência (apply=%, tie=%, red=%, hom=%). Ativação abortada.', n_apply, n_tie, n_red, n_hom;
  END IF;
END $$;

INSERT INTO public.indicator_consolidation_snapshots
  (batch, evaluation_id, class_id, student_id, indicator_id, concept_before, concept_after, mode_counts, outcome, row_before)
SELECT 'uc10-moda-2026-10-20', id, class_id, sid, ind, cur,
  CASE WHEN outcome='applied' THEN mode::public.evaluation_concept ELSE cur END, counts, outcome, row_before
FROM _plan;

UPDATE public.indicator_evaluations ie
SET consolidation_status = p.outcome, consolidation_counts = p.counts,
    concept = CASE WHEN p.outcome='applied' THEN p.mode::public.evaluation_concept ELSE ie.concept END,
    notes = CASE WHEN p.outcome='applied'
      THEN coalesce(nullif(ie.notes,''),'') || ' [Consolidação por predominância: ' || coalesce(p.cur::text,'—') || ' → ' || p.mode || ']'
      ELSE ie.notes END
FROM _plan p WHERE ie.id = p.id;