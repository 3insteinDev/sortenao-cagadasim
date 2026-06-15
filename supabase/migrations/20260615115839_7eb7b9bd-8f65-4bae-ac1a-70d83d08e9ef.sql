
REVOKE EXECUTE ON FUNCTION public.recalculate_all_scores() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_all_scores() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_all_scores() FROM anon;
-- Apenas o service_role (usado nos server functions de admin) pode executar
GRANT EXECUTE ON FUNCTION public.recalculate_all_scores() TO service_role;

-- Como agora só roda como service_role, removemos o gate de auth.uid()
CREATE OR REPLACE FUNCTION public.recalculate_all_scores()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_count int;
BEGIN
  UPDATE public.predictions p
  SET points = CASE
    WHEN m.status <> 'finished' OR m.home_score IS NULL OR m.away_score IS NULL THEN 0
    WHEN p.home_score = m.home_score AND p.away_score = m.away_score THEN
      CASE WHEN m.phase = 'group' THEN 10 ELSE 15 END
    WHEN m.phase = 'group' THEN
      CASE
        WHEN sign(p.home_score - p.away_score) = sign(m.home_score - m.away_score) THEN
          CASE WHEN p.home_score = m.home_score OR p.away_score = m.away_score THEN 7 ELSE 5 END
        ELSE
          CASE WHEN p.home_score = m.home_score OR p.away_score = m.away_score THEN 2 ELSE 0 END
      END
    ELSE
      CASE
        WHEN sign(p.home_score - p.away_score) = sign(m.home_score - m.away_score)
             AND sign(m.home_score - m.away_score) <> 0 THEN 8
        WHEN p.home_score = m.home_score OR p.away_score = m.away_score THEN 3
        ELSE 0
      END
  END
  FROM public.matches m
  WHERE p.match_id = m.id;

  UPDATE public.tournament_predictions tp
  SET points = CASE
    WHEN EXISTS (
      SELECT 1 FROM public.tournament_results r
      WHERE r.result_type = tp.pred_type
        AND COALESCE(r.group_letter,'') = COALESCE(tp.group_letter,'')
        AND r.team_id = tp.team_id
    ) THEN
      CASE tp.pred_type
        WHEN 'group_1st' THEN 5 WHEN 'group_2nd' THEN 5 WHEN 'r16' THEN 3
        WHEN 'qf' THEN 5 WHEN 'sf' THEN 8 WHEN 'finalist' THEN 12
        WHEN 'champion' THEN 30 WHEN 'runner_up' THEN 15 WHEN 'third' THEN 10
        ELSE 0
      END
    ELSE 0
  END;

  WITH agg AS (
    SELECT user_id,
           COALESCE(SUM(points),0)::int AS pts,
           COALESCE(SUM(CASE WHEN points > 0 THEN 1 ELSE 0 END),0)::int AS hits
    FROM (
      SELECT user_id, points FROM public.predictions
      UNION ALL
      SELECT user_id, points FROM public.tournament_predictions
    ) u
    GROUP BY user_id
  )
  UPDATE public.profiles pr
  SET total_points = COALESCE(agg.pts, 0),
      total_hits = COALESCE(agg.hits, 0),
      prev_rank = NULL
  FROM agg
  WHERE pr.id = agg.user_id;

  UPDATE public.profiles
  SET total_points = 0, total_hits = 0, prev_rank = NULL
  WHERE id NOT IN (
    SELECT user_id FROM public.predictions
    UNION
    SELECT user_id FROM public.tournament_predictions
  );

  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  RETURN jsonb_build_object('ok', true, 'profiles', profile_count);
END;
$$;
