-- Additive notification rebuild. Apply after the social notifications migration.
-- No history backfill emits events. No external HTTP runs in workout transactions.
BEGIN;
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS notification_source text NOT NULL DEFAULT 'historical';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'friend_achievement';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Notification';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body text NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_id text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS in_app_visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN
 ('friend_request','friend_request_accepted','workout_completed','achievement_unlocked','personal_record','level_up','streak_milestone','workout_reminder','test_push'));
UPDATE public.notifications SET category=CASE WHEN type IN ('friend_request','friend_request_accepted') THEN 'friend_request'
 WHEN type='workout_completed' THEN 'friend_workout' ELSE 'friend_achievement' END,
 body=message, title=CASE WHEN type='workout_completed' THEN 'Workout completed' WHEN type='friend_request' THEN 'Friend request'
 WHEN type='friend_request_accepted' THEN 'Request accepted' ELSE 'Achievement unlocked' END
 WHERE title='Notification';
CREATE INDEX IF NOT EXISTS notifications_inbox_idx ON public.notifications(recipient_id,created_at DESC,id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications(recipient_id) WHERE read_at IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_category_idx ON public.notifications(recipient_id,category,created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE public.notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
 push_enabled boolean NOT NULL DEFAULT false,
 in_app jsonb NOT NULL DEFAULT '{"personal_pr":true,"personal_level":true,"personal_achievement":true,"personal_streak":true,"workout_reminder":true,"friend_workout":true,"friend_request":true,"friend_pr":true,"friend_achievement":true}',
 push jsonb NOT NULL DEFAULT '{"personal_pr":true,"personal_level":true,"personal_achievement":true,"personal_streak":true,"workout_reminder":true,"friend_workout":true,"friend_request":true,"friend_pr":true,"friend_achievement":true}',
 share_activity boolean NOT NULL DEFAULT true,
 reminder_days integer[] NOT NULL DEFAULT '{}',
 reminder_time text NOT NULL DEFAULT '18:00', timezone text NOT NULL DEFAULT 'UTC',
 quiet_enabled boolean NOT NULL DEFAULT false, quiet_start text NOT NULL DEFAULT '22:00', quiet_end text NOT NULL DEFAULT '08:00',
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (reminder_days <@ ARRAY[0,1,2,3,4,5,6]),
 CHECK (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 CHECK (quiet_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND quiet_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
CREATE FUNCTION public.validate_notification_preferences() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE k text; v jsonb;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(NEW.in_app) UNION ALL SELECT * FROM jsonb_each(NEW.push) LOOP
  IF k NOT IN ('personal_pr','personal_level','personal_achievement','personal_streak','workout_reminder','friend_workout','friend_request','friend_pr','friend_achievement')
   OR jsonb_typeof(v)<>'boolean' THEN RAISE EXCEPTION 'Invalid category preference'; END IF;
 END LOOP;
 NEW.updated_at=now(); RETURN NEW;
END $$;
CREATE TRIGGER validate_notification_preferences BEFORE INSERT OR UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.validate_notification_preferences();
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_preferences_owner ON public.notification_preferences FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
REVOKE ALL ON public.notification_preferences FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.notification_preferences TO authenticated;

CREATE TABLE public.push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
 install_id uuid NOT NULL, endpoint text NOT NULL UNIQUE CHECK(length(endpoint)<=2048),
 p256dh text NOT NULL, auth text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 last_success_at timestamptz, invalidated_at timestamptz
);
CREATE INDEX push_subscriptions_owner_idx ON public.push_subscriptions(user_id) WHERE invalidated_at IS NULL;
CREATE UNIQUE INDEX push_install_active_idx ON public.push_subscriptions(user_id,install_id) WHERE invalidated_at IS NULL;
CREATE TABLE public.notification_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_key text NOT NULL UNIQUE,
 actor_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE, kind text NOT NULL,
 source_id text NOT NULL, snapshot jsonb NOT NULL DEFAULT '{}', occurred_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz, attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 lease_id uuid, lease_until timestamptz, last_error text
);
CREATE INDEX notification_events_pending_idx ON public.notification_events(available_at) WHERE processed_at IS NULL;
CREATE TABLE public.push_delivery_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), notification_id uuid NOT NULL REFERENCES public.notifications ON DELETE CASCADE,
 subscription_id uuid NOT NULL REFERENCES public.push_subscriptions ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','accepted','failed','skipped')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours', lease_id uuid, lease_until timestamptz,
 attempted_at timestamptz, accepted_at timestamptz, last_status integer, UNIQUE(notification_id,subscription_id)
);
CREATE INDEX push_delivery_pending_idx ON public.push_delivery_jobs(available_at) WHERE state='pending';
CREATE TABLE public.notification_rate_limits (user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE, bucket text NOT NULL, window_at timestamptz NOT NULL, requests integer NOT NULL DEFAULT 1, PRIMARY KEY(user_id,bucket,window_at));
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_delivery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions,public.notification_events,public.push_delivery_jobs,public.notification_rate_limits FROM anon,authenticated;
GRANT ALL ON public.push_subscriptions,public.notification_events,public.push_delivery_jobs,public.notification_rate_limits,public.notification_preferences,public.notifications TO service_role;

-- Clients can no longer forge recipient or milestone events, or edit notification content.
DROP POLICY IF EXISTS "Friends can create valid notifications" ON public.notifications;
-- Legacy Supabase projects may grant TRUNCATE/TRIGGER as well as normal CRUD.
-- RLS does not protect TRUNCATE: retain only the recipient SELECT permission.
REVOKE ALL ON public.notifications FROM anon,authenticated;
GRANT SELECT ON public.notifications TO authenticated;
CREATE FUNCTION public.notification_state(p_id uuid DEFAULT NULL, p_action text DEFAULT 'read') RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE affected integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_action NOT IN ('read','unread','delete','clear') THEN RAISE EXCEPTION 'Invalid action'; END IF;
 IF p_action IN ('unread','delete') AND p_id IS NULL THEN RAISE EXCEPTION 'An id is required'; END IF;
 UPDATE notifications SET read_at=CASE WHEN p_action='read' THEN COALESCE(read_at,now()) WHEN p_action='unread' THEN NULL ELSE read_at END,
 deleted_at=CASE WHEN p_action IN ('delete','clear') THEN now() ELSE deleted_at END
 WHERE recipient_id=auth.uid() AND deleted_at IS NULL AND (p_id IS NULL OR id=p_id);
 GET DIAGNOSTICS affected=ROW_COUNT; RETURN affected;
END $$;
REVOKE ALL ON FUNCTION public.notification_state(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_state(uuid,text) TO authenticated;

-- The first save/finalization captures an authoritative, immutable calculation snapshot.
CREATE FUNCTION public.capture_workout_notification_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth AS $$
DECLARE end_ms numeric; snapshot_data jsonb;
BEGIN
 IF NEW.notification_source<>'live' OR (TG_OP='UPDATE' AND OLD.end_time IS NOT NULL) THEN RETURN NEW; END IF;
 end_ms=NULLIF(to_jsonb(NEW)->>'end_time','')::numeric;
 IF end_ms IS NULL OR end_ms < extract(epoch FROM now()-interval '24 hours')*1000 OR end_ms>extract(epoch FROM now()+interval '5 minutes')*1000 THEN RETURN NEW; END IF;
 SELECT jsonb_build_object('workouts',COALESCE((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.start_time,w.id) FROM workouts w WHERE w.user_id=NEW.user_id AND w.end_time IS NOT NULL),'[]'),
 'exercises',COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM exercises e WHERE e.user_id IS NULL OR e.user_id=NEW.user_id),'[]'),
 'weight',(SELECT raw_user_meta_data->'weight' FROM auth.users WHERE id=NEW.user_id)) INTO snapshot_data;
 INSERT INTO notification_events(event_key,actor_id,kind,source_id,snapshot) VALUES('completion:'||NEW.id,NEW.user_id,'workout',NEW.id::text,snapshot_data) ON CONFLICT(event_key) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_workout_notification AFTER INSERT OR UPDATE OF end_time ON public.workouts FOR EACH ROW EXECUTE FUNCTION public.capture_workout_notification_event();
CREATE FUNCTION public.capture_friend_notification_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.status='pending' THEN
  IF NOT consume_notification_rate(NEW.requester_id,'friend_request',10) THEN RAISE EXCEPTION 'Please wait before sending more friend requests'; END IF;
  INSERT INTO notification_events(event_key,actor_id,kind,source_id) VALUES('friend-request:'||NEW.id,NEW.requester_id,'friend_request',NEW.id::text) ON CONFLICT DO NOTHING;
 ELSIF TG_OP='UPDATE' AND OLD.status='pending' AND NEW.status='accepted' THEN
  INSERT INTO notification_events(event_key,actor_id,kind,source_id) VALUES('friend-accepted:'||NEW.id,NEW.addressee_id,'friend_request_accepted',NEW.id::text) ON CONFLICT DO NOTHING;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER capture_friend_notification AFTER INSERT OR UPDATE OF status ON public.friendships FOR EACH ROW EXECUTE FUNCTION public.capture_friend_notification_event();

CREATE FUNCTION public.claim_notification_events(p_actor uuid DEFAULT NULL) RETURNS SETOF public.notification_events
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE notification_events e SET lease_id=gen_random_uuid(),lease_until=now()+interval '3 minutes',attempts=attempts+1
 WHERE e.id IN (SELECT id FROM notification_events WHERE processed_at IS NULL AND available_at<=now() AND attempts<8
 AND (lease_until IS NULL OR lease_until<now()) AND (p_actor IS NULL OR actor_id=p_actor) ORDER BY occurred_at LIMIT 10 FOR UPDATE SKIP LOCKED) RETURNING e.*;
$$;
CREATE FUNCTION public.notification_category_enabled(p_user uuid,p_category text,p_push boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN p_push THEN COALESCE((SELECT push_enabled AND COALESCE((push->>p_category)::boolean,true) FROM notification_preferences WHERE user_id=p_user),false)
 ELSE COALESCE((SELECT (in_app->>p_category)::boolean FROM notification_preferences WHERE user_id=p_user),true) END;
$$;
CREATE FUNCTION public.notification_social_allowed(p_actor uuid,p_recipient uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM user_profiles WHERE user_id=p_actor AND is_public)
 AND COALESCE((SELECT share_activity FROM notification_preferences WHERE user_id=p_actor),true)
 AND EXISTS(SELECT 1 FROM friendships WHERE status='accepted' AND ((requester_id=p_actor AND addressee_id=p_recipient) OR (requester_id=p_recipient AND addressee_id=p_actor)));
$$;
CREATE FUNCTION public.queue_notification_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF notification_category_enabled(NEW.recipient_id,NEW.category,true) THEN
  INSERT INTO push_delivery_jobs(notification_id,subscription_id,expires_at)
  SELECT NEW.id,s.id,now()+CASE WHEN NEW.type='workout_reminder' THEN interval '2 hours' ELSE interval '24 hours' END
  FROM push_subscriptions s WHERE s.user_id=NEW.recipient_id AND s.invalidated_at IS NULL ON CONFLICT DO NOTHING;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER queue_notification_push AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.queue_notification_push();

CREATE FUNCTION public.emit_notification_event(p_event uuid,p_lease uuid,p_items jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e notification_events; item jsonb; recipient uuid; actor_name text; actor_code text; affected integer:=0; inserted integer; req friendships;
BEGIN
 SELECT * INTO e FROM notification_events WHERE id=p_event AND lease_id=p_lease AND processed_at IS NULL AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN 0; END IF;
 SELECT left(display_name,80),user_code INTO actor_name,actor_code FROM user_profiles WHERE user_id=e.actor_id;
 IF e.kind='workout' THEN
  -- Deleting a source before processing prevents orphaned events.
  IF NOT EXISTS(SELECT 1 FROM workouts WHERE id::text=e.source_id AND user_id=e.actor_id) THEN p_items='[]'; END IF;
 ELSIF e.kind IN ('friend_request','friend_request_accepted') THEN
  SELECT * INTO req FROM friendships WHERE id::text=e.source_id;
  IF NOT FOUND OR (e.kind='friend_request' AND req.status<>'pending') OR (e.kind='friend_request_accepted' AND req.status<>'accepted') THEN p_items='[]';
  ELSE
   recipient=CASE WHEN e.kind='friend_request' THEN req.addressee_id ELSE req.requester_id END;
   p_items=jsonb_build_array(jsonb_build_object('category','friend_request','type',e.kind,'event_key',e.event_key,'title',CASE WHEN e.kind='friend_request' THEN 'Friend request' ELSE 'Request accepted' END,
   'body',COALESCE(actor_name,'An athlete')||CASE WHEN e.kind='friend_request' THEN ' sent you a friend request.' ELSE ' accepted your friend request.' END,'target_type','friends','target_id',e.source_id,'audience','request','recipient',recipient));
  END IF;
 END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  IF length(item->>'title')>200 OR length(item->>'body')>600 OR item->>'category' NOT IN ('personal_pr','personal_level','personal_achievement','personal_streak','friend_workout','friend_request','friend_pr','friend_achievement') THEN RAISE EXCEPTION 'Invalid event'; END IF;
  FOR recipient IN
   SELECT e.actor_id WHERE item->>'audience'='self'
   UNION SELECT (item->>'recipient')::uuid WHERE item->>'audience'='request'
   UNION SELECT CASE WHEN requester_id=e.actor_id THEN addressee_id ELSE requester_id END FROM friendships WHERE item->>'audience'='friends' AND status='accepted' AND (requester_id=e.actor_id OR addressee_id=e.actor_id)
  LOOP
   IF item->>'audience'='friends' AND NOT notification_social_allowed(e.actor_id,recipient) THEN CONTINUE; END IF;
   IF NOT notification_category_enabled(recipient,item->>'category') AND NOT notification_category_enabled(recipient,item->>'category',true) THEN CONTINUE; END IF;
   INSERT INTO notifications(recipient_id,actor_id,type,event_key,category,title,body,message,target_type,target_id,payload,in_app_visible)
   VALUES(recipient,e.actor_id,item->>'type',item->>'event_key',item->>'category',
    left(CASE WHEN item->>'audience'='friends' THEN COALESCE(actor_name,'A friend')||' '||(item->>'title') ELSE item->>'title' END,200),
    item->>'body',item->>'body',item->>'target_type',item->>'target_id',jsonb_build_object('userId',actor_code,'sourceId',e.source_id),notification_category_enabled(recipient,item->>'category')) ON CONFLICT(recipient_id,event_key) DO NOTHING;
   GET DIAGNOSTICS inserted=ROW_COUNT; affected=affected+inserted;
  END LOOP;
 END LOOP;
 UPDATE notification_events SET processed_at=now(),snapshot='{}',lease_id=NULL,lease_until=NULL,last_error=NULL WHERE id=e.id;
 RETURN affected;
END $$;
CREATE FUNCTION public.claim_push_jobs(p_recipient uuid DEFAULT NULL) RETURNS SETOF public.push_delivery_jobs LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE push_delivery_jobs j SET lease_id=gen_random_uuid(),lease_until=now()+interval '3 minutes',attempts=attempts+1
 WHERE j.id IN (SELECT j2.id FROM push_delivery_jobs j2 JOIN notifications n ON n.id=j2.notification_id WHERE j2.state='pending' AND j2.available_at<=now()
 AND (j2.lease_until IS NULL OR j2.lease_until<now()) AND (p_recipient IS NULL OR n.recipient_id=p_recipient) ORDER BY j2.available_at LIMIT 25 FOR UPDATE OF j2 SKIP LOCKED) RETURNING j.*;
$$;
CREATE FUNCTION public.consume_notification_rate(p_user uuid,p_bucket text,p_limit integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE count_value integer;
BEGIN
 INSERT INTO notification_rate_limits(user_id,bucket,window_at) VALUES(p_user,p_bucket,date_trunc('minute',now()))
 ON CONFLICT(user_id,bucket,window_at) DO UPDATE SET requests=notification_rate_limits.requests+1 RETURNING requests INTO count_value;
 DELETE FROM notification_rate_limits WHERE window_at<now()-interval '1 day';
 RETURN count_value<=p_limit;
END $$;

CREATE FUNCTION public.register_push_install(p_user uuid,p_install uuid,p_endpoint text,p_key text,p_auth text,p_enable boolean DEFAULT false,p_timezone text DEFAULT 'UTC') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE subscription_id uuid;
BEGIN
 -- Serialize replacements on one install; other installs/accounts remain untouched.
 PERFORM pg_advisory_xact_lock(hashtext(p_user::text||p_install::text));
 IF EXISTS(SELECT 1 FROM push_subscriptions WHERE endpoint=p_endpoint AND user_id<>p_user AND invalidated_at IS NULL) THEN RAISE EXCEPTION 'Subscription belongs to another account'; END IF;
 UPDATE push_subscriptions SET invalidated_at=now() WHERE user_id=p_user AND install_id=p_install AND endpoint<>p_endpoint AND invalidated_at IS NULL;
 INSERT INTO push_subscriptions(user_id,install_id,endpoint,p256dh,auth) VALUES(p_user,p_install,p_endpoint,p_key,p_auth)
 ON CONFLICT(endpoint) DO UPDATE SET user_id=p_user,install_id=p_install,p256dh=p_key,auth=p_auth,invalidated_at=NULL,updated_at=now() WHERE push_subscriptions.user_id=p_user OR push_subscriptions.invalidated_at IS NOT NULL RETURNING id INTO subscription_id;
 IF subscription_id IS NULL THEN RAISE EXCEPTION 'Subscription ownership conflict'; END IF;
 INSERT INTO notification_preferences(user_id,push_enabled,timezone) VALUES(p_user,p_enable,p_timezone) ON CONFLICT(user_id) DO UPDATE SET push_enabled=notification_preferences.push_enabled OR p_enable;
 RETURN subscription_id;
END $$;
CREATE FUNCTION public.revoke_push_install(p_user uuid,p_install uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE push_subscriptions SET invalidated_at=now(),updated_at=now() WHERE user_id=p_user AND install_id=p_install AND invalidated_at IS NULL;
$$;

REVOKE ALL ON public.friendships FROM anon,authenticated;
GRANT SELECT ON public.friendships,public.user_profiles TO authenticated;
GRANT INSERT ON public.friendships TO authenticated;
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests" ON public.friendships FOR INSERT TO authenticated
 WITH CHECK(requester_id=auth.uid() AND addressee_id<>auth.uid() AND status='pending'
 AND EXISTS(SELECT 1 FROM user_profiles WHERE user_id=requester_id AND is_public)
 AND EXISTS(SELECT 1 FROM user_profiles WHERE user_id=addressee_id AND is_public));
GRANT UPDATE(status,responded_at) ON public.friendships TO authenticated;
CREATE POLICY "Participants can remove friendships" ON public.friendships FOR DELETE TO authenticated USING(requester_id=auth.uid() OR addressee_id=auth.uid());
GRANT DELETE ON public.friendships TO authenticated;

CREATE FUNCTION public.create_workout_reminder(p_user uuid,p_date text,p_now timestamptz DEFAULT now()) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p notification_preferences; local_now timestamp;
BEGIN
 SELECT * INTO p FROM notification_preferences WHERE user_id=p_user;
 IF NOT FOUND OR (NOT notification_category_enabled(p_user,'workout_reminder') AND NOT notification_category_enabled(p_user,'workout_reminder',true)) THEN RETURN false; END IF;
 local_now=p_now AT TIME ZONE p.timezone;
 IF to_char(local_now,'YYYY-MM-DD')<>p_date OR NOT extract(dow FROM local_now)::integer=ANY(p.reminder_days) OR to_char(local_now,'HH24:MI')<p.reminder_time THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM workouts WHERE user_id=p_user AND end_time IS NOT NULL AND lower(name) NOT LIKE '%rest day%'
 AND to_char(to_timestamp(end_time/1000.0) AT TIME ZONE p.timezone,'YYYY-MM-DD')=p_date) THEN RETURN false; END IF;
 INSERT INTO notifications(recipient_id,type,event_key,category,title,body,message,target_type,in_app_visible)
 VALUES(p_user,'workout_reminder','reminder:'||p_date,'workout_reminder','Time for your workout','Your scheduled workout is ready when you are.','Time for your workout','workout_start',notification_category_enabled(p_user,'workout_reminder')) ON CONFLICT DO NOTHING;
 RETURN FOUND;
END $$;
CREATE FUNCTION public.schedule_workout_reminders() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE candidate record; scheduled integer:=0;
BEGIN
 -- Select only due, not-yet-created local days in one server-side scan, rather
 -- than making one HTTP query per user or assuming a small fixed account count.
 FOR candidate IN SELECT p.user_id,to_char(now() AT TIME ZONE p.timezone,'YYYY-MM-DD') AS local_date
  FROM notification_preferences p WHERE (COALESCE((p.in_app->>'workout_reminder')::boolean,true) OR (p.push_enabled AND COALESCE((p.push->>'workout_reminder')::boolean,true)))
  AND extract(dow FROM now() AT TIME ZONE p.timezone)::integer=ANY(p.reminder_days)
  AND to_char(now() AT TIME ZONE p.timezone,'HH24:MI')>=p.reminder_time
  AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.recipient_id=p.user_id AND n.event_key='reminder:'||to_char(now() AT TIME ZONE p.timezone,'YYYY-MM-DD'))
 LOOP
  IF create_workout_reminder(candidate.user_id,candidate.local_date) THEN scheduled=scheduled+1; END IF;
 END LOOP;
 RETURN scheduled;
END $$;
CREATE FUNCTION public.reminder_push_needed(p_notification uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM notifications n JOIN notification_preferences p ON p.user_id=n.recipient_id
 WHERE n.id=p_notification AND n.deleted_at IS NULL AND n.type='workout_reminder'
 AND n.event_key='reminder:'||to_char(now() AT TIME ZONE p.timezone,'YYYY-MM-DD')
 AND extract(dow FROM now() AT TIME ZONE p.timezone)::integer=ANY(p.reminder_days)
 AND to_char(now() AT TIME ZONE p.timezone,'HH24:MI')>=p.reminder_time
 AND NOT EXISTS(SELECT 1 FROM workouts w WHERE w.user_id=n.recipient_id AND w.end_time IS NOT NULL AND lower(w.name) NOT LIKE '%rest day%'
 AND to_char(to_timestamp(w.end_time/1000.0) AT TIME ZONE p.timezone,'YYYY-MM-DD')=to_char(now() AT TIME ZONE p.timezone,'YYYY-MM-DD')));
$$;
CREATE FUNCTION public.cleanup_notification_delivery() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE push_delivery_jobs SET state='skipped',lease_id=NULL,lease_until=NULL
 WHERE state='pending' AND expires_at<now() AND (lease_until IS NULL OR lease_until<now());
 DELETE FROM push_subscriptions WHERE invalidated_at<now()-interval '30 days';
 DELETE FROM notification_events WHERE processed_at<now()-interval '90 days';
 DELETE FROM notification_rate_limits WHERE window_at<now()-interval '1 day';
END $$;

-- An authenticated recipient may resolve only their own undeleted notification.
-- Return friends' details only while BOTH public sharing and active friendship hold.
CREATE FUNCTION public.notification_target(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n notifications; w workouts; details jsonb;
BEGIN
 SELECT * INTO n FROM notifications WHERE id=p_id AND recipient_id=auth.uid() AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN jsonb_build_object('unavailable',true); END IF;
 IF n.target_type='notifications' THEN RETURN jsonb_build_object('route','/alerts'); END IF;
 IF n.target_type='friend_workout' THEN
  IF NOT notification_social_allowed(n.actor_id,n.recipient_id) THEN RETURN jsonb_build_object('unavailable',true); END IF;
  SELECT * INTO w FROM workouts WHERE id::text=n.target_id AND user_id=n.actor_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('unavailable',true); END IF;
  SELECT jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'category',e.category,'is_unilateral',e.is_unilateral)) INTO details FROM exercises e
  WHERE e.user_id IS NULL OR e.user_id=n.actor_id;
  RETURN jsonb_build_object('workout',to_jsonb(w)-'user_id'-'body_weight','exercises',COALESCE(details,'[]'));
 END IF;
 IF n.category LIKE 'friend_%' AND n.category<>'friend_request' AND NOT notification_social_allowed(n.actor_id,n.recipient_id) THEN RETURN jsonb_build_object('unavailable',true); END IF;
 IF n.target_type='workout' THEN
  IF EXISTS(SELECT 1 FROM workouts WHERE id::text=n.target_id AND user_id=auth.uid()) THEN RETURN jsonb_build_object('route','/summary/'||n.target_id); END IF;
  RETURN jsonb_build_object('unavailable',true);
 END IF;
 RETURN jsonb_build_object('route',CASE WHEN n.target_type='workout_start' THEN '/workout' WHEN n.category='friend_request' THEN '/profile?tab=friends' WHEN n.category LIKE 'friend_%' THEN '/friends/'||n.actor_id ELSE '/profile?tab=overview' END);
END $$;
REVOKE ALL ON FUNCTION public.notification_target(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.notification_target(uuid) TO authenticated;

-- Privatize all privileged helpers. SECURITY DEFINER alone is not access control.
DO $$ DECLARE fn record; BEGIN
 FOR fn IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
 AND p.proname IN ('capture_workout_notification_event','capture_friend_notification_event','claim_notification_events','notification_category_enabled','notification_social_allowed','queue_notification_push','emit_notification_event','claim_push_jobs','consume_notification_rate','create_workout_reminder','schedule_workout_reminders','reminder_push_needed','cleanup_notification_delivery','validate_notification_preferences','register_push_install','revoke_push_install') LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||fn.signature||' FROM PUBLIC,anon,authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION '||fn.signature||' TO service_role';
 END LOOP;
END $$;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notification_preferences') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_preferences; END IF;
END $$;
COMMIT;
