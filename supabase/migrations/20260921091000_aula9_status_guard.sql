-- Aula 9: staged in Git only; validate in an isolated database before deployment.
-- This migration protects qa_bugs only. Mission bugs require their own workflow.
create table if not exists public.qa_bug_status_events (
 id uuid primary key default gen_random_uuid(),
 bug_id uuid not null references public.qa_bugs(id) on delete cascade,
 previous_status text not null,
 next_status text not null,
 actor_id uuid not null,
 occurred_at timestamptz not null default now()
);
alter table public.qa_bug_status_events enable row level security;
revoke all on public.qa_bug_status_events from public, anon, authenticated;
grant select on public.qa_bug_status_events to authenticated;
drop policy if exists qa_bug_status_events_select on public.qa_bug_status_events;
create policy qa_bug_status_events_select on public.qa_bug_status_events for select to authenticated
using (exists (select 1 from public.qa_bugs b where b.id = bug_id and public.qa_can_view(b.author_id,b.group_id,auth.uid())));

-- Assignment is limited to the assigned developer within the original group.
drop policy if exists qa_bugs_assigned_developer_update on public.qa_bugs;
create policy qa_bugs_assigned_developer_update on public.qa_bugs for update to authenticated
using (
 assignee_id = auth.uid()
 and group_id is not null
 and exists (
  select 1
  from public.qa_cross_test_pairs pair
  where pair.tester_group_id = qa_bugs.group_id
    and public.is_group_member(pair.developer_group_id, auth.uid())
 )
)
with check (
 assignee_id = auth.uid()
 and group_id is not null
 and exists (
  select 1
  from public.qa_cross_test_pairs pair
  where pair.tester_group_id = qa_bugs.group_id
    and public.is_group_member(pair.developer_group_id, auth.uid())
 )
);

create or replace function public.qa_guard_bug_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
 v_actor uuid := auth.uid();
 v_tester boolean;
 v_developer boolean;
 v_allowed boolean := false;
begin
 if v_actor is null then
  raise exception 'Autenticação obrigatória para alterar bugs.' using errcode='42501';
 end if;
 if tg_op = 'INSERT' then
  if new.status is distinct from 'aberto' then
   raise exception 'Novos bugs devem iniciar com status aberto.' using errcode='22023';
  end if;
  if new.author_id is distinct from v_actor then
   raise exception 'O autor deve ser o usuário autenticado.' using errcode='42501';
  end if;
  if new.assignee_id = v_actor then
   raise exception 'Tester e desenvolvedor devem ser pessoas diferentes.' using errcode='22023';
  end if;
  if new.assignee_id is not null and (
   new.group_id is null
   or not exists (
    select 1
    from public.qa_cross_test_pairs pair
    where pair.tester_group_id = new.group_id
      and public.is_group_member(pair.tester_group_id, v_actor)
      and public.is_group_member(pair.developer_group_id, new.assignee_id)
   )
 ) then
  raise exception 'Assignee fora da equipe desenvolvedora vinculada ao tester.' using errcode='42501';
 end if;
 return new;
 end if;
 if new.author_id is distinct from old.author_id
  or new.group_id is distinct from old.group_id
  or new.context is distinct from old.context
  or new.assignee_id is distinct from old.assignee_id then
  raise exception 'Alterações de autoria, equipe, contexto e atribuição exigem fluxo específico.' using errcode='42501';
 end if;
 if new.status is not distinct from old.status then return new; end if;
 v_tester := v_actor = old.author_id and old.assignee_id is not null and old.assignee_id <> v_actor;
 v_developer := v_actor = old.assignee_id and old.author_id <> v_actor;
 v_allowed := case
  when old.status='aberto' and new.status in ('em_analise','descartado') then v_developer
  when old.status='em_analise' and new.status in ('confirmado','descartado') then v_developer
  when old.status='confirmado' and new.status in ('em_correcao','descartado') then v_developer
  when old.status='em_correcao' and new.status='pronto_reteste' then v_developer
  when old.status='reaberto' and new.status in ('em_analise','em_correcao') then v_developer
  when old.status='pronto_reteste' and new.status in ('resolvido','reaberto') then
   v_tester and coalesce(pg_catalog.current_setting('qa.retest_bug_id',true)=old.id::text,false)
  when old.status in ('resolvido','descartado') and new.status='reaberto' then v_tester
  else false
 end;
 if not v_allowed then
  raise exception 'Transição de status não permitida para este usuário.' using errcode='42501';
 end if;
 insert into public.qa_bug_status_events(bug_id,previous_status,next_status,actor_id)
 values(old.id,old.status,new.status,v_actor);
 return new;
end;
$$;
revoke all on function public.qa_guard_bug_status() from public,anon,authenticated;
drop trigger if exists qa_guard_bug_status_insert on public.qa_bugs;
create trigger qa_guard_bug_status_insert before insert on public.qa_bugs
for each row execute function public.qa_guard_bug_status();
drop trigger if exists qa_guard_bug_status_update on public.qa_bugs;
create trigger qa_guard_bug_status_update before update on public.qa_bugs
for each row execute function public.qa_guard_bug_status();
-- The transaction-local marker is set only by qa_register_retest in the supported app flow.
-- Before production, validate direct SQL/RPC access and legacy records in an isolated DB.
