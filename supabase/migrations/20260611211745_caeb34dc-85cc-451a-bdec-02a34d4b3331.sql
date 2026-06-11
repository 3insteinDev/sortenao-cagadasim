
-- 1) Move pg_net out of public (no SET SCHEMA support -> drop & recreate)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2) Admin-only DML on achievements
DROP POLICY IF EXISTS achievements_admin_write ON public.achievements;
CREATE POLICY achievements_admin_write ON public.achievements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Admin-only DML on points_history
DROP POLICY IF EXISTS points_history_admin_write ON public.points_history;
CREATE POLICY points_history_admin_write ON public.points_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Restrict write policies to authenticated role
ALTER POLICY predictions_self_write ON public.predictions TO authenticated;
ALTER POLICY predictions_self_update ON public.predictions TO authenticated;
ALTER POLICY tp_self_write ON public.tournament_predictions TO authenticated;
ALTER POLICY tp_self_update ON public.tournament_predictions TO authenticated;
ALTER POLICY profiles_self_update ON public.profiles TO authenticated;
