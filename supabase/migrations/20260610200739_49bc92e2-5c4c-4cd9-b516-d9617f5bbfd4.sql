
-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.match_phase AS ENUM ('group','r32','r16','qf','sf','third','final');
CREATE TYPE public.match_status AS ENUM ('scheduled','live','finished');
CREATE TYPE public.tp_type AS ENUM ('group_1st','group_2nd','r16','qf','sf','finalist','champion','runner_up','third');

-- =========================================================================
-- PROFILES
-- =========================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  blocked BOOLEAN NOT NULL DEFAULT false,
  predictions_submitted_at TIMESTAMPTZ,
  total_points INT NOT NULL DEFAULT 0,
  total_hits INT NOT NULL DEFAULT 0,
  prev_rank INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- =========================================================================
-- USER ROLES
-- =========================================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

-- =========================================================================
-- TEAMS / GROUPS
-- =========================================================================
CREATE TABLE public.groups (
  letter CHAR(1) PRIMARY KEY,
  name TEXT NOT NULL
);
GRANT SELECT ON public.groups TO anon, authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups_public_read" ON public.groups FOR SELECT USING (true);

CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sigla TEXT NOT NULL,
  flag TEXT NOT NULL,
  group_letter CHAR(1) REFERENCES public.groups(letter),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX teams_group_idx ON public.teams(group_letter);
GRANT SELECT ON public.teams TO anon, authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_public_read" ON public.teams FOR SELECT USING (true);
CREATE POLICY "teams_admin_write" ON public.teams FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- MATCHES
-- =========================================================================
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase public.match_phase NOT NULL,
  group_letter CHAR(1) REFERENCES public.groups(letter),
  round INT,
  match_code TEXT UNIQUE,
  home_team_id UUID REFERENCES public.teams(id),
  away_team_id UUID REFERENCES public.teams(id),
  home_placeholder TEXT,
  away_placeholder TEXT,
  kickoff_at TIMESTAMPTZ NOT NULL,
  home_score INT,
  away_score INT,
  status public.match_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX matches_phase_idx ON public.matches(phase);
CREATE INDEX matches_kickoff_idx ON public.matches(kickoff_at);
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_public_read" ON public.matches FOR SELECT USING (true);
CREATE POLICY "matches_admin_write" ON public.matches FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- PREDICTIONS (per match)
-- =========================================================================
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  home_score INT NOT NULL,
  away_score INT NOT NULL,
  points INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, match_id)
);
CREATE INDEX predictions_user_idx ON public.predictions(user_id);
CREATE INDEX predictions_match_idx ON public.predictions(match_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO authenticated;
GRANT ALL ON public.predictions TO service_role;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "predictions_public_read" ON public.predictions FOR SELECT USING (true);
CREATE POLICY "predictions_self_write" ON public.predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "predictions_self_update" ON public.predictions FOR UPDATE USING (auth.uid() = user_id);

-- =========================================================================
-- TOURNAMENT PREDICTIONS (champion, finalists, group winners...)
-- =========================================================================
CREATE TABLE public.tournament_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pred_type public.tp_type NOT NULL,
  group_letter CHAR(1),
  team_id UUID REFERENCES public.teams(id),
  points INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, pred_type, group_letter)
);
CREATE INDEX tp_user_idx ON public.tournament_predictions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_predictions TO authenticated;
GRANT ALL ON public.tournament_predictions TO service_role;
ALTER TABLE public.tournament_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tp_public_read" ON public.tournament_predictions FOR SELECT USING (true);
CREATE POLICY "tp_self_write" ON public.tournament_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tp_self_update" ON public.tournament_predictions FOR UPDATE USING (auth.uid() = user_id);

-- =========================================================================
-- TOURNAMENT RESULTS (official)
-- =========================================================================
CREATE TABLE public.tournament_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_type public.tp_type NOT NULL,
  group_letter CHAR(1),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  UNIQUE(result_type, group_letter, team_id)
);
GRANT SELECT ON public.tournament_results TO anon, authenticated;
GRANT ALL ON public.tournament_results TO service_role;
ALTER TABLE public.tournament_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tr_public_read" ON public.tournament_results FOR SELECT USING (true);
CREATE POLICY "tr_admin_write" ON public.tournament_results FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================================
-- ACHIEVEMENTS
-- =========================================================================
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  icon TEXT,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, code)
);
GRANT SELECT ON public.achievements TO anon, authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ach_public_read" ON public.achievements FOR SELECT USING (true);

-- =========================================================================
-- POINTS HISTORY
-- =========================================================================
CREATE TABLE public.points_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  points INT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ph_user_idx ON public.points_history(user_id);
GRANT SELECT ON public.points_history TO authenticated;
GRANT ALL ON public.points_history TO service_role;
ALTER TABLE public.points_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ph_self_read" ON public.points_history FOR SELECT USING (auth.uid() = user_id);

-- =========================================================================
-- SETTINGS (cup start date etc.)
-- =========================================================================
CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO anon, authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_public_read" ON public.settings FOR SELECT USING (true);
CREATE POLICY "settings_admin_write" ON public.settings FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.settings(key,value) VALUES
('cup_start', '"2026-06-11T20:00:00Z"'::jsonb),
('cup_name', '"Bolão Copa 2026"'::jsonb);

-- =========================================================================
-- AUTO PROFILE + ADMIN trigger
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, full_name, nickname)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email,'@',1))
  );
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  IF NEW.email = 'einstein.hellmeister@gmail.com' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id,'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- updated_at trigger
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
