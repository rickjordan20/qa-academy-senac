-- Aula 9: stage only; apply and validate in an isolated Supabase project first.
-- Instructors explicitly pair a developer group with a tester group from the same class.
-- This grants READ access to paired groups' bugs and mission entries, not WRITE access.
create table if not exists public.qa_cross_test_pairs (
  id uuid primary key default gen_random_uuid(),
  developer_group_id uuid not null references public.groups(id) on delete cascade,
  tester_group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint qa_cross_test_distinct_groups check (developer_group_id <> tester_group_id),
  constraint qa_cross_test_unique_pair unique (developer_group_id, tester_group_id)
);

alter table public.qa_cross_test_pairs enable row level security;
revoke all on public.qa_cross_test_pairs from public, anon;
grant select, insert, delete on public.qa_cross_test_pairs to authenticated;

-- The two groups must belong to the same class, and only its instructor can assign them.
create policy qa_cross_pairs_instructor_insert on public.qa_cross_test_pairs
for insert to authenticated with check (
  created_by = auth.uid()
  and public.group_class_id(developer_group_id) is not null
  and public.group_class_id(developer_group_id) = public.group_class_id(tester_group_id)
  and public.is_class_instructor(public.group_class_id(developer_group_id), auth.uid())
);
create policy qa_cross_pairs_instructor_delete on public.qa_cross_test_pairs
for delete to authenticated using (
  public.is_class_instructor(public.group_class_id(developer_group_id), auth.uid())
);
create policy qa_cross_pairs_read on public.qa_cross_test_pairs
for select to authenticated using (
  public.is_class_instructor(public.group_class_id(developer_group_id), auth.uid())
  or public.is_group_member(developer_group_id, auth.uid())
  or public.is_group_member(tester_group_id, auth.uid())
);

-- A SECURITY DEFINER helper reads only pairing IDs and never returns underlying data.
-- It prevents RLS recursion when referenced by qa_bugs and builder_mission_entries.
-- The caller cannot impersonate another user via the p_user_id parameter.
create or replace function public.qa_cross_can_read_group(p_group_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_group_id is not null and p_user_id = auth.uid() and exists (
    select 1 from public.qa_cross_test_pairs pair
    where (pair.developer_group_id = p_group_id and public.is_group_member(pair.tester_group_id, p_user_id))
       or (pair.tester_group_id = p_group_id and public.is_group_member(pair.developer_group_id, p_user_id))
  );
$$;
revoke all on function public.qa_cross_can_read_group(uuid,uuid) from public, anon;
grant execute on function public.qa_cross_can_read_group(uuid,uuid) to authenticated;

-- Existing SELECT policies remain intact. Paired access is strictly additive and read-only.
create policy qa_bugs_cross_team_select on public.qa_bugs
for select to authenticated using (public.qa_cross_can_read_group(group_id, auth.uid()));
create policy builder_entries_cross_team_select on public.builder_mission_entries
for select to authenticated using (public.qa_cross_can_read_group(group_id, auth.uid()));

-- No UPDATE/DELETE/INSERT cross-team policy: a separate audited RPC must enforce
-- tester/developer roles and transitions before cross-team mutations are enabled.
