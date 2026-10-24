-- No historical notifications or workout data are rewritten.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE SCHEMA ironlog_combined_alert_backup_20261014;
REVOKE ALL ON SCHEMA ironlog_combined_alert_backup_20261014 FROM PUBLIC,anon,authenticated;
CREATE TABLE ironlog_combined_alert_backup_20261014.functions AS
 SELECT p.oid::regprocedure::text AS signature,pg_get_functiondef(p.oid) AS definition
 FROM pg_proc p WHERE p.oid='public.emit_notification_event(uuid,uuid,jsonb)'::regprocedure;
REVOKE ALL ON ALL TABLES IN SCHEMA ironlog_combined_alert_backup_20261014 FROM PUBLIC,anon,authenticated;
ALTER TABLE ironlog_combined_alert_backup_20261014.functions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.emit_notification_event(p_event uuid,p_lease uuid,p_items jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e notification_events; item jsonb; recipient uuid; actor_name text; actor_code text;
 affected integer:=0; inserted integer; req friendships; heading text; category text; kind text; detail text;
 metadata jsonb; has_award boolean; pr_enabled boolean; award_enabled boolean;
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
  has_award:=item ? 'award_body';
  IF has_award AND (item->>'category'<>'friend_pr' OR item->>'audience'<>'friends' OR jsonb_typeof(item->'award_body') IS DISTINCT FROM 'string'
   OR length(item->>'award_body')>300 OR NOT (item->>'award_body' LIKE '% '||split_part(item->>'body',' · ',1)||' Trophy')) THEN RAISE EXCEPTION 'Invalid matching trophy'; END IF;
  FOR recipient IN
   SELECT (item->>'recipient')::uuid WHERE item->>'audience'='request'
   UNION SELECT CASE WHEN requester_id=e.actor_id THEN addressee_id ELSE requester_id END FROM friendships WHERE item->>'audience'='friends' AND status='accepted' AND (requester_id=e.actor_id OR addressee_id=e.actor_id)
  LOOP
   IF item->>'audience'='friends' AND NOT notification_social_allowed(e.actor_id,recipient) THEN CONTINUE; END IF;
   category:=item->>'category'; kind:=item->>'type'; detail:=item->>'body'; heading:=item->>'title';
   metadata:=jsonb_build_object('userId',actor_code,'sourceId',e.source_id);
   IF has_award THEN
    pr_enabled:=notification_category_enabled(recipient,'friend_pr') OR notification_category_enabled(recipient,'friend_pr',true);
    award_enabled:=notification_category_enabled(recipient,'friend_achievement') OR notification_category_enabled(recipient,'friend_achievement',true);
    IF NOT pr_enabled AND NOT award_enabled THEN CONTINUE; END IF;
    IF pr_enabled AND award_enabled THEN
     heading:=COALESCE(actor_name,'A friend')||' hit a new PR and received a new award';
     detail:=detail||' · '||(item->>'award_body');
     metadata:=metadata||jsonb_build_object('actorName',COALESCE(actor_name,'A friend'),'recordBody',item->>'body','awardBody',item->>'award_body');
    ELSIF pr_enabled THEN heading:=COALESCE(actor_name,'A friend')||' hit a new PR';
    ELSE
     category:='friend_achievement'; kind:='achievement_unlocked'; detail:=item->>'award_body';
     heading:=COALESCE(actor_name,'A friend')||' received a new award';
    END IF;
   ELSE
    IF NOT notification_category_enabled(recipient,category) AND NOT notification_category_enabled(recipient,category,true) THEN CONTINUE; END IF;
    IF item->>'audience'='friends' THEN
     heading:=COALESCE(actor_name,'A friend')||CASE kind WHEN 'personal_record' THEN ' hit a new PR' WHEN 'achievement_unlocked' THEN ' received a new award' WHEN 'level_up' THEN ' reached a new level' WHEN 'workout_completed' THEN ' finished a workout' ELSE ' '||heading END;
    END IF;
   END IF;
   INSERT INTO notifications(recipient_id,actor_id,type,event_key,category,title,body,message,target_type,target_id,payload,in_app_visible)
   VALUES(recipient,e.actor_id,kind,item->>'event_key',category,left(heading,200),left(detail,600),left(detail,600),item->>'target_type',item->>'target_id',metadata,notification_category_enabled(recipient,category))
   ON CONFLICT(recipient_id,event_key) DO NOTHING;
   GET DIAGNOSTICS inserted=ROW_COUNT; affected:=affected+inserted;
  END LOOP;
 END LOOP;
 UPDATE notification_events SET processed_at=now(),snapshot='{}',lease_id=NULL,lease_until=NULL,last_error=NULL WHERE id=e.id;
 RETURN affected;
END $$;
-- CREATE OR REPLACE preserves the existing service-role-only grants.
