-- ============================================================================
-- Migration: 20260903_cardio_and_pr_refactor.sql
-- Description:
--   1. Decouples cardio exercises from strength requirements (nullable target_muscle,
--      nullable is_unilateral, introduces exercise_category discriminator).
--   2. Provides multi-type PR evaluation function/trigger in PostgreSQL for
--      evaluating Normal, Failure, and Drop sets while excluding Warmups.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Exercise Schema Decoupling (Cardio Support)
-- ----------------------------------------------------------------------------

-- Allow target_muscle to be NULL for cardio exercises
ALTER TABLE IF EXISTS exercises 
  ALTER COLUMN target_muscle DROP NOT NULL;

-- Allow is_unilateral to be NULL with DEFAULT false
ALTER TABLE IF EXISTS exercises 
  ALTER COLUMN is_unilateral DROP NOT NULL,
  ALTER COLUMN is_unilateral SET DEFAULT false;

-- Add explicit discriminator for exercise category
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'exercises' AND column_name = 'exercise_category'
  ) THEN
    ALTER TABLE exercises 
      ADD COLUMN exercise_category text DEFAULT 'strength' 
      CHECK (exercise_category IN ('strength', 'cardio', 'mobility'));
  END IF;
END $$;

-- Migrate existing Cardio exercises to 'cardio' exercise_category
UPDATE exercises 
SET exercise_category = 'cardio' 
WHERE LOWER(category) = 'cardio' AND (exercise_category IS NULL OR exercise_category != 'cardio');

-- ----------------------------------------------------------------------------
-- 2. PostgreSQL Helper: Multi-Type Personal Record (PR) Evaluator
-- ----------------------------------------------------------------------------

-- Ingests Normal, Failure, and Drop sets. Defaults NULL set_type to 'normal'.
-- Excludes Warmup sets and secondary drop sets ('dropset_child').
CREATE OR REPLACE FUNCTION is_set_eligible_for_pr(p_set_type text)
RETURNS boolean AS $$
BEGIN
  -- Default NULL to 'normal' for backwards compatibility with legacy rows
  IF p_set_type IS NULL OR p_set_type = '' THEN
    RETURN true;
  END IF;
  
  RETURN LOWER(p_set_type) IN ('normal', 'failure', 'drop', 'dropset');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate the maximum personal record for a given user and exercise
CREATE OR REPLACE FUNCTION get_user_exercise_pr(p_user_id uuid, p_exercise_id text)
RETURNS numeric AS $$
DECLARE
  v_max_weight numeric := 0;
  v_rec record;
  v_set jsonb;
  v_set_type text;
  v_is_completed boolean;
  v_weight numeric;
BEGIN
  -- Iterate through user's workouts ordered by start_time descending
  FOR v_rec IN 
    SELECT exercises 
    FROM workouts 
    WHERE user_id = p_user_id AND exercises IS NOT NULL
  LOOP
    -- Iterate through exercise array in JSONB
    FOR v_set IN 
      SELECT s.value
      FROM jsonb_array_elements(v_rec.exercises) ex,
           jsonb_array_elements(ex->'sets') s
      WHERE ex->>'exerciseId' = p_exercise_id
    LOOP
      v_is_completed := COALESCE((v_set->>'isCompleted')::boolean, false);
      v_set_type := v_set->>'type';
      v_weight := COALESCE((v_set->>'weight')::numeric, 0);

      -- Check PR eligibility and completion
      IF v_is_completed AND is_set_eligible_for_pr(v_set_type) THEN
        IF v_weight > v_max_weight THEN
          v_max_weight := v_weight;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_max_weight;
END;
$$ LANGUAGE plpgsql STABLE;

