-- Additive: no existing exercise, workout, or set is rewritten.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE public.exercise_settings (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  starting_resistance numeric NOT NULL DEFAULT 0 CHECK (starting_resistance BETWEEN 0 AND 10000),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 500),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exercise_id)
);
CREATE INDEX exercise_settings_exercise_id_idx ON public.exercise_settings(exercise_id);
ALTER TABLE public.exercise_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exercise_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_settings TO authenticated;
GRANT ALL ON public.exercise_settings TO service_role;
CREATE POLICY exercise_settings_read_own ON public.exercise_settings FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY exercise_settings_insert_own ON public.exercise_settings FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.exercises e WHERE e.id = exercise_id AND (e.user_id IS NULL OR e.user_id = (SELECT auth.uid()))));
CREATE POLICY exercise_settings_update_own ON public.exercise_settings FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.exercises e WHERE e.id = exercise_id AND (e.user_id IS NULL OR e.user_id = (SELECT auth.uid()))));
CREATE POLICY exercise_settings_delete_own ON public.exercise_settings FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Definitions can only be edited by their creator; defaults remain read-only.
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.exercises FROM PUBLIC, anon, authenticated;
-- Replace the deployed equivalents rather than adding overlapping SELECT/INSERT policies.
DROP POLICY IF EXISTS "Read exercises" ON public.exercises;
DROP POLICY IF EXISTS "Insert exercises" ON public.exercises;
CREATE POLICY exercise_edit_select ON public.exercises FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = (SELECT auth.uid()));
CREATE POLICY exercise_edit_insert ON public.exercises FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY exercise_edit_update ON public.exercises FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT ON public.exercises TO authenticated;
GRANT UPDATE (name, category, target_muscle, is_unilateral) ON public.exercises TO authenticated;

CREATE FUNCTION public.save_exercise_settings(p_exercise uuid, p_starting_resistance numeric, p_notes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved public.exercise_settings;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to save exercise settings'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.exercises WHERE id = p_exercise AND (user_id IS NULL OR user_id = auth.uid())) THEN
    RAISE EXCEPTION 'Exercise is not available to this account';
  END IF;
  INSERT INTO public.exercise_settings(user_id, exercise_id, starting_resistance, notes)
    VALUES (auth.uid(), p_exercise, COALESCE(p_starting_resistance, 0), COALESCE(p_notes, ''))
    ON CONFLICT(user_id, exercise_id) DO UPDATE SET
      starting_resistance = COALESCE(p_starting_resistance, exercise_settings.starting_resistance),
      notes = COALESCE(p_notes, exercise_settings.notes), updated_at = now()
    RETURNING * INTO saved;
  RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION public.save_exercise_settings(uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_exercise_settings(uuid,numeric,text) TO authenticated;

CREATE FUNCTION public.save_custom_exercise(p_id uuid, p_name text, p_category text, p_target text,
  p_unilateral boolean, p_starting_resistance numeric, p_notes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE saved public.exercises; old public.exercises; settings jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to save an exercise'; END IF;
  IF p_name IS NULL OR char_length(trim(p_name)) NOT BETWEEN 1 AND 100 OR p_category IS NULL OR char_length(trim(p_category)) NOT BETWEEN 1 AND 60
    OR char_length(COALESCE(p_target,'')) > 60 THEN RAISE EXCEPTION 'Invalid exercise name, type or muscle'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.exercises(user_id,name,category,target_muscle,is_unilateral)
      VALUES(auth.uid(),trim(p_name),trim(p_category),p_target,COALESCE(p_unilateral,false)) RETURNING * INTO saved;
  ELSE
    SELECT * INTO old FROM public.exercises WHERE id = p_id AND user_id = auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Only exercises you created can be edited'; END IF;
    IF (old.category IS DISTINCT FROM trim(p_category) OR COALESCE(old.is_unilateral,false) IS DISTINCT FROM COALESCE(p_unilateral,false))
      AND EXISTS(SELECT 1 FROM public.workouts WHERE user_id=auth.uid() AND exercises::text LIKE '%' || p_id::text || '%') THEN
      RAISE EXCEPTION 'This exercise has workout history. Keep its type and left/right tracking unchanged; you can still edit its name, muscle, notes and starting resistance.';
    END IF;
    UPDATE public.exercises SET name=trim(p_name),category=trim(p_category),target_muscle=p_target,is_unilateral=COALESCE(p_unilateral,false)
      WHERE id=p_id AND user_id=auth.uid() RETURNING * INTO saved;
  END IF;
  settings := public.save_exercise_settings(saved.id,p_starting_resistance,p_notes);
  RETURN to_jsonb(saved) || jsonb_build_object('starting_resistance',settings->'starting_resistance','notes',settings->'notes');
END $$;
REVOKE ALL ON FUNCTION public.save_custom_exercise(uuid,text,text,text,boolean,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_custom_exercise(uuid,text,text,text,boolean,numeric,text) TO authenticated;
