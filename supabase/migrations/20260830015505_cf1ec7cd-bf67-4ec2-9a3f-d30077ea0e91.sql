
CREATE OR REPLACE FUNCTION public.enroll_student_by_email(_class_id uuid, _email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student uuid;
  _enrollment uuid;
BEGIN
  IF NOT public.is_class_instructor(_class_id, auth.uid()) THEN
    RAISE EXCEPTION 'Você não é responsável por esta turma';
  END IF;

  SELECT id INTO _student FROM public.profiles WHERE lower(email) = lower(trim(_email));
  IF _student IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário cadastrado com este e-mail';
  END IF;

  INSERT INTO public.enrollments (class_id, student_id)
  VALUES (_class_id, _student)
  ON CONFLICT (class_id, student_id) DO NOTHING
  RETURNING id INTO _enrollment;

  RETURN _enrollment;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_student_by_email(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enroll_student_by_email(uuid, text) TO authenticated;
