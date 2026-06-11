
DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
DROP POLICY IF EXISTS "predictions_public_read" ON public.predictions;
DROP POLICY IF EXISTS "tp_public_read" ON public.tournament_predictions;
DROP POLICY IF EXISTS "ach_public_read" ON public.achievements;

CREATE POLICY "profiles_self_read" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_admin_read" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "predictions_self_read" ON public.predictions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "predictions_admin_read" ON public.predictions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tp_self_read" ON public.tournament_predictions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tp_admin_read" ON public.tournament_predictions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ach_self_read" ON public.achievements
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ach_admin_read" ON public.achievements
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  id uuid,
  nickname text,
  avatar_url text,
  total_points integer,
  total_hits integer,
  prev_rank integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, nickname, avatar_url, total_points, total_hits, prev_rank
  FROM public.profiles
  WHERE blocked = false
  ORDER BY total_points DESC, total_hits DESC;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_predictions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.achievements TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.tg_updated_at() FROM PUBLIC, authenticated, anon;
