-- Custom exercises are private rows. Permit the owner to remove only their own rows.
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete their own custom exercises" ON public.exercises;
CREATE POLICY "Users can delete their own custom exercises"
  ON public.exercises
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
