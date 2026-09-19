-- Durable social graph and recipient-owned notifications.
-- Event keys make notification delivery safe to retry after a dropped client request.

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT friendships_distinct_users CHECK (requester_id <> addressee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_user_code_idx ON public.user_profiles (user_code);
CREATE UNIQUE INDEX IF NOT EXISTS friendships_unique_pair
  ON public.friendships (least(requester_id::text, addressee_id::text), greatest(requester_id::text, addressee_id::text));
CREATE INDEX IF NOT EXISTS friendships_requester_idx ON public.friendships (requester_id, status);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON public.friendships (addressee_id, status);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('friend_request', 'friend_request_accepted', 'workout_completed', 'achievement_unlocked')),
  event_key text,
  message text NOT NULL,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Existing installations may already have notifications from earlier social work.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS event_key text;
UPDATE public.notifications SET event_key = CONCAT('legacy:', id::text) WHERE event_key IS NULL;
ALTER TABLE public.notifications ALTER COLUMN event_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_recipient_event_key_idx
  ON public.notifications (recipient_id, event_key);
CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON public.notifications (recipient_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.ensure_current_user_profile()
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  profile public.user_profiles;
  generated_code text;
  generated_name text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  SELECT * INTO profile FROM public.user_profiles WHERE user_id = current_user_id;
  IF FOUND THEN
    RETURN profile;
  END IF;

  generated_name := COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'name',
    split_part(COALESCE(auth.jwt() ->> 'email', ''), '@', 1),
    'Athlete'
  );

  LOOP
    generated_code := 'user_' || substr(md5(current_user_id::text || clock_timestamp()::text || random()::text), 1, 8);
    BEGIN
      INSERT INTO public.user_profiles (user_id, user_code, display_name)
      VALUES (current_user_id, generated_code, generated_name)
      RETURNING * INTO profile;
      RETURN profile;
    EXCEPTION WHEN unique_violation THEN
      -- A rare code collision is retried without exposing a partial profile.
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_current_user_profile() TO authenticated;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles visible to self public users and friends" ON public.user_profiles;
CREATE POLICY "Profiles visible to self public users and friends" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_public
    OR EXISTS (
      SELECT 1 FROM public.friendships friendship
      WHERE friendship.status = 'accepted'
        AND ((friendship.requester_id = auth.uid() AND friendship.addressee_id = user_profiles.user_id)
          OR (friendship.addressee_id = auth.uid() AND friendship.requester_id = user_profiles.user_id))
    )
  );

DROP POLICY IF EXISTS "Users update their own social profile" ON public.user_profiles;
CREATE POLICY "Users update their own social profile" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friendships;
CREATE POLICY "Users can view their own friendships" ON public.friendships
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND addressee_id <> auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Recipients can respond to friend requests" ON public.friendships;
CREATE POLICY "Recipients can respond to friend requests" ON public.friendships
  FOR UPDATE TO authenticated
  USING (addressee_id = auth.uid()) WITH CHECK (addressee_id = auth.uid());

DROP POLICY IF EXISTS "Recipients can read their notifications" ON public.notifications;
CREATE POLICY "Recipients can read their notifications" ON public.notifications
  FOR SELECT TO authenticated USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Recipients can mark their notifications read" ON public.notifications;
CREATE POLICY "Recipients can mark their notifications read" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Friends can create valid notifications" ON public.notifications;
CREATE POLICY "Friends can create valid notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND recipient_id <> auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.friendships friendship
        WHERE friendship.status = 'accepted'
          AND ((friendship.requester_id = auth.uid() AND friendship.addressee_id = notifications.recipient_id)
            OR (friendship.addressee_id = auth.uid() AND friendship.requester_id = notifications.recipient_id))
      )
      OR (
        type = 'friend_request'
        AND EXISTS (
          SELECT 1 FROM public.friendships friendship
          WHERE friendship.requester_id = auth.uid()
            AND friendship.addressee_id = notifications.recipient_id
            AND friendship.status = 'pending'
        )
      )
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;
