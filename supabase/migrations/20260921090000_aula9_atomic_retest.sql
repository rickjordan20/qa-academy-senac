-- Aula 9: migration staged in Git only. Do not apply to the Lovable production database without approval.
-- Existing qa_retests references qa_bugs only; mission-entry bugs require a separate bridge design.
-- SECURITY INVOKER preserves existing qa_bugs UPDATE and qa_retests INSERT RLS policies.
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
  if nullif(btrim(p_notes), '') is null then
    raise exception 'Descreva o resultado observado no reteste.' using errcode = '22023';
  end if;

  -- Locks the row; a concurrent retest cannot validate an already finalized ticket.
  select * into v_bug
  from public.qa_bugs
  where id = p_bug_id
  for update;
  if not found then
    raise exception 'Bug inexistente ou acesso negado.' using errcode = '42501';
  end if;
  if v_bug.status <> 'pronto_reteste' then
    raise exception 'O bug precisa estar pronto para reteste.' using errcode = '22023';
  end if;
  -- Existing author/group RLS still applies to both statements; check affected row explicitly.
  update public.qa_bugs
     set status = p_result, updated_at = now()
   where id = p_bug_id and status = 'pronto_reteste';
  if not found then
    raise exception 'Sem permissão para atualizar o bug.' using errcode = '42501';
  end if;

  insert into public.qa_retests (bug_id, tester_id, result, notes)
  values (p_bug_id, v_user, p_result, btrim(p_notes))
  returning * into v_retest;
  return v_retest;
end;
$$;

revoke all on function public.qa_register_retest(uuid, text, text) from public, anon;
grant execute on function public.qa_register_retest(uuid, text, text) to authenticated;

-- This RPC is intentionally limited to qa_bugs. Do not fabricate a qa_bugs copy for mission entries.
-- Before enabling UI, add role/assignment authorization at the database layer: current qa_can_edit
-- allows authors/group managers to change status directly and does not enforce tester/developer roles.
