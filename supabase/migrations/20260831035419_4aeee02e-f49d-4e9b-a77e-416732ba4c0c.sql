
ALTER TABLE public.indicator_evaluations ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'regular';

CREATE TABLE public.eval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'regular',
  concept public.evaluation_concept,
  notes TEXT NOT NULL DEFAULT '',
  evaluated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.eval_history TO authenticated;
GRANT ALL ON public.eval_history TO service_role;
ALTER TABLE public.eval_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY eval_history_select ON public.eval_history FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_class_instructor(class_id, auth.uid()));
CREATE POLICY eval_history_insert ON public.eval_history FOR INSERT TO authenticated
  WITH CHECK (public.is_class_instructor(class_id, auth.uid()));
CREATE INDEX eval_history_student_idx ON public.eval_history (student_id, indicator_id, created_at DESC);

CREATE TABLE public.eval_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  indicator_id UUID REFERENCES public.indicators(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  author_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eval_feedbacks TO authenticated;
GRANT ALL ON public.eval_feedbacks TO service_role;
ALTER TABLE public.eval_feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY eval_feedbacks_select ON public.eval_feedbacks FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_class_instructor(class_id, auth.uid()));
CREATE POLICY eval_feedbacks_write ON public.eval_feedbacks FOR ALL TO authenticated
  USING (public.is_class_instructor(class_id, auth.uid()))
  WITH CHECK (public.is_class_instructor(class_id, auth.uid()));
CREATE TRIGGER eval_feedbacks_updated_at BEFORE UPDATE ON public.eval_feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX eval_feedbacks_student_idx ON public.eval_feedbacks (student_id, indicator_id);

CREATE TABLE public.recovery_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  indicator_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_plans TO authenticated;
GRANT ALL ON public.recovery_plans TO service_role;
ALTER TABLE public.recovery_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY recovery_plans_select ON public.recovery_plans FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_class_instructor(class_id, auth.uid()));
CREATE POLICY recovery_plans_write ON public.recovery_plans FOR ALL TO authenticated
  USING (public.is_class_instructor(class_id, auth.uid()))
  WITH CHECK (public.is_class_instructor(class_id, auth.uid()));
CREATE TRIGGER recovery_plans_updated_at BEFORE UPDATE ON public.recovery_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.uc_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  final_result public.final_result,
  notes TEXT NOT NULL DEFAULT '',
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uc_results TO authenticated;
GRANT ALL ON public.uc_results TO service_role;
ALTER TABLE public.uc_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY uc_results_select ON public.uc_results FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_class_instructor(class_id, auth.uid()));
CREATE POLICY uc_results_write ON public.uc_results FOR ALL TO authenticated
  USING (public.is_class_instructor(class_id, auth.uid()))
  WITH CHECK (public.is_class_instructor(class_id, auth.uid()));
CREATE TRIGGER uc_results_updated_at BEFORE UPDATE ON public.uc_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.log_evaluation_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.concept IS NOT DISTINCT FROM OLD.concept
     AND NEW.stage IS NOT DISTINCT FROM OLD.stage
     AND NEW.notes IS NOT DISTINCT FROM OLD.notes THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.eval_history (class_id, student_id, indicator_id, stage, concept, notes, evaluated_by)
  VALUES (NEW.class_id, NEW.student_id, NEW.indicator_id, COALESCE(NEW.stage, 'regular'),
          NEW.concept, COALESCE(NEW.notes, ''), COALESCE(NEW.evaluated_by, auth.uid()));
  RETURN NEW;
END; $$;

CREATE TRIGGER indicator_evaluations_history
AFTER INSERT OR UPDATE ON public.indicator_evaluations
FOR EACH ROW EXECUTE FUNCTION public.log_evaluation_history();
