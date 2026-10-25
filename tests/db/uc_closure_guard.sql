-- Teste do fechamento D/ND com dados fictícios; termina com RAISE, então tudo é desfeito.
DO $$
DECLARE _ins uuid; _stu uuid; _c uuid; _i1 uuid; _i2 uuid; _log text := '';
BEGIN
  SELECT user_id INTO _ins FROM user_roles WHERE role='instructor' LIMIT 1;
  SELECT user_id INTO _stu FROM user_roles WHERE role='student' LIMIT 1;
  INSERT INTO indicators(uc_code,uc_title,code,description,position) VALUES ('UCTESTE','T','T1','t',1) RETURNING id INTO _i1;
  INSERT INTO indicators(uc_code,uc_title,code,description,position) VALUES ('UCTESTE','T','T2','t',2) RETURNING id INTO _i2;
  INSERT INTO classes(name,instructor_id,uc_code) VALUES ('fict',_ins,'UCTESTE') RETURNING id INTO _c;
  INSERT INTO indicator_evaluations(class_id,student_id,indicator_id,concept,stage) VALUES (_c,_stu,_i1,'A','final'),(_c,_stu,_i2,'PA','final');
  BEGIN INSERT INTO uc_results(class_id,student_id,final_result,notes) VALUES (_c,_stu,'D',''); _log:=_log||'D-com-PA:PERMITIDO(ERRO) ';
  EXCEPTION WHEN others THEN _log:=_log||'D-com-PA:bloqueado ✓ '; END;
  BEGIN INSERT INTO uc_results(class_id,student_id,final_result,notes) VALUES (_c,_stu,'ND','curta'); _log:=_log||'ND-antecipado-sem-just:PERMITIDO(ERRO) ';
  EXCEPTION WHEN others THEN _log:=_log||'ND-antecipado-sem-just:bloqueado ✓ '; END;
  INSERT INTO uc_results(class_id,student_id,final_result,notes) VALUES (_c,_stu,'ND','Encerramento excepcional justificado pelo docente');
  _log:=_log||'ND-antecipado-justificado:aceito ✓ ';
  UPDATE indicator_evaluations SET concept='A' WHERE class_id=_c AND indicator_id=_i2;
  _log:=_log||'pos-fechamento resultado='||(SELECT final_result FROM uc_results WHERE class_id=_c)||' (preservado) ';
  _log:=_log||'auditoria='||(SELECT count(*) FROM audit_log WHERE entity='uc_results' AND new_value->>'class_id'=_c::text)||' ';
  BEGIN UPDATE uc_results SET final_result='D', confirmed_at=now() WHERE class_id=_c; _log:=_log||'re-homologar D com todos A: aceito ✓';
  EXCEPTION WHEN others THEN _log:=_log||'re-homologar D:ERRO '||SQLERRM; END;
  RAISE EXCEPTION 'ROLLBACK_OK %', _log;
END $$;
