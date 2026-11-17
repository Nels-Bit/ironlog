-- Additive, reversible merge: definitions and every workout/set are retained.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE public.exercises,public.workouts,public.notifications,public.notification_preferences,public.push_delivery_jobs IN SHARE ROW EXCLUSIVE MODE;
CREATE SCHEMA ironlog_barbell_backup_20261013;
REVOKE ALL ON SCHEMA ironlog_barbell_backup_20261013 FROM PUBLIC,anon,authenticated;
CREATE TABLE ironlog_barbell_backup_20261013.exercises AS TABLE public.exercises;
CREATE TABLE ironlog_barbell_backup_20261013.workouts AS TABLE public.workouts;
CREATE TABLE ironlog_barbell_backup_20261013.notifications AS TABLE public.notifications;
CREATE TABLE ironlog_barbell_backup_20261013.preferences AS TABLE public.notification_preferences;
CREATE TABLE ironlog_barbell_backup_20261013.delivery_jobs AS TABLE public.push_delivery_jobs;
CREATE TABLE ironlog_barbell_backup_20261013.functions AS
 SELECT p.oid::regprocedure::text AS signature,pg_get_functiondef(p.oid) AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('notification_category_enabled','queue_notification_push','emit_notification_event','validate_notification_preferences');
REVOKE ALL ON ALL TABLES IN SCHEMA ironlog_barbell_backup_20261013 FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='ironlog_barbell_backup_20261013' LOOP
  EXECUTE format('ALTER TABLE ironlog_barbell_backup_20261013.%I ENABLE ROW LEVEL SECURITY',t.tablename);
 END LOOP;
END $$;

CREATE SCHEMA IF NOT EXISTS ironlog_internal;
REVOKE ALL ON SCHEMA ironlog_internal FROM PUBLIC,anon,authenticated;
CREATE FUNCTION ironlog_internal.barbell_name(p_name text,p_category text,p_unilateral boolean) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN COALESCE(p_unilateral,false) OR lower(regexp_replace(trim(p_category),'\s+',' ','g')) NOT IN ('free weights','free weight','barbell','strength','chest','legs','back') THEN NULL
 ELSE CASE lower(regexp_replace(trim(p_name),'\s+',' ','g'))
 WHEN 'bench press' THEN 'Barbell Bench Press' WHEN 'barbell bench press' THEN 'Barbell Bench Press'
 WHEN 'squat' THEN 'Barbell Squat' WHEN 'barbell squat' THEN 'Barbell Squat'
 WHEN 'deadlift' THEN 'Barbell Deadlift' WHEN 'barbell deadlift' THEN 'Barbell Deadlift' END END;
$$;
REVOKE ALL ON FUNCTION ironlog_internal.barbell_name(text,text,boolean) FROM PUBLIC,anon,authenticated;

CREATE TABLE public.exercise_id_aliases (
 user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
 old_exercise_id uuid NOT NULL REFERENCES public.exercises ON DELETE CASCADE,
 exercise_id uuid NOT NULL REFERENCES public.exercises ON DELETE CASCADE,
 PRIMARY KEY(user_id,old_exercise_id),CHECK(old_exercise_id<>exercise_id)
);
ALTER TABLE public.exercise_id_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exercise_id_aliases FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.exercise_id_aliases TO authenticated;
GRANT ALL ON public.exercise_id_aliases TO service_role;
CREATE POLICY "Owners read their exercise identity mappings" ON public.exercise_id_aliases FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));

-- An already-named custom exercise wins over a renamed shared/default one.
WITH recognized AS (
 SELECT e.*,ironlog_internal.barbell_name(name,category,is_unilateral) AS canonical FROM public.exercises e
), preferred AS (
 SELECT DISTINCT ON (u.id,e.canonical) u.id AS owner,e.canonical,e.id AS target
 FROM auth.users u JOIN recognized e ON (e.user_id IS NULL OR e.user_id=u.id) AND e.canonical IS NOT NULL
 ORDER BY u.id,e.canonical,(e.user_id IS NOT NULL) DESC,
  (lower(regexp_replace(trim(e.name),'\s+',' ','g'))=lower(e.canonical)) DESC,e.id
)
INSERT INTO public.exercise_id_aliases(user_id,old_exercise_id,exercise_id)
 SELECT p.owner,e.id,p.target FROM preferred p JOIN recognized e ON e.canonical=p.canonical
 AND (e.user_id IS NULL OR e.user_id=p.owner) WHERE e.id<>p.target;
UPDATE public.exercises SET name=ironlog_internal.barbell_name(name,category,is_unilateral)
 WHERE ironlog_internal.barbell_name(name,category,is_unilateral) IS NOT NULL;

-- Preserve the exact JSON shape, including stringified arrays and snake_case.
CREATE FUNCTION ironlog_internal.remap_exercises(p_user uuid,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE parsed jsonb:=p_data; item jsonb; result jsonb:='[]'; dest uuid; old_id text; was_string boolean:=false; field text;
BEGIN
 IF jsonb_typeof(parsed)='string' THEN
  BEGIN parsed:=(parsed#>>'{}')::jsonb; was_string:=true; EXCEPTION WHEN invalid_text_representation THEN RETURN p_data; END;
 END IF;
 IF jsonb_typeof(parsed) IS DISTINCT FROM 'array' THEN RETURN p_data; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(parsed) LOOP
  old_id:=COALESCE(item->>'exerciseId',item->>'exercise_id');
  SELECT exercise_id INTO dest FROM public.exercise_id_aliases WHERE user_id=p_user AND old_exercise_id::text=old_id;
  IF dest IS NOT NULL AND jsonb_typeof(item)='object' THEN
   FOREACH field IN ARRAY ARRAY['exerciseId','exercise_id'] LOOP
    IF item ? field THEN item:=jsonb_set(item,ARRAY[field],to_jsonb(dest::text)); END IF;
   END LOOP;
  END IF;
  result:=result||jsonb_build_array(item);
 END LOOP;
 IF parsed=result THEN RETURN p_data; END IF;
 RETURN CASE WHEN was_string THEN to_jsonb(result::text) ELSE result END;
END $$;
REVOKE ALL ON FUNCTION ironlog_internal.remap_exercises(uuid,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.remap_workout_exercise_ids() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN NEW.exercises:=ironlog_internal.remap_exercises(NEW.user_id,NEW.exercises); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.remap_workout_exercise_ids() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER remap_workout_exercises BEFORE INSERT OR UPDATE OF exercises ON public.workouts FOR EACH ROW EXECUTE FUNCTION public.remap_workout_exercise_ids();
-- No end_time update: the completion-event trigger is deliberately not fired.
UPDATE public.workouts SET exercises=ironlog_internal.remap_exercises(user_id,exercises)
 WHERE exercises IS DISTINCT FROM ironlog_internal.remap_exercises(user_id,exercises);

ALTER TABLE public.notification_preferences ALTER COLUMN in_app SET DEFAULT '{"workout_reminder":true,"friend_workout":true,"friend_request":true,"friend_pr":true,"friend_achievement":true}';
ALTER TABLE public.notification_preferences ALTER COLUMN push SET DEFAULT '{"workout_reminder":true,"friend_workout":true,"friend_request":true,"friend_pr":true,"friend_achievement":true}';
UPDATE public.notification_preferences SET in_app=in_app-ARRAY['personal_pr','personal_level','personal_achievement','personal_streak'],push=push-ARRAY['personal_pr','personal_level','personal_achievement','personal_streak'];
-- Keep historical rows for recovery, but remove these alerts from every inbox.
UPDATE public.notifications SET category='test_push' WHERE type='test_push';
-- Existing standard-lift PR rows keep their record but gain the canonical name.
UPDATE public.notifications n SET body=ironlog_internal.barbell_name(e.name,e.category,e.is_unilateral)||substring(n.body FROM position(' · ' IN n.body)),
 message=ironlog_internal.barbell_name(e.name,e.category,e.is_unilateral)||substring(n.body FROM position(' · ' IN n.body))
 FROM public.exercises e WHERE n.category='friend_pr' AND split_part(n.event_key,':',3)=e.id::text
 AND ironlog_internal.barbell_name(e.name,e.category,e.is_unilateral) IS NOT NULL AND position(' · ' IN n.body)>0;
UPDATE public.notifications SET in_app_visible=false WHERE category IN ('personal_pr','personal_level','personal_achievement','personal_streak');
UPDATE public.notifications SET in_app_visible=false WHERE category='friend_pr' AND split_part(body,' · ',1) NOT IN ('Barbell Bench Press','Barbell Squat','Barbell Deadlift');
UPDATE public.push_delivery_jobs j SET state='skipped',lease_id=NULL,lease_until=NULL
 FROM public.notifications n WHERE j.notification_id=n.id AND j.state='pending' AND (n.category IN ('personal_pr','personal_level','personal_achievement','personal_streak') OR (n.category='friend_pr' AND split_part(n.body,' · ',1) NOT IN ('Barbell Bench Press','Barbell Squat','Barbell Deadlift')));

CREATE OR REPLACE FUNCTION public.notification_category_enabled(p_user uuid,p_category text,p_push boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN p_category='test_push' THEN CASE WHEN p_push THEN COALESCE((SELECT push_enabled FROM notification_preferences WHERE user_id=p_user),false) ELSE true END
 WHEN p_category NOT IN ('workout_reminder','friend_workout','friend_request','friend_pr','friend_achievement') THEN false
 WHEN p_push THEN COALESCE((SELECT push_enabled AND COALESCE((push->>p_category)::boolean,true) FROM notification_preferences WHERE user_id=p_user),false)
 ELSE COALESCE((SELECT (in_app->>p_category)::boolean FROM notification_preferences WHERE user_id=p_user),true) END;
$$;
-- Existing trigger validation stays backward-compatible with older clients,
-- while this trigger strips removed toggles before the original validation runs.
CREATE FUNCTION public.strip_personal_notification_preferences() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.in_app:=NEW.in_app-ARRAY['personal_pr','personal_level','personal_achievement','personal_streak'];
 NEW.push:=NEW.push-ARRAY['personal_pr','personal_level','personal_achievement','personal_streak']; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.strip_personal_notification_preferences() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER aa_strip_personal_preferences BEFORE INSERT OR UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.strip_personal_notification_preferences();

CREATE OR REPLACE FUNCTION public.emit_notification_event(p_event uuid,p_lease uuid,p_items jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e notification_events; item jsonb; recipient uuid; actor_name text; actor_code text; affected integer:=0; inserted integer; req friendships; heading text;
BEGIN
 SELECT * INTO e FROM notification_events WHERE id=p_event AND lease_id=p_lease AND processed_at IS NULL AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN 0; END IF;
 SELECT left(display_name,80),user_code INTO actor_name,actor_code FROM user_profiles WHERE user_id=e.actor_id;
 IF e.kind='workout' THEN
  IF NOT EXISTS(SELECT 1 FROM workouts WHERE id::text=e.source_id AND user_id=e.actor_id) THEN p_items='[]'; END IF;
 ELSIF e.kind IN ('friend_request','friend_request_accepted') THEN
  SELECT * INTO req FROM friendships WHERE id::text=e.source_id;
  IF NOT FOUND OR (e.kind='friend_request' AND req.status<>'pending') OR (e.kind='friend_request_accepted' AND req.status<>'accepted') THEN p_items='[]';
  ELSE
   recipient:=CASE WHEN e.kind='friend_request' THEN req.addressee_id ELSE req.requester_id END;
   p_items:=jsonb_build_array(jsonb_build_object('category','friend_request','type',e.kind,'event_key',e.event_key,'title',CASE WHEN e.kind='friend_request' THEN 'Friend request' ELSE 'Request accepted' END,
   'body',COALESCE(actor_name,'An athlete')||CASE WHEN e.kind='friend_request' THEN ' sent you a friend request.' ELSE ' accepted your friend request.' END,'target_type','friends','target_id',e.source_id,'audience','request','recipient',recipient));
  END IF;
 END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  IF item->>'category' IN ('personal_pr','personal_level','personal_achievement','personal_streak') THEN CONTINUE; END IF;
  IF length(item->>'title')>200 OR length(item->>'body')>600 OR item->>'category' NOT IN ('friend_workout','friend_request','friend_pr','friend_achievement') OR item->>'audience' NOT IN ('friends','request') THEN RAISE EXCEPTION 'Invalid event'; END IF;
  IF item->>'category'='friend_pr' AND split_part(item->>'body',' · ',1) NOT IN ('Barbell Bench Press','Barbell Squat','Barbell Deadlift') THEN CONTINUE; END IF;
  FOR recipient IN
   SELECT (item->>'recipient')::uuid WHERE item->>'audience'='request'
   UNION SELECT CASE WHEN requester_id=e.actor_id THEN addressee_id ELSE requester_id END FROM friendships WHERE item->>'audience'='friends' AND status='accepted' AND (requester_id=e.actor_id OR addressee_id=e.actor_id)
  LOOP
   IF item->>'audience'='friends' AND NOT notification_social_allowed(e.actor_id,recipient) THEN CONTINUE; END IF;
   IF NOT notification_category_enabled(recipient,item->>'category') AND NOT notification_category_enabled(recipient,item->>'category',true) THEN CONTINUE; END IF;
   heading:=item->>'title';
   IF item->>'audience'='friends' THEN
    heading:=COALESCE(actor_name,'A friend')||CASE item->>'type' WHEN 'personal_record' THEN ' hit a new PR' WHEN 'achievement_unlocked' THEN ' received a new award' WHEN 'level_up' THEN ' reached a new level' WHEN 'workout_completed' THEN ' finished a workout' ELSE ' '||(item->>'title') END;
   END IF;
   INSERT INTO notifications(recipient_id,actor_id,type,event_key,category,title,body,message,target_type,target_id,payload,in_app_visible)
   VALUES(recipient,e.actor_id,item->>'type',item->>'event_key',item->>'category',left(heading,200),item->>'body',item->>'body',item->>'target_type',item->>'target_id',jsonb_build_object('userId',actor_code,'sourceId',e.source_id),notification_category_enabled(recipient,item->>'category')) ON CONFLICT(recipient_id,event_key) DO NOTHING;
   GET DIAGNOSTICS inserted=ROW_COUNT; affected:=affected+inserted;
  END LOOP;
 END LOOP;
 UPDATE notification_events SET processed_at=now(),snapshot='{}',lease_id=NULL,lease_until=NULL,last_error=NULL WHERE id=e.id;
 RETURN affected;
END $$;
-- CREATE OR REPLACE retains the original service-only execution grants.
