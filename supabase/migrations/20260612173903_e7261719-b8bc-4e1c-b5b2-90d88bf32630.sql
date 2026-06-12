GRANT SELECT ON public.predictions TO authenticated;
GRANT SELECT ON public.tournament_predictions TO authenticated;
GRANT SELECT ON public.matches TO authenticated;
GRANT SELECT ON public.leaderboard_entries TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.achievements TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

GRANT ALL ON public.predictions TO service_role;
GRANT ALL ON public.tournament_predictions TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.achievements TO service_role;
GRANT ALL ON public.matches TO service_role;
GRANT ALL ON public.leaderboard_entries TO service_role;
GRANT ALL ON public.user_roles TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.predictions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.tournament_predictions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.achievements FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.leaderboard_entries FROM authenticated, anon;