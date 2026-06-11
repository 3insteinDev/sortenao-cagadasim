
CREATE POLICY achievements_self_write ON public.achievements
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY achievements_self_update ON public.achievements
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
