REVOKE ALL ON FUNCTION public.enforce_prediction_points() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_prediction_profile_totals() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_predictions_for_match() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_profile_totals(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.recalculate_all_scores() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_scores() TO service_role;

GRANT EXECUTE ON FUNCTION public.enforce_prediction_points() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_prediction_profile_totals() TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_predictions_for_match() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_profile_totals(uuid) TO service_role;