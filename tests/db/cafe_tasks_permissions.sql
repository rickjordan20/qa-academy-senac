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

  -- 2) Campos protegidos (mesma função usada pelo gatilho BEFORE UPDATE)
  DECLARE o cafe_tasks; o2 cafe_tasks; n cafe_tasks; fld text; BEGIN
    SELECT * INTO o FROM cafe_tasks WHERE id = task;
    FOR u, ok IN VALUES (assg, false), (collab, false), (lead, true), (creator, true), (inst, true), (member, false) LOOP
      FOREACH fld IN ARRAY ARRAY['assignee','section','position'] LOOP
        n := o;
        IF fld = 'assignee' THEN n.assignee_id := member;
        ELSIF fld = 'section' THEN n.section_id := 'x';
        ELSE n.position := o.position + 1; END IF;
        IF (cafe_task_update_violation(o, n, u) IS NULL) = ok THEN passed := passed + 1;
        ELSE failed := failed + 1; RAISE WARNING 'FALHA campo % por %', fld, u; END IF;
      END LOOP;
    END LOOP;
    -- Atualizações legítimas de detalhes por responsável/colaborador
    n := o; n.title := 'T2'; n.description := 'd'; n.area := 'a'; n.status := 'doing'; n.feature_id := NULL; n.module_id := NULL;
    FOR u IN VALUES (assg), (collab) LOOP
      IF cafe_task_update_violation(o, n, u) IS NULL THEN passed := passed + 1;
      ELSE failed := failed + 1; RAISE WARNING 'FALHA: % não edita detalhes', u; END IF;
    END LOOP;
    -- Vínculos estruturais imutáveis para todos
    FOR u IN VALUES (lead), (inst), (creator), (assg) LOOP
      FOREACH fld IN ARRAY ARRAY['group','created_by','builder_run','mission','run'] LOOP
        n := o;
        IF fld = 'group' THEN n.group_id := grp2;
        ELSIF fld = 'created_by' THEN n.created_by := outsider;
        ELSIF fld = 'builder_run' THEN n.builder_run_id := NULL;
        ELSIF fld = 'mission' THEN n.mission_id := NULL;
        ELSE n.run_id := gen_random_uuid(); END IF;
        IF cafe_task_update_violation(o, n, u) IS NOT NULL THEN passed := passed + 1;
        ELSE failed := failed + 1; RAISE WARNING 'FALHA: % alterou %', u, fld; END IF;
      END LOOP;
    END LOOP;
    -- 3) Autor que não é mais integrante da equipe perde a gestão
    o2 := o; o2.created_by := outsider; n := o2; n.assignee_id := member;
    IF cafe_task_update_violation(o2, n, outsider) IS NOT NULL THEN passed := passed + 1;
    ELSE failed := failed + 1; RAISE WARNING 'FALHA: ex-integrante redistribuiu'; END IF;
  END;
  DECLARE t2 uuid; BEGIN
    INSERT INTO cafe_tasks(group_id, builder_run_id, mission_id, title, created_by)
      VALUES (grp, run, mission, 'T-ex', outsider) RETURNING id INTO t2;
    IF NOT cafe_task_can_manage(t2, outsider) THEN passed := passed + 1; ELSE failed := failed + 1; RAISE WARNING 'FALHA: ex-integrante gerencia'; END IF;
  END;

  -- 4) Missão bloqueada (em avaliação / avaliada / reavaliação) e reabertura em revisão
  DECLARE st text; r2 uuid; t3 uuid; BEGIN
    FOREACH st IN ARRAY ARRAY['in_review','evaluated','reeval','revision'] LOOP
      INSERT INTO builder_mission_runs(mission_id, group_id, created_by, eval_status) VALUES (mission, grp2, lead, st) RETURNING id INTO r2;
      INSERT INTO cafe_tasks(group_id, builder_run_id, mission_id, title, created_by, assignee_id)
        VALUES (grp, r2, mission, 'T-'||st, creator, assg) RETURNING id INTO t3;
      UPDATE builder_mission_runs SET group_id = grp WHERE id = r2;
      FOR u IN VALUES (lead), (creator), (assg), (collab) LOOP
        IF (cafe_task_write_open(grp, r2, NULL, u) OR cafe_task_can_manage(t3, u)) = (st = 'revision')
          THEN passed := passed + 1; ELSE failed := failed + 1; RAISE WARNING 'FALHA: % em %', u, st; END IF;
      END LOOP;
      IF cafe_task_write_open(grp, r2, NULL, inst) AND cafe_task_can_manage(t3, inst) THEN passed := passed + 1;
      ELSE failed := failed + 1; RAISE WARNING 'FALHA: instrutor bloqueado em %', st; END IF;
    END LOOP;
  END;

  RAISE NOTICE 'RESULTADO: % aprovados, % falhas', passed, failed;
  IF failed > 0 THEN RAISE EXCEPTION 'Testes falharam'; END IF;
END $$;
ROLLBACK;
