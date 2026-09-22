-- Aula 9: versioned in Git only. Apply to isolated database after review.
-- Handles qa_bugs only; mission bugs require a separate authorized bridge.
create or replace function public.qa_register_retest(p_bug_id uuid,p_result text,p_notes text)
returns public.qa_retests language plpgsql security definer set search_path = '' as $$
declare
 v_user uuid := auth.uid();
 v_bug public.qa_bugs%rowtype;
 v_retest public.qa_retests%rowtype;
 v_pair_ok boolean;
begin
 if v_user is null then
  raise exception 'É necessário estar autenticado para registrar o reteste.' using errcode='42501';
 end if;
 if p_result is null or p_result not in ('resolvido','reaberto') then
  raise exception 'Resultado de reteste inválido.' using errcode='22023';
 end if;
 if nullif(pg_catalog.btrim(p_notes),'') is null then
  raise exception 'Descreva o resultado observado no reteste.' using errcode='22023';
 end if;
 select * into v_bug from public.qa_bugs where id=p_bug_id for update;
 if not found then
  raise exception 'Bug inexistente ou acesso negado.' using errcode='42501';
 end if;
 if v_bug.author_id is distinct from v_user or v_bug.assignee_id is null or v_bug.assignee_id=v_user then
  raise exception 'Somente o tester autor pode validar um bug atribuído a outro desenvolvedor.' using errcode='42501';
 end if;
 if v_bug.group_id is null then
  raise exception 'Bug sem equipe tester vinculada não pode seguir no fluxo cruzado.' using errcode='42501';
 end if;
 select exists (
  select 1
  from public.qa_cross_test_pairs pair
  where pair.tester_group_id = v_bug.group_id
    and public.is_group_member(pair.tester_group_id, v_user)
    and public.is_group_member(pair.developer_group_id, v_bug.assignee_id)
 ) into v_pair_ok;
 if not v_pair_ok then
  raise exception 'Vínculo tester×desenvolvedor inválido para este bug.' using errcode='42501';
 end if;
 if v_bug.status is distinct from 'pronto_reteste' then
  raise exception 'O bug precisa estar pronto para reteste.' using errcode='22023';
 end if;
 -- Transaction-local marker gates the status trigger. The row is locked and
 -- the marker is cleared before return; any failure rolls back both writes.
 perform pg_catalog.set_config('qa.retest_bug_id',p_bug_id::text,true);
 update public.qa_bugs set status=p_result,updated_at=now()
 where id=p_bug_id and status='pronto_reteste' and author_id=v_user;
 if not found then
  raise exception 'Sem permissão para atualizar o bug.' using errcode='42501';
 end if;
 insert into public.qa_retests(bug_id,tester_id,result,notes)
 values(p_bug_id,v_user,p_result,pg_catalog.btrim(p_notes)) returning * into v_retest;
 perform pg_catalog.set_config('qa.retest_bug_id','',true);
 return v_retest;
end;
$$;
revoke all on function public.qa_register_retest(uuid,text,text) from public,anon;
grant execute on function public.qa_register_retest(uuid,text,text) to authenticated;
revoke insert, update, delete on public.qa_retests from authenticated;
drop policy if exists "qa_retests_insert" on public.qa_retests;
drop policy if exists "qa_retests_delete" on public.qa_retests;
drop policy if exists qa_retests_insert_via_atomic_rpc on public.qa_retests;
create policy qa_retests_insert_via_atomic_rpc on public.qa_retests
for insert to authenticated
with check (
 tester_id = auth.uid()
 and pg_catalog.current_setting('qa.retest_bug_id',true) = bug_id::text
);
-- Gate: do not deploy before testing permissions, direct update bypasses,
-- and existing records in an isolated database. Do not duplicate mission bugs.
