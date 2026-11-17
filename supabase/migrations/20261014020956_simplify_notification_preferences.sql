-- Keep older clients compatible without retaining independent channel behavior.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE public.notification_preferences,public.user_profiles IN SHARE ROW EXCLUSIVE MODE;
CREATE SCHEMA ironlog_notification_settings_backup_20261013;
REVOKE ALL ON SCHEMA ironlog_notification_settings_backup_20261013 FROM PUBLIC,anon,authenticated;
CREATE TABLE ironlog_notification_settings_backup_20261013.preferences AS TABLE public.notification_preferences;
CREATE TABLE ironlog_notification_settings_backup_20261013.profiles AS TABLE public.user_profiles;
REVOKE ALL ON ALL TABLES IN SCHEMA ironlog_notification_settings_backup_20261013 FROM PUBLIC,anon,authenticated;
ALTER TABLE ironlog_notification_settings_backup_20261013.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ironlog_notification_settings_backup_20261013.profiles ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.unify_notification_preferences() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE category text; enabled boolean; categories jsonb:='{}';
BEGIN
 FOREACH category IN ARRAY ARRAY['workout_reminder','friend_workout','friend_request','friend_pr','friend_achievement'] LOOP
  -- Never turn a prior channel-specific opt-out back on during the migration.
  enabled:=COALESCE((NEW.in_app->>category)::boolean,true) AND COALESCE((NEW.push->>category)::boolean,true);
  categories:=categories||jsonb_build_object(category,enabled);
 END LOOP;
 NEW.in_app:=categories; NEW.push:=categories; NEW.quiet_enabled:=false;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.unify_notification_preferences() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ab_unify_notification_preferences BEFORE INSERT OR UPDATE ON public.notification_preferences
 FOR EACH ROW EXECUTE FUNCTION public.unify_notification_preferences();
UPDATE public.notification_preferences SET quiet_enabled=false;

-- One transaction for privacy and sharing; invoker privileges preserve owner RLS.
CREATE FUNCTION public.save_social_privacy(p_is_public boolean,p_share_activity boolean) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE owner_id uuid:=auth.uid();
BEGIN
 IF owner_id IS NULL OR p_is_public IS NULL OR p_share_activity IS NULL THEN RAISE EXCEPTION 'Invalid privacy request'; END IF;
 UPDATE public.user_profiles SET is_public=p_is_public WHERE user_id=owner_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile not available'; END IF;
 INSERT INTO public.notification_preferences(user_id,share_activity) VALUES(owner_id,p_share_activity)
 ON CONFLICT(user_id) DO UPDATE SET share_activity=EXCLUDED.share_activity;
END $$;
REVOKE ALL ON FUNCTION public.save_social_privacy(boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_social_privacy(boolean,boolean) TO authenticated;
