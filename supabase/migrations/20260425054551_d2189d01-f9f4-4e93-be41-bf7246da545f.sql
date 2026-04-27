
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  grade TEXT,
  subjects TEXT[] DEFAULT '{}',
  learning_goal TEXT,
  streak_days INT NOT NULL DEFAULT 0,
  total_xp INT NOT NULL DEFAULT 0,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles select own or admin" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Topics
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  grade TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topics readable by authenticated" ON public.topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage topics" ON public.topics FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Materials (uploaded notes/pdfs/images)
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  extracted_text TEXT,
  ai_summary TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "materials own select" ON public.materials FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "materials own insert" ON public.materials FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "materials own update" ON public.materials FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "materials own delete" ON public.materials FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Quiz attempts
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  topic_title TEXT,
  mode TEXT NOT NULL DEFAULT 'adaptive',
  difficulty TEXT NOT NULL DEFAULT 'medium',
  score INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa own" ON public.quiz_attempts FOR ALL TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid()=user_id);

CREATE TABLE public.quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'mcq',
  options JSONB,
  correct_answer TEXT,
  user_answer TEXT,
  is_correct BOOLEAN,
  difficulty TEXT,
  critic_feedback TEXT,
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ans own" ON public.quiz_answers FOR ALL TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid()=user_id);

-- Performance
CREATE TABLE public.performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  mastery NUMERIC NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  correct INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject, topic)
);
ALTER TABLE public.performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf own" ON public.performance FOR ALL TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid()=user_id);

-- Chats
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  context_material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs own" ON public.chat_sessions FOR ALL TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid()=user_id);

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB,
  critic_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cm own" ON public.chat_messages FOR ALL TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid()=user_id);

-- Recommendations
CREATE TABLE public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT,
  payload JSONB,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rec own" ON public.recommendations FOR ALL TO authenticated USING (auth.uid()=user_id OR public.has_role(auth.uid(),'admin')) WITH CHECK (auth.uid()=user_id);

-- Storage bucket for materials (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('materials','materials', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "materials storage select own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='materials' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "materials storage insert own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='materials' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "materials storage update own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='materials' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "materials storage delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='materials' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Seed a few topics
INSERT INTO public.topics (subject, grade, title, summary, difficulty, tags) VALUES
('Mathematics','10','Quadratic Equations','Forms, roots, discriminant, and applications.','medium','{algebra,roots}'),
('Mathematics','10','Trigonometry Basics','Ratios, identities, and right-triangle problems.','medium','{geometry,ratios}'),
('Physics','10','Newton''s Laws of Motion','Three laws with everyday examples and problems.','medium','{mechanics}'),
('Chemistry','10','Periodic Table','Trends across periods and groups.','easy','{atoms}'),
('Biology','10','Cell Structure','Eukaryotic vs prokaryotic cells and organelles.','easy','{cells}'),
('Computer Science','11','Data Structures','Arrays, lists, stacks, queues, trees.','hard','{cs,ds}');
