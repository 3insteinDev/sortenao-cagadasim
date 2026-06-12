DROP POLICY IF EXISTS predictions_self_write ON public.predictions;
CREATE POLICY predictions_self_write
ON public.predictions
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

DROP POLICY IF EXISTS tp_self_write ON public.tournament_predictions;
CREATE POLICY tp_self_write
ON public.tournament_predictions
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

ALTER FUNCTION public.get_leaderboard() SECURITY INVOKER;