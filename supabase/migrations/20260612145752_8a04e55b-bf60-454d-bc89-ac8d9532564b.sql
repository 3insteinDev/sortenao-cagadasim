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
  SELECT
    p.id,
    p.nickname,
    p.avatar_url,
    p.total_points,
    p.total_hits,
    p.prev_rank
  FROM public.profiles AS p
  WHERE p.blocked = false
  ORDER BY p.total_points DESC, p.total_hits DESC, p.nickname ASC;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_leaderboard() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO service_role;