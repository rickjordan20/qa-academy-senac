CREATE TABLE public.indicator_homologations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  indicator_id uuid NOT NULL REFERENCES public.indicators(id),
  concept public.evaluation_concept NOT NULL,
  decision text NOT NULL CHECK (decision IN ('confirm_mode','override','tie_resolution','keep_A')),
  reason text NOT NULL,
  basis jsonb NOT NULL DEFAULT '{}'::jsonb,
  decided_by uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.indicator_homologations TO authenticated;
GRANT ALL ON public.indicator_homologations TO service_role;
ALTER TABLE public.indicator_homologations ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX indicator_homologations_one_current
  ON public.indicator_homologations(class_id, student_id, indicator_id) WHERE is_current;

CREATE POLICY "hom_select" ON public.indicator_homologations FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_class_instructor(class_id, auth.uid()));
CREATE POLICY "hom_insert" ON public.indicator_homologations FOR INSERT TO authenticated
  WITH CHECK (public.is_class_instructor(class_id, auth.uid()) AND decided_by = auth.uid()
              AND length(btrim(reason)) >= 10);
CREATE POLICY "hom_update" ON public.indicator_homologations FOR UPDATE TO authenticated
  USING (public.is_class_instructor(class_id, auth.uid()))
  WITH CHECK (public.is_class_instructor(class_id, auth.uid()));

-- Histórico imutável: apenas a flag is_current pode mudar (true -> false).
CREATE OR REPLACE FUNCTION public.indicator_homologations_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.concept IS DISTINCT FROM OLD.concept OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.decision IS DISTINCT FROM OLD.decision OR NEW.basis IS DISTINCT FROM OLD.basis
     OR NEW.decided_by IS DISTINCT FROM OLD.decided_by OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
     OR NEW.class_id IS DISTINCT FROM OLD.class_id OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.indicator_id IS DISTINCT FROM OLD.indicator_id
     OR (OLD.is_current = false AND NEW.is_current = true) THEN
    RAISE EXCEPTION 'Homologações são imutáveis; registre uma nova decisão.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER indicator_homologations_guard BEFORE UPDATE ON public.indicator_homologations
  FOR EACH ROW EXECUTE FUNCTION public.indicator_homologations_guard();
CREATE TRIGGER zz_student_view_guard BEFORE INSERT OR DELETE OR UPDATE ON public.indicator_homologations
  FOR EACH ROW EXECUTE FUNCTION public.student_view_write_guard();