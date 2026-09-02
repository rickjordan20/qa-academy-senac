ALTER TABLE public.cafe_tasks ADD COLUMN IF NOT EXISTS section_id text;
CREATE INDEX IF NOT EXISTS cafe_tasks_builder_run_section_idx ON public.cafe_tasks (builder_run_id, section_id);