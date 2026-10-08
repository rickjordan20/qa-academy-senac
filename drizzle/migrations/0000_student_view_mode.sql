-- Sessões do modo "Ver como aluno" (uma por instrutor)
CREATE TABLE public.student_view_sessions (
  instructor_id uuid PRIMARY KEY,
  student_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours')
);
GRANT SELECT ON public.student_view_sessions TO authenticated;
GRANT ALL ON public.student_view_sessions TO service_role;
ALTER TABLE public.student_view_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Instrutor le a propria sessao de visualizacao"
  ON public.student_view_sessions FOR SELECT TO authenticated
  USING (instructor_id = auth.uid());

-- Instrutor tem simulação ativa?
CREATE OR REPLACE FUNCTION public.in_student_view(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.student_view_sessions s
    WHERE s.instructor_id = _user_id AND s.expires_at > now()
  );
$$;
REVOKE ALL ON FUNCTION public.in_student_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.in_student_view(uuid) TO authenticated;

-- Autorização atual (instrutor da turma + matrícula ativa)
CREATE OR REPLACE FUNCTION public.student_view_authorized(_instructor uuid, _student uuid, _class uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _instructor IS NOT NULL
     AND public.has_role(_instructor, 'instructor')
     AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = _class AND c.instructor_id = _instructor)
     AND EXISTS (SELECT 1 FROM public.enrollments e
                 WHERE e.class_id = _class AND e.student_id = _student AND e.status = 'active');
$$;
REVOKE ALL ON FUNCTION public.student_view_authorized(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Inicia/troca a visualização (valida no servidor)
CREATE OR REPLACE FUNCTION public.start_student_view(_student_id uuid, _class_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _name text; _class_name text;
BEGIN
  IF NOT public.student_view_authorized(_me, _student_id, _class_id) THEN
    RAISE EXCEPTION 'Acesso não autorizado a este aluno ou turma.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(nullif(trim(p.full_name), ''), 'Aluno') INTO _name FROM public.profiles p WHERE p.id = _student_id;
  SELECT c.name INTO _class_name FROM public.classes c WHERE c.id = _class_id;
  INSERT INTO public.student_view_sessions (instructor_id, student_id, class_id, started_at, expires_at)
  VALUES (_me, _student_id, _class_id, now(), now() + interval '2 hours')
  ON CONFLICT (instructor_id) DO UPDATE
    SET student_id = EXCLUDED.student_id, class_id = EXCLUDED.class_id,
        started_at = EXCLUDED.started_at, expires_at = EXCLUDED.expires_at;
  RETURN jsonb_build_object('student_id', _student_id, 'class_id', _class_id,
    'student_name', coalesce(_name, 'Aluno'), 'class_name', _class_name);
END;
$$;
REVOKE ALL ON FUNCTION public.start_student_view(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_student_view(uuid, uuid) TO authenticated;

-- Sessão atual revalidada a cada leitura (revogação encerra a sessão)
CREATE OR REPLACE FUNCTION public.get_student_view()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  s public.student_view_sessions%ROWTYPE;
  _name text; _email text; _class_name text;
BEGIN
  SELECT * INTO s FROM public.student_view_sessions WHERE instructor_id = _me;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF s.expires_at <= now() OR NOT public.student_view_authorized(_me, s.student_id, s.class_id) THEN
    DELETE FROM public.student_view_sessions WHERE instructor_id = _me;
    RETURN NULL;
  END IF;
  SELECT coalesce(nullif(trim(p.full_name), ''), 'Aluno'), p.email INTO _name, _email
    FROM public.profiles p WHERE p.id = s.student_id;
  SELECT c.name INTO _class_name FROM public.classes c WHERE c.id = s.class_id;
  RETURN jsonb_build_object('student_id', s.student_id, 'class_id', s.class_id,
    'student_name', coalesce(_name, 'Aluno'), 'student_email', coalesce(_email, ''),
    'class_name', _class_name, 'expires_at', s.expires_at);
END;
$$;
REVOKE ALL ON FUNCTION public.get_student_view() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_view() TO authenticated;

CREATE OR REPLACE FUNCTION public.end_student_view()
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.student_view_sessions WHERE instructor_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.end_student_view() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_student_view() TO authenticated;

-- Missões exatamente como o aluno simulado as vê (mesma regra da RLS do aluno)
CREATE OR REPLACE FUNCTION public.get_student_view_missions()
RETURNS SETOF public.builder_missions LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  s public.student_view_sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.student_view_sessions WHERE instructor_id = _me AND expires_at > now();
  IF NOT FOUND OR NOT public.student_view_authorized(_me, s.student_id, s.class_id) THEN
    RAISE EXCEPTION 'Visualização como aluno inativa ou não autorizada.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT m.* FROM public.builder_missions m
    WHERE public.builder_mission_visible(m.id, s.student_id)
    ORDER BY m.lesson_number ASC NULLS LAST, m.created_at ASC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_student_view_missions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_view_missions() TO authenticated;

-- Bloqueio de escrita no banco: qualquer INSERT/UPDATE/DELETE de um instrutor
-- com simulação ativa é rejeitado (inclusive dentro de RPCs SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.student_view_write_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.in_student_view(auth.uid()) THEN
    RAISE EXCEPTION 'Modo "Ver como aluno" ativo: alterações estão bloqueadas.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.student_view_write_guard() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables
           WHERE schemaname = 'public' AND tablename <> 'student_view_sessions'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS zz_student_view_guard ON public.%I', t.tablename);
    EXECUTE format('CREATE TRIGGER zz_student_view_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.student_view_write_guard()', t.tablename);
  END LOOP;
END $$;

-- Uploads também bloqueados durante a simulação
CREATE POLICY "student_view_blocks_storage_insert" ON storage.objects AS RESTRICTIVE
  FOR INSERT TO authenticated WITH CHECK (NOT public.in_student_view(auth.uid()));
CREATE POLICY "student_view_blocks_storage_update" ON storage.objects AS RESTRICTIVE
  FOR UPDATE TO authenticated USING (NOT public.in_student_view(auth.uid()));
CREATE POLICY "student_view_blocks_storage_delete" ON storage.objects AS RESTRICTIVE
  FOR DELETE TO authenticated USING (NOT public.in_student_view(auth.uid()));