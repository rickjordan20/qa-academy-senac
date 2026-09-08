ALTER TABLE public.builder_run_evaluations
  ADD COLUMN IF NOT EXISTS member_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS override_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS superseded_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS superseded_at timestamp with time zone;

ALTER TABLE public.indicator_evaluations
  ADD COLUMN IF NOT EXISTS invalidated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS invalidation_reason text NOT NULL DEFAULT '';