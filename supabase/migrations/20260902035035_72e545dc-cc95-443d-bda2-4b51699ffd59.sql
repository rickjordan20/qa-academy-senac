ALTER TABLE public.cafe_tasks
  ALTER COLUMN run_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS builder_run_id uuid REFERENCES public.builder_mission_runs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS mission_id uuid REFERENCES public.builder_missions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES public.app_modules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS feature_id uuid REFERENCES public.app_features(id) ON DELETE SET NULL;

ALTER TABLE public.cafe_tasks
  ADD CONSTRAINT cafe_tasks_run_target CHECK (run_id IS NOT NULL OR builder_run_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS cafe_tasks_builder_run_idx ON public.cafe_tasks (builder_run_id);

ALTER TABLE public.cafe_contributions
  ALTER COLUMN run_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS builder_run_id uuid REFERENCES public.builder_mission_runs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS mission_id uuid REFERENCES public.builder_missions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reflection text NOT NULL DEFAULT '';

ALTER TABLE public.cafe_contributions
  ADD CONSTRAINT cafe_contributions_run_target CHECK (run_id IS NOT NULL OR builder_run_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS cafe_contributions_builder_run_idx ON public.cafe_contributions (builder_run_id);