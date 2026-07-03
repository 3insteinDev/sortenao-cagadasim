CREATE OR REPLACE FUNCTION public.calculate_match_prediction_points(
  _phase text,
  _status text,
  _prediction_home integer,
  _prediction_away integer,
  _result_home integer,
  _result_away integer
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _status <> 'finished' OR _result_home IS NULL OR _result_away IS NULL THEN 0
    WHEN _prediction_home = _result_home AND _prediction_away = _result_away THEN
      CASE WHEN _phase = 'group' THEN 10 ELSE 15 END
    WHEN _phase = 'group' THEN
      CASE
        WHEN sign(_prediction_home - _prediction_away) = sign(_result_home - _result_away) THEN
          CASE WHEN _prediction_home = _result_home OR _prediction_away = _result_away THEN 7 ELSE 5 END
        ELSE
          CASE WHEN _prediction_home = _result_home OR _prediction_away = _result_away THEN 2 ELSE 0 END
      END
    ELSE
      CASE
        WHEN sign(_prediction_home - _prediction_away) = sign(_result_home - _result_away)
             AND sign(_result_home - _result_away) <> 0 THEN
          CASE WHEN _prediction_home = _result_home OR _prediction_away = _result_away THEN 11 ELSE 8 END
        WHEN _prediction_home = _result_home OR _prediction_away = _result_away THEN 3
        ELSE 0
      END
  END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_profile_totals(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.profiles pr
  SET total_points = COALESCE(scores.points, 0)::int,
      total_hits = COALESCE(scores.hits, 0)::int,
      prev_rank = NULL
  FROM (
    SELECT
      COALESCE(SUM(points), 0)::int AS points,
      COALESCE(SUM(CASE WHEN points > 0 THEN 1 ELSE 0 END), 0)::int AS hits
    FROM (
      SELECT points FROM public.predictions WHERE user_id = _user_id
      UNION ALL
      SELECT points FROM public.tournament_predictions WHERE user_id = _user_id
    ) all_points
  ) scores
  WHERE pr.id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.enforce_prediction_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  match_row record;
BEGIN
  SELECT phase::text AS phase, status::text AS status, home_score, away_score
  INTO match_row
  FROM public.matches
  WHERE id = NEW.match_id;

  IF FOUND THEN
    NEW.points := public.calculate_match_prediction_points(
      match_row.phase,
      match_row.status,
      NEW.home_score,
      NEW.away_score,
      match_row.home_score,
      match_row.away_score
    );
  ELSE
    NEW.points := 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_prediction_points_before_write ON public.predictions;
CREATE TRIGGER enforce_prediction_points_before_write
BEFORE INSERT OR UPDATE OF match_id, home_score, away_score, points
ON public.predictions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_prediction_points();

CREATE OR REPLACE FUNCTION public.refresh_prediction_profile_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_profile_totals(OLD.user_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_profile_totals(NEW.user_id);
  IF TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    PERFORM public.refresh_profile_totals(OLD.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_prediction_profile_totals_after_write ON public.predictions;
CREATE TRIGGER refresh_prediction_profile_totals_after_write
AFTER INSERT OR UPDATE OF user_id, points OR DELETE
ON public.predictions
FOR EACH ROW
EXECUTE FUNCTION public.refresh_prediction_profile_totals();

CREATE OR REPLACE FUNCTION public.recalculate_predictions_for_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.predictions p
  SET points = public.calculate_match_prediction_points(
    NEW.phase::text,
    NEW.status::text,
    p.home_score,
    p.away_score,
    NEW.home_score,
    NEW.away_score
  )
  WHERE p.match_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recalculate_predictions_after_match_result ON public.matches;
CREATE TRIGGER recalculate_predictions_after_match_result
AFTER UPDATE OF phase, status, home_score, away_score
ON public.matches
FOR EACH ROW
WHEN (
  OLD.phase IS DISTINCT FROM NEW.phase OR
  OLD.status IS DISTINCT FROM NEW.status OR
  OLD.home_score IS DISTINCT FROM NEW.home_score OR
  OLD.away_score IS DISTINCT FROM NEW.away_score
)
EXECUTE FUNCTION public.recalculate_predictions_for_match();

CREATE OR REPLACE FUNCTION public.recalculate_all_scores()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  profile_count int;
BEGIN
  UPDATE public.predictions p
  SET points = public.calculate_match_prediction_points(
    m.phase::text,
    m.status::text,
    p.home_score,
    p.away_score,
    m.home_score,
    m.away_score
  )
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
        WHEN 'group_1st' THEN 5
        WHEN 'group_2nd' THEN 5
        WHEN 'group_3rd' THEN 3
        WHEN 'r32' THEN 2
        WHEN 'r16' THEN 3
        WHEN 'qf' THEN 5
        WHEN 'sf' THEN 8
        WHEN 'finalist' THEN 12
        WHEN 'champion' THEN 30
        WHEN 'runner_up' THEN 15
        WHEN 'third' THEN 10
        WHEN 'fourth_place' THEN 8
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
$function$;

SELECT public.recalculate_all_scores();