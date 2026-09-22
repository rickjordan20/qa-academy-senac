create or replace function public.is_student_instructor(_viewer uuid, _target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.enrollments e
    join public.classes c on c.id = e.class_id
    where e.student_id = _target and c.instructor_id = _viewer
  );
$$;

create or replace function public.shares_group(_viewer uuid, _target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.student_id = _viewer and b.student_id = _target
  ) or exists (
    select 1
    from public.groups g
    where (g.qa_lead_id = _viewer and exists (
             select 1 from public.group_members m
             where m.group_id = g.id and m.student_id = _target))
       or (g.qa_lead_id = _target and exists (
             select 1 from public.group_members m
             where m.group_id = g.id and m.student_id = _viewer))
  );
$$;

revoke all on function public.is_student_instructor(uuid, uuid) from public, anon;
revoke all on function public.shares_group(uuid, uuid) from public, anon;
grant execute on function public.is_student_instructor(uuid, uuid) to authenticated;
grant execute on function public.shares_group(uuid, uuid) to authenticated;

drop policy if exists "indicators_readable" on public.indicators;
create policy "indicators_readable"
on public.indicators
for select
to authenticated
using (true);

revoke select on public.indicators from anon;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_student_instructor(auth.uid(), id)
  or public.shares_group(auth.uid(), id)
);
