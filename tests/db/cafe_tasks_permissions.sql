-- Testes de permissão das tarefas do Café Central.
-- Tudo roda dentro de uma transação desfeita no final (ROLLBACK): nenhum dado real é alterado.
-- Uso: psql -v ON_ERROR_STOP=1 -f tests/db/cafe_tasks_permissions.sql
BEGIN;
DO $$
DECLARE
  inst uuid := '601036bf-e953-4d59-9edb-bb26284453f0';
  lead uuid := '1fbd762f-9c3d-4885-b58c-b107e668337a';
  creator uuid := '6e9e0e1e-a7b7-448e-96a8-c839efffc66a';
  assg uuid := '227f072a-648c-4755-a597-0589ab18965c';
  collab uuid := '9e985de3-c05e-4857-a579-fa364a24276b';
  member uuid := '3bfb4cc4-4a65-468d-8587-b72b62fc9066';
  outsider uuid := '9f3fb28a-3ef8-4939-bbfd-76e2b5a1a573';
  mission uuid := (SELECT id FROM builder_missions WHERE status='published' AND (opens_at IS NULL OR opens_at < now()) LIMIT 1);
  cls uuid; grp uuid; grp2 uuid; run uuid; task uuid;
  passed int := 0; failed int := 0;
  u uuid; ok boolean;

  -- helpers como closures não existem em plpgsql; usamos blocos repetidos via EXECUTE
BEGIN
  INSERT INTO classes(name, instructor_id) VALUES ('__teste_perm__', inst) RETURNING id INTO cls;
  INSERT INTO groups(class_id, name, qa_lead_id) VALUES (cls, '__g__', lead) RETURNING id INTO grp;
  INSERT INTO groups(class_id, name) VALUES (cls, '__g2__') RETURNING id INTO grp2;
  INSERT INTO group_members(group_id, student_id) VALUES (grp, creator), (grp, assg), (grp, collab), (grp, member), (grp2, outsider);
  INSERT INTO builder_mission_runs(mission_id, group_id, created_by) VALUES (mission, grp, lead) RETURNING id INTO run;
  INSERT INTO cafe_tasks(group_id, builder_run_id, mission_id, title, created_by, assignee_id)
    VALUES (grp, run, mission, 'T', creator, assg) RETURNING id INTO task;
  INSERT INTO cafe_task_collaborators(task_id, group_id, student_id, added_by) VALUES (task, grp, collab, lead);

  CREATE TEMP TABLE _exp(who text, uid uuid, upd boolean, del boolean, mng boolean) ON COMMIT DROP;
  INSERT INTO _exp VALUES
    ('instrutor', inst, true, true, true),
    ('qa_lider', lead, true, true, true),
    ('criador', creator, true, true, true),
    ('responsavel', assg, true, false, false),
    ('colaborador', collab, true, false, false),
    ('integrante', member, false, false, false),
    ('outro_grupo', outsider, false, false, false);

  -- 1) Matriz de permissões (expressões exatas das políticas)
  FOR u, ok IN SELECT e.uid, (
      (SELECT cafe_task_write_open(t.group_id, t.builder_run_id, t.run_id, e.uid) AND (can_manage_group(t.group_id, e.uid)
        OR (t.created_by = e.uid AND is_group_member(t.group_id, e.uid)) OR t.assignee_id = e.uid
        OR EXISTS (SELECT 1 FROM cafe_task_collaborators c WHERE c.task_id = t.id AND c.student_id = e.uid))
       FROM cafe_tasks t WHERE t.id = task) = e.upd
      AND (SELECT cafe_task_write_open(t.group_id, t.builder_run_id, t.run_id, e.uid) AND (can_manage_group(t.group_id, e.uid)
        OR (t.created_by = e.uid AND is_group_member(t.group_id, e.uid))) FROM cafe_tasks t WHERE t.id = task) = e.del
      AND cafe_task_can_manage(task, e.uid) = e.mng)
    FROM _exp e LOOP
    IF ok THEN passed := passed + 1; ELSE failed := failed + 1; RAISE WARNING 'FALHA matriz: %', u; END IF;
  END LOOP;

  -- 2) Campos protegidos (gatilho), com identidade simulada
  FOR u, ok IN VALUES (assg, false), (collab, false), (lead, true), (creator, true), (inst, true) LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    BEGIN
      UPDATE cafe_tasks SET assignee_id = member WHERE id = task;
      UPDATE cafe_tasks SET assignee_id = assg WHERE id = task;
      IF ok THEN passed := passed + 1; ELSE failed := failed + 1; RAISE WARNING 'FALHA: % reatribuiu', u; END IF;
    EXCEPTION WHEN insufficient_privilege THEN
      IF ok THEN failed := failed + 1; RAISE WARNING 'FALHA: % bloqueado', u; ELSE passed := passed + 1; END IF;
    END;
    BEGIN
      UPDATE cafe_tasks SET section_id = 'x' WHERE id = task;
      UPDATE cafe_tasks SET section_id = NULL WHERE id = task;
      IF ok THEN passed := passed + 1; ELSE failed := failed + 1; RAISE WARNING 'FALHA: % mudou bloco', u; END IF;
    EXCEPTION WHEN insufficient_privilege THEN
      IF ok THEN failed := failed + 1; ELSE passed := passed + 1; END IF;
    END;
  END LOOP;
  -- Atualizações legítimas do responsável/colaborador
  FOR u IN VALUES (assg), (collab) LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
    BEGIN
      UPDATE cafe_tasks SET title = 'T2', description = 'd', area = 'a', status = 'doing' WHERE id = task;
      passed := passed + 1;
    EXCEPTION WHEN OTHERS THEN failed := failed + 1; RAISE WARNING 'FALHA: % não editou detalhes: %', u, SQLERRM; END;
  END LOOP;
  -- Vínculos estruturais imutáveis para todos (inclusive QA Líder e instrutor)
  FOR u IN VALUES (lead), (inst), (creator) LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
    BEGIN
      UPDATE cafe_tasks SET group_id = grp2 WHERE id = task;
      failed := failed + 1; RAISE WARNING 'FALHA: % trocou grupo', u;
    EXCEPTION WHEN insufficient_privilege THEN passed := passed + 1; END;
    BEGIN
      UPDATE cafe_tasks SET created_by = u WHERE id = task;
      IF u = creator THEN passed := passed + 1; ELSE failed := failed + 1; RAISE WARNING 'FALHA: % trocou autoria', u; END IF;
    EXCEPTION WHEN insufficient_privilege THEN passed := passed + 1; END;
  END LOOP;

  -- 3) Criador que saiu da equipe perde a gestão
  DELETE FROM group_members WHERE group_id = grp AND student_id = creator;
  IF NOT cafe_task_can_manage(task, creator) THEN passed := passed + 1; ELSE failed := failed + 1; RAISE WARNING 'FALHA: ex-integrante gerencia'; END IF;
  INSERT INTO group_members(group_id, student_id) VALUES (grp, creator);

  -- 4) Missão bloqueada (em avaliação / avaliada / reavaliação)
  PERFORM set_config('request.jwt.claims', '', true);
  FOR ok IN VALUES (true) LOOP END LOOP;
  DECLARE st text; BEGIN
    FOREACH st IN ARRAY ARRAY['in_review','evaluated','reeval'] LOOP
      UPDATE builder_mission_runs SET eval_status = st WHERE id = run;
      FOR u IN VALUES (lead), (creator), (assg), (collab) LOOP
        IF NOT cafe_task_write_open(grp, run, NULL, u) AND NOT cafe_task_can_manage(task, u)
          THEN passed := passed + 1; ELSE failed := failed + 1; RAISE WARNING 'FALHA: % escreve em %', u, st; END IF;
      END LOOP;
      IF cafe_task_write_open(grp, run, NULL, inst) THEN passed := passed + 1; ELSE failed := failed + 1; RAISE WARNING 'FALHA: instrutor bloqueado em %', st; END IF;
    END LOOP;
    UPDATE builder_mission_runs SET eval_status = 'revision' WHERE id = run;
    IF cafe_task_write_open(grp, run, NULL, assg) THEN passed := passed + 1; ELSE failed := failed + 1; RAISE WARNING 'FALHA: revisão não reabriu'; END IF;
  END;

  RAISE NOTICE 'RESULTADO: % aprovados, % falhas', passed, failed;
  IF failed > 0 THEN RAISE EXCEPTION 'Testes falharam'; END IF;
END $$;
ROLLBACK;
