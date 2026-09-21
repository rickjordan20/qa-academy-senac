-- Aula 9: staged in Git only; do not apply to the Lovable production database without approval.
-- This RPC handles qa_bugs only. Mission-entry bugs need a separate bridge and authorization design.
-- SECURITY INVOKER keeps existing RLS active. The original reporter is the tester;
-- the assigned developer must be another user. Instructor overrides require a separate audited RPC.
create or replace function public.qa_register_retest(
  p_bug_id uuid,
  p_result text,
  p_notes text
)
returns public.qa_retests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_bug public.qa_bugs%rowtype;
  v_retest public.qa_retests%rowtype;
begin
  if v_user is null then
    raise exception 'É necessário estar autenticado para registrar o reteste.' using errcode = '42501';
  end if;
  if p_result is null or p_result not in ('resolvido', 'reaberto') then
    raise exception 'Resultado de reteste inválido.' using errcode = '22023';
  end if;
  if nullif(pg_catalog.btrim(p_notes), '') is null then
    raise exception 'Descreva o resultado observado no reteste.' using errcode = '22023';
  end if;

  -- Lock the ticket to prevent concurrent retests of the same ready state.
  select * into v_bug
    from public.qa_bugs
   where id = p_bug_id
   for update;
  if not found then
    raise exception 'Bug inexistente ou acesso negado.' using errcode = '42501';
  end if;
  if v_bug.author_id is distinct from v_user or v_bug.assignee_id is null
     or v_bug.assignee_id = v_user then
    raise exception 'Somente o tester autor pode validar um bug atribuído a outro desenvolvedor.' using errcode = '42501';
  end if;
  if v_bug.status is distinct from 'pronto_reteste' then
    raise exception 'O bug precisa estar pronto para reteste.' using errcode = '22023';
  end if;

  -- Both writes are in one transaction. Any error rolls back the status and retest.
  update public.qa_bugs
     set status = p_result, updated_at = now()
   where id = p_bug_id and status = 'pronto_reteste' and author_id = v_user;
  if not found then
    raise exception 'Sem permissão para atualizar o bug.' using errcode = '42501';
  end if;
  insert into public.qa_retests (bug_id, tester_id, result, notes)
  values (p_bug_id, v_user, p_result, pg_catalog.btrim(p_notes))
  returning * into v_retest;
  return v_retest;
end;
$$;

revoke all on function public.qa_register_retest(uuid, text, text) from public, anon;
grant execute on function public.qa_register_retest(uuid, text, text) to authenticated;

-- SECURITY GATE: do not deploy until qa_bugs UPDATE/INSERT RLS and status-change
-- auditing are hardened. Existing qa_can_edit allows direct status edits and is
-- not a substitute for server-enforced developer/tester transition permissions.
