ALTER TABLE public.builder_missions
  ADD COLUMN IF NOT EXISTS activity_kind text NOT NULL DEFAULT 'presencial',
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

ALTER TABLE public.builder_missions
  DROP CONSTRAINT IF EXISTS builder_missions_activity_kind_check;

ALTER TABLE public.builder_missions
  ADD CONSTRAINT builder_missions_activity_kind_check
  CHECK (activity_kind IN ('presencial','assincrona','final','recuperacao'));

CREATE INDEX IF NOT EXISTS builder_missions_activity_kind_idx
  ON public.builder_missions (activity_kind, position);