\set ON_ERROR_STOP on
begin;
create extension if not exists pgcrypto;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  instructor_id uuid not null references auth.users(id)
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  qa_lead_id uuid references auth.users(id)
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  unique (group_id, student_id)
);

create or replace function public.group_class_id(_group_id uuid)
returns uuid language sql stable security definer set search_path = 'public' as $$
  select g.class_id from public.groups g where g.id = _group_id
$$;

create or replace function public.is_class_instructor(_class_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = 'public' as $$
  select exists (
    select 1 from public.classes c where c.id = _class_id and c.instructor_id = _user_id
  )
$$;

create or replace function public.is_group_member(_group_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = 'public' as $$
  select exists (
    select 1 from public.group_members gm where gm.group_id = _group_id and gm.student_id = _user_id
  )
  or exists (
    select 1 from public.groups g where g.id = _group_id and g.qa_lead_id = _user_id
  );
$$;

create or replace function public.qa_can_view(_author uuid, _group_id uuid, _viewer uuid)
returns boolean language sql stable security definer set search_path = 'public' as $$
  select _author = _viewer or (_group_id is not null and public.is_group_member(_group_id,_viewer))
$$;

create table if not exists public.builder_mission_entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid
);
alter table public.builder_mission_entries enable row level security;

create table if not exists public.qa_bugs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id),
  title text not null default '',
  status text not null default 'aberto',
  author_id uuid not null references auth.users(id),
  assignee_id uuid references auth.users(id),
  context text not null default 'cafe',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('aberto','em_analise','confirmado','em_correcao','pronto_reteste','resolvido','reaberto','descartado'))
);

create table if not exists public.qa_retests (
  id uuid primary key default gen_random_uuid(),
  bug_id uuid not null references public.qa_bugs(id) on delete cascade,
  tester_id uuid not null references auth.users(id),
  result text not null check (result in ('resolvido','reaberto')),
  notes text not null default '',
  tested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.qa_bugs to authenticated;
grant select, insert, update, delete on public.qa_retests to authenticated;
grant all on public.qa_bugs, public.qa_retests, public.builder_mission_entries to service_role;

alter table public.qa_bugs enable row level security;
alter table public.qa_retests enable row level security;

drop policy if exists qa_bugs_insert on public.qa_bugs;
drop policy if exists qa_bugs_update on public.qa_bugs;
drop policy if exists qa_bugs_select on public.qa_bugs;
create policy qa_bugs_insert on public.qa_bugs for insert to authenticated
with check (author_id = auth.uid() and (group_id is null or public.is_group_member(group_id, auth.uid())));
create policy qa_bugs_update on public.qa_bugs for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());
create policy qa_bugs_select on public.qa_bugs for select to authenticated
using (author_id = auth.uid() or assignee_id = auth.uid() or public.is_group_member(group_id, auth.uid()));

drop policy if exists "qa_retests_insert" on public.qa_retests;
drop policy if exists "qa_retests_delete" on public.qa_retests;
drop policy if exists qa_retests_select on public.qa_retests;
create policy "qa_retests_insert" on public.qa_retests for insert to authenticated
with check (tester_id = auth.uid());
create policy "qa_retests_delete" on public.qa_retests for delete to authenticated
using (tester_id = auth.uid());
create policy qa_retests_select on public.qa_retests for select to authenticated
using (tester_id = auth.uid() or exists (select 1 from public.qa_bugs b where b.id = bug_id and (b.author_id = auth.uid() or b.assignee_id = auth.uid())));

\i /home/runner/work/qa-academy-senac/qa-academy-senac/supabase/migrations/20260922020000_aula9_cross_team_read.sql
\i /home/runner/work/qa-academy-senac/qa-academy-senac/supabase/migrations/20260921090000_aula9_atomic_retest.sql
\i /home/runner/work/qa-academy-senac/qa-academy-senac/supabase/migrations/20260921091000_aula9_status_guard.sql

create or replace function public.assert_raises(_sql text)
returns void language plpgsql as $$
begin
  execute _sql;
  raise exception 'Expected statement to fail: %', _sql;
exception when others then
  return;
end $$;

create or replace function public.assert_true(_cond boolean, _msg text)
returns void language plpgsql as $$
begin
  if not _cond then
    raise exception 'Assertion failed: %', _msg;
  end if;
end $$;

grant execute on function public.group_class_id(uuid) to authenticated;
grant execute on function public.is_class_instructor(uuid,uuid) to authenticated;

insert into auth.users(id) values
('00000000-0000-0000-0000-0000000000f1'),
('00000000-0000-0000-0000-0000000000a1'),
('00000000-0000-0000-0000-0000000000a2'),
('00000000-0000-0000-0000-0000000000b1'),
('00000000-0000-0000-0000-0000000000b2')
on conflict (id) do nothing;

insert into public.classes(id,name,instructor_id) values
('30000000-0000-0000-0000-000000000001','Turma teste','00000000-0000-0000-0000-0000000000f1')
on conflict (id) do nothing;

insert into public.groups(id,class_id,name) values
('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','QA testers'),
('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','Dev linked'),
('10000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001','Dev unlinked')
on conflict (id) do nothing;

insert into public.group_members(group_id, student_id) values
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1'),
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a2'),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b1'),
('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000b2')
on conflict (group_id, student_id) do nothing;

insert into public.qa_cross_test_pairs(developer_group_id,tester_group_id,created_by)
values ('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000f1')
on conflict (developer_group_id,tester_group_id) do nothing;

set role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

select public.assert_raises($sql$
  insert into public.qa_bugs(id,group_id,title,status,author_id,assignee_id)
  values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','bug inválido','aberto','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b2')
$sql$);

insert into public.qa_bugs(id,group_id,title,status,author_id,assignee_id)
values ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','bug válido','aberto','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1');

select public.assert_raises($sql$
  insert into public.qa_retests(bug_id,tester_id,result,notes)
  values ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','resolvido','tentativa direta')
$sql$);

reset request.jwt.claim.sub;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
update public.qa_bugs set status='descartado' where id='20000000-0000-0000-0000-000000000002';

reset request.jwt.claim.sub;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
select public.assert_raises($sql$
  update public.qa_bugs set status='em_analise' where id='20000000-0000-0000-0000-000000000002'
$sql$);

-- separate bug for pronto_reteste flow
reset request.jwt.claim.sub;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
insert into public.qa_bugs(id,group_id,title,status,author_id,assignee_id)
values ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','bug fluxo','aberto','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1');

reset request.jwt.claim.sub;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
update public.qa_bugs set status='em_analise' where id='20000000-0000-0000-0000-000000000003';
update public.qa_bugs set status='confirmado' where id='20000000-0000-0000-0000-000000000003';
update public.qa_bugs set status='em_correcao' where id='20000000-0000-0000-0000-000000000003';
update public.qa_bugs set status='pronto_reteste' where id='20000000-0000-0000-0000-000000000003';

reset request.jwt.claim.sub;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.assert_raises($sql$
  update public.qa_bugs set status='resolvido' where id='20000000-0000-0000-0000-000000000003'
$sql$);

reset request.jwt.claim.sub;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
select public.assert_raises($sql$
  select public.qa_register_retest('20000000-0000-0000-0000-000000000003','resolvido','reteste por outro tester')
$sql$);

reset request.jwt.claim.sub;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.qa_register_retest('20000000-0000-0000-0000-000000000003','resolvido','reteste aprovado');
select public.assert_true(
  (select status='resolvido' from public.qa_bugs where id='20000000-0000-0000-0000-000000000003'),
  'bug should be resolvido after rpc'
);
select public.assert_true(
  (select count(*) = 1 from public.qa_retests where bug_id='20000000-0000-0000-0000-000000000003'),
  'expected exactly one retest row'
);

reset role;
rollback;
