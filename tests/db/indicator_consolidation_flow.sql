-- Teste de integração da consolidação contínua por predominância.
-- Tudo roda numa transação desfeita no final (ROLLBACK): nenhum dado real permanece alterado.
-- Uso: requer papel com escrita (o sandbox é somente leitura); foi executado via migração que aborta ao final (nada persiste).
BEGIN;
CREATE TEMP TABLE _r(n int, name text, ok boolean, info text) ON COMMIT DROP;
DO $$
DECLARE
  inst uuid := '601036bf-e953-4d59-9edb-bb26284453f0';
  s1 uuid := '67eb761e-d604-44af-9464-f75effd98e43';
  s2 uuid := 'c595db2d-6bab-4063-ad23-1464e9599c7a';
  ind uuid := (SELECT id FROM indicators WHERE code='I1' ORDER BY position LIMIT 1);
  m uuid[] := ARRAY(SELECT bm.id FROM builder_missions bm WHERE NOT EXISTS (SELECT 1 FROM builder_mission_runs r WHERE r.mission_id=bm.id AND r.student_id IN ('67eb761e-d604-44af-9464-f75effd98e43','c595db2d-6bab-4063-ad23-1464e9599c7a')) ORDER BY bm.created_at LIMIT 6);
  cls uuid; grp uuid; run uuid; ev uuid; c text; st text; x int; n int := 0;
  xp0 int := (SELECT count(*) FROM gam_xp_events);
  hist0 int; snap_before jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', inst, 'role','authenticated')::text, true);
  INSERT INTO classes(name, instructor_id) VALUES ('__teste_consolidacao__', inst) RETURNING id INTO cls;
  INSERT INTO enrollments(class_id, student_id) VALUES (cls, s1), (cls, s2);
  INSERT INTO groups(class_id, name) VALUES (cls, '__g__') RETURNING id INTO grp;
  INSERT INTO group_members(group_id, student_id) VALUES (grp, s1), (grp, s2);

  CREATE TEMP TABLE _runs(mission uuid, run uuid) ON COMMIT DROP;

  -- helper inline: avaliação individual definitiva
  CREATE OR REPLACE FUNCTION pg_temp.eval(_cls uuid, _m uuid, _s uuid, _grp uuid, _finals jsonb, _ov jsonb, _targets uuid[])
  RETURNS uuid LANGUAGE plpgsql AS $f$
  DECLARE r uuid; v int; e uuid;
  BEGIN
    SELECT run INTO r FROM _runs WHERE mission=_m;
    IF r IS NULL THEN
      INSERT INTO builder_mission_runs(mission_id, student_id, group_id, created_by, eval_status, status)
        VALUES (_m, _s, _grp, coalesce(_s, _targets[1]), 'evaluated', 'completed') RETURNING id INTO r;
      INSERT INTO _runs VALUES (_m, r);
    END IF;
    SELECT coalesce(max(version),0)+1 INTO v FROM builder_run_evaluations WHERE run_id=r;
    INSERT INTO builder_run_evaluations(run_id, mission_id, version, indicator_finals, member_overrides, target_student_ids, is_current)
      VALUES (r, _m, v, _finals, _ov, _targets, true) RETURNING id INTO e;
    UPDATE builder_run_evaluations SET is_current=false WHERE run_id=r AND version<>v;
    PERFORM consolidate_evaluation(e, _cls);
    RETURN e;
  END $f$;

  hist0 := (SELECT count(*) FROM eval_history);

  -- 1. Primeira evidência cria a célula
  PERFORM pg_temp.eval(cls, m[1], s1, NULL, '{"I1":"A"}', '{}', ARRAY[s1]);
  SELECT concept::text, consolidation_status INTO c, st FROM indicator_evaluations WHERE class_id=cls AND student_id=s1 AND indicator_id=ind;
  INSERT INTO _r VALUES (1,'primeira avaliação grava A', c='A' AND st='applied', c||'/'||st);

  -- 2. Empate mantém a menção vigente
  PERFORM pg_temp.eval(cls, m[2], s1, NULL, '{"I1":"PA"}', '{}', ARRAY[s1]);
  SELECT concept::text, consolidation_status INTO c, st FROM indicator_evaluations WHERE class_id=cls AND student_id=s1 AND indicator_id=ind;
  INSERT INTO _r VALUES (2,'empate 1A×1PA fica pendente', c='A' AND st='tie_pending', c||'/'||st);

  -- 3. Redução de A não é automática
  PERFORM pg_temp.eval(cls, m[3], s1, NULL, '{"I1":"PA"}', '{}', ARRAY[s1]);
  SELECT concept::text, consolidation_status INTO c, st FROM indicator_evaluations WHERE class_id=cls AND student_id=s1 AND indicator_id=ind;
  INSERT INTO _r VALUES (3,'moda PA sobre A vira revisão', c='A' AND st='reduction_review', c||'/'||st);

  -- 4. Reavaliação substitui o voto da missão (sem duplicar)
  PERFORM pg_temp.eval(cls, m[3], s1, NULL, '{"I1":"A"}', '{}', ARRAY[s1]);
  SELECT concept::text, consolidation_status INTO c, st FROM indicator_evaluations WHERE class_id=cls AND student_id=s1 AND indicator_id=ind;
  SELECT (consolidation_counts->>'A')::int + (consolidation_counts->>'PA')::int INTO x FROM indicator_evaluations WHERE class_id=cls AND student_id=s1 AND indicator_id=ind;
  INSERT INTO _r VALUES (4,'reavaliação troca o voto: 3 votos, 2A 1PA', c='A' AND st='unchanged' AND x=3, c||'/'||st||'/votos='||x);

  -- 5. Diferenciação individual em grupo prevalece
  PERFORM pg_temp.eval(cls, m[4], NULL, grp, '{"I1":"PA"}', jsonb_build_object(s2::text, '{"I1":"NA"}'::jsonb), ARRAY[s1,s2]);
  SELECT concept::text INTO c FROM indicator_evaluations WHERE class_id=cls AND student_id=s2 AND indicator_id=ind;
  INSERT INTO _r VALUES (5,'override individual NA para s2', c='NA', c);
  SELECT concept::text, consolidation_status INTO c, st FROM indicator_evaluations WHERE class_id=cls AND student_id=s1 AND indicator_id=ind;
  INSERT INTO _r VALUES (6,'s1 recebe PA do grupo: 2A 2PA = empate, mantém A', c='A' AND st='tie_pending', c||'/'||st);

  -- 6. Predominância inequívoca sem redução de A atualiza
  PERFORM pg_temp.eval(cls, m[5], s2, NULL, '{"I1":"PA"}', '{}', ARRAY[s2]);
  PERFORM pg_temp.eval(cls, m[6], s2, NULL, '{"I1":"PA"}', '{}', ARRAY[s2]);
  SELECT concept::text, consolidation_status INTO c, st FROM indicator_evaluations WHERE class_id=cls AND student_id=s2 AND indicator_id=ind;
  INSERT INTO _r VALUES (7,'s2 NA→PA automático (2PA 1NA)', c='PA' AND st='applied', c||'/'||st);

  -- 7. Homologação prevalece e diverge com nova evidência
  INSERT INTO indicator_homologations(class_id, student_id, indicator_id, concept, decision, reason, decided_by, decided_at)
    VALUES (cls, s2, ind, 'NA', 'override', 'Decisão docente de teste.', inst, now() - interval '1 hour');
  UPDATE indicator_evaluations SET concept='NA' WHERE class_id=cls AND student_id=s2 AND indicator_id=ind;
  PERFORM pg_temp.eval(cls, m[5], s2, NULL, '{"I1":"A"}', '{}', ARRAY[s2]);
  SELECT concept::text, consolidation_status INTO c, st FROM indicator_evaluations WHERE class_id=cls AND student_id=s2 AND indicator_id=ind;
  INSERT INTO _r VALUES (8,'homologação NA preservada e sinalizada', c='NA' AND st='divergent_after_homologation', c||'/'||st);

  -- 8. Estudante não consegue consolidar
  PERFORM set_config('request.jwt.claims', json_build_object('sub', s1, 'role','authenticated')::text, true);
  BEGIN
    PERFORM consolidate_evaluation((SELECT id FROM builder_run_evaluations WHERE run_id=(SELECT run FROM _runs LIMIT 1) LIMIT 1), cls);
    INSERT INTO _r VALUES (9,'estudante bloqueado', false, 'executou');
  EXCEPTION WHEN others THEN INSERT INTO _r VALUES (9,'estudante bloqueado', true, SQLERRM); END;
  BEGIN
    PERFORM restore_consolidation_batch('uc10-moda-2026-10-20', '4da3e03f-12c9-4823-816b-d071e10c43e7');
    INSERT INTO _r VALUES (10,'estudante não restaura lote', false, 'executou');
  EXCEPTION WHEN others THEN INSERT INTO _r VALUES (10,'estudante não restaura lote', true, SQLERRM); END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', inst, 'role','authenticated')::text, true);

  -- 9. XP intacto e histórico apenas acrescido
  INSERT INTO _r VALUES (11,'XP intacto', (SELECT count(*) FROM gam_xp_events)=xp0, '');
  INSERT INTO _r VALUES (12,'histórico acrescido', (SELECT count(*) FROM eval_history) > hist0, ((SELECT count(*) FROM eval_history)-hist0)::text);

  -- 10. Restauração do lote real (desfeita no ROLLBACK)
  snap_before := restore_consolidation_batch('uc10-moda-2026-10-20', '4da3e03f-12c9-4823-816b-d071e10c43e7');
  SELECT count(*) INTO x FROM indicator_consolidation_snapshots s JOIN indicator_evaluations ie ON ie.id=s.evaluation_id
    WHERE s.batch='uc10-moda-2026-10-20' AND ie.concept IS DISTINCT FROM s.concept_before;
  INSERT INTO _r VALUES (13,'restauração devolve as 88 menções anteriores', (snap_before->>'restored')::int=7 AND x=0, snap_before::text||' divergentes='||x);
END $$;
SELECT n, ok, name, info FROM _r ORDER BY n;
SELECT count(*) FILTER (WHERE ok) passed, count(*) FILTER (WHERE NOT ok) failed FROM _r;
ROLLBACK;
