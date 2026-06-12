REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO anon, authenticated;
GRANT UPDATE (full_name, nickname, avatar_url) ON TABLE public.profiles TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.predictions FROM anon, authenticated;
GRANT SELECT ON TABLE public.predictions TO authenticated;
GRANT INSERT (user_id, match_id, home_score, away_score, submitted_at) ON TABLE public.predictions TO authenticated;
GRANT UPDATE (home_score, away_score, submitted_at) ON TABLE public.predictions TO authenticated;

DROP POLICY IF EXISTS predictions_self_write ON public.predictions;
CREATE POLICY predictions_self_write
ON public.predictions
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_id
      AND m.status = 'scheduled'
      AND m.kickoff_at > now()
  )
);

DROP POLICY IF EXISTS predictions_self_update ON public.predictions;
CREATE POLICY predictions_self_update
ON public.predictions
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_id
      AND m.status = 'scheduled'
      AND m.kickoff_at > now()
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_id
      AND m.status = 'scheduled'
      AND m.kickoff_at > now()
  )
);

REVOKE ALL PRIVILEGES ON TABLE public.tournament_predictions FROM anon, authenticated;
GRANT SELECT ON TABLE public.tournament_predictions TO authenticated;
GRANT INSERT (user_id, pred_type, group_letter, team_id, submitted_at) ON TABLE public.tournament_predictions TO authenticated;
GRANT UPDATE (pred_type, group_letter, team_id, submitted_at) ON TABLE public.tournament_predictions TO authenticated;

DROP POLICY IF EXISTS tp_self_write ON public.tournament_predictions;
CREATE POLICY tp_self_write
ON public.tournament_predictions
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.matches m WHERE m.kickoff_at <= now()
  )
);

DROP POLICY IF EXISTS tp_self_update ON public.tournament_predictions;
CREATE POLICY tp_self_update
ON public.tournament_predictions
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.matches m WHERE m.kickoff_at <= now()
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.matches m WHERE m.kickoff_at <= now()
  )
);

REVOKE ALL PRIVILEGES ON TABLE public.achievements FROM anon, authenticated;
GRANT SELECT ON TABLE public.achievements TO authenticated;
DROP POLICY IF EXISTS achievements_self_write ON public.achievements;
DROP POLICY IF EXISTS achievements_self_update ON public.achievements;

REVOKE ALL PRIVILEGES ON TABLE public.points_history FROM anon, authenticated;
GRANT SELECT ON TABLE public.points_history TO authenticated;