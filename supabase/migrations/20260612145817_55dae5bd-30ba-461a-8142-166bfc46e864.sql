CREATE TABLE public.leaderboard_entries (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  avatar_url text,
  total_points integer NOT NULL DEFAULT 0,
  total_hits integer NOT NULL DEFAULT 0,
  prev_rank integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.leaderboard_entries TO authenticated;
GRANT ALL ON public.leaderboard_entries TO service_role;

ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view leaderboard"
ON public.leaderboard_entries
FOR SELECT
TO authenticated
USING (true);

INSERT INTO public.leaderboard_entries (
  id, nickname, avatar_url, total_points, total_hits, prev_rank, updated_at
)
SELECT
  id,
  nickname,
  avatar_url,
  total_points,
  total_hits,
  prev_rank,
  now()
FROM public.profiles
WHERE blocked = false;

CREATE OR REPLACE FUNCTION public.sync_leaderboard_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.leaderboard_entries WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.blocked THEN
    DELETE FROM public.leaderboard_entries WHERE id = NEW.id;
  ELSE
    INSERT INTO public.leaderboard_entries (
      id, nickname, avatar_url, total_points, total_hits, prev_rank, updated_at
    )
    VALUES (
      NEW.id, NEW.nickname, NEW.avatar_url, NEW.total_points, NEW.total_hits, NEW.prev_rank, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      nickname = EXCLUDED.nickname,
      avatar_url = EXCLUDED.avatar_url,
      total_points = EXCLUDED.total_points,
      total_hits = EXCLUDED.total_hits,
      prev_rank = EXCLUDED.prev_rank,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_leaderboard_entry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_leaderboard_entry() TO service_role;

CREATE TRIGGER sync_leaderboard_after_profile_change
AFTER INSERT OR UPDATE OF nickname, avatar_url, total_points, total_hits, prev_rank, blocked OR DELETE
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_leaderboard_entry();

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
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.nickname,
    l.avatar_url,
    l.total_points,
    l.total_hits,
    l.prev_rank
  FROM public.leaderboard_entries AS l
  ORDER BY l.total_points DESC, l.total_hits DESC, l.nickname ASC;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO service_role;