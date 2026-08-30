
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('instructor', 'student');
CREATE TYPE public.evaluation_concept AS ENUM ('A', 'PA', 'NA');
CREATE TYPE public.final_result AS ENUM ('D', 'ND');

-- UPDATED AT HELPER
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- CLASSES
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  period TEXT,
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ENROLLMENTS
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);
GRANT SELECT, INSERT, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_class_instructor(_class_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = _class_id AND c.instructor_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_class_member(_class_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.enrollments e WHERE e.class_id = _class_id AND e.student_id = _user_id);
$$;

-- true when _viewer instructs a class where _target is enrolled, or both share a class
CREATE OR REPLACE FUNCTION public.shares_class(_viewer UUID, _target UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.classes c ON c.id = e.class_id
    WHERE e.student_id = _target AND c.instructor_id = _viewer
  ) OR EXISTS (
    SELECT 1 FROM public.enrollments a
    JOIN public.enrollments b ON a.class_id = b.class_id
    WHERE a.student_id = _viewer AND b.student_id = _target
  );
$$;

-- PROFILE POLICIES
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_class(auth.uid(), id));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- USER ROLES POLICIES
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.shares_class(auth.uid(), user_id));

-- CLASS POLICIES
CREATE POLICY "classes_select" ON public.classes FOR SELECT TO authenticated
  USING (instructor_id = auth.uid() OR public.is_class_member(id, auth.uid()));
CREATE POLICY "classes_insert" ON public.classes FOR INSERT TO authenticated
  WITH CHECK (instructor_id = auth.uid() AND public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "classes_update" ON public.classes FOR UPDATE TO authenticated
  USING (instructor_id = auth.uid()) WITH CHECK (instructor_id = auth.uid());
CREATE POLICY "classes_delete" ON public.classes FOR DELETE TO authenticated
  USING (instructor_id = auth.uid());

-- ENROLLMENT POLICIES
CREATE POLICY "enrollments_select" ON public.enrollments FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_class_instructor(class_id, auth.uid()) OR public.is_class_member(class_id, auth.uid()));
CREATE POLICY "enrollments_insert" ON public.enrollments FOR INSERT TO authenticated
  WITH CHECK (public.is_class_instructor(class_id, auth.uid()));
CREATE POLICY "enrollments_delete" ON public.enrollments FOR DELETE TO authenticated
  USING (public.is_class_instructor(class_id, auth.uid()));

-- GROUPS
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qa_lead_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "groups_select" ON public.groups FOR SELECT TO authenticated
  USING (public.is_class_instructor(class_id, auth.uid()) OR public.is_class_member(class_id, auth.uid()));
CREATE POLICY "groups_insert" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (public.is_class_instructor(class_id, auth.uid()));
CREATE POLICY "groups_update" ON public.groups FOR UPDATE TO authenticated
  USING (public.is_class_instructor(class_id, auth.uid())) WITH CHECK (public.is_class_instructor(class_id, auth.uid()));
CREATE POLICY "groups_delete" ON public.groups FOR DELETE TO authenticated
  USING (public.is_class_instructor(class_id, auth.uid()));

-- GROUP MEMBERS
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_function TEXT NOT NULL DEFAULT 'Tester',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.group_class_id(_group_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT class_id FROM public.groups WHERE id = _group_id;
$$;

CREATE POLICY "group_members_select" ON public.group_members FOR SELECT TO authenticated
  USING (student_id = auth.uid()
    OR public.is_class_instructor(public.group_class_id(group_id), auth.uid())
    OR public.is_class_member(public.group_class_id(group_id), auth.uid()));
CREATE POLICY "group_members_write" ON public.group_members FOR ALL TO authenticated
  USING (public.is_class_instructor(public.group_class_id(group_id), auth.uid()))
  WITH CHECK (public.is_class_instructor(public.group_class_id(group_id), auth.uid()));

-- INDICATORS
CREATE TABLE public.indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uc_code TEXT NOT NULL,
  uc_title TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  position INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (uc_code, code)
);
GRANT SELECT ON public.indicators TO authenticated;
GRANT SELECT ON public.indicators TO anon;
GRANT ALL ON public.indicators TO service_role;
ALTER TABLE public.indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "indicators_readable" ON public.indicators FOR SELECT USING (true);

INSERT INTO public.indicators (uc_code, uc_title, code, description, position) VALUES
  ('UC10', 'Realizar testes nas aplicações desenvolvidas', 'I1', 'Identifica o tipo de teste conforme demanda.', 1),
  ('UC10', 'Realizar testes nas aplicações desenvolvidas', 'I2', 'Executa teste de carga conforme demanda.', 2),
  ('UC10', 'Realizar testes nas aplicações desenvolvidas', 'I3', 'Executa teste de funcionalidade conforme demanda.', 3),
  ('UC10', 'Realizar testes nas aplicações desenvolvidas', 'I4', 'Executa teste de usabilidade conforme demanda.', 4),
  ('UC10', 'Realizar testes nas aplicações desenvolvidas', 'I5', 'Executa teste estrutural conforme demanda.', 5),
  ('UC10', 'Realizar testes nas aplicações desenvolvidas', 'I6', 'Realiza registro do teste conforme processo estabelecido.', 6);

-- INDICATOR EVALUATIONS
CREATE TABLE public.indicator_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  concept public.evaluation_concept,
  final_result public.final_result,
  notes TEXT,
  evaluated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id, indicator_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.indicator_evaluations TO authenticated;
GRANT ALL ON public.indicator_evaluations TO service_role;
ALTER TABLE public.indicator_evaluations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER indicator_evaluations_updated_at BEFORE UPDATE ON public.indicator_evaluations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "evaluations_select" ON public.indicator_evaluations FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_class_instructor(class_id, auth.uid()));
CREATE POLICY "evaluations_write" ON public.indicator_evaluations FOR ALL TO authenticated
  USING (public.is_class_instructor(class_id, auth.uid()))
  WITH CHECK (public.is_class_instructor(class_id, auth.uid()));

-- NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN COALESCE(NEW.raw_user_meta_data ->> 'role', 'student') = 'instructor'
      THEN 'instructor'::public.app_role ELSE 'student'::public.app_role END
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
