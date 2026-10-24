-- MANUAL activation AFTER approval/deployment. Do not apply to a preview database
-- that points to production. Enable pg_cron, pg_net and Vault in Supabase first.
-- Create Vault secrets through the dashboard, not a committed SQL literal:
-- ironlog_notification_worker_url = https://YOUR_APP/api/notifications?worker=1
-- ironlog_notification_worker_secret = the server NOTIFICATION_WORKER_SECRET
-- Neither VAPID private nor service_role credentials belong in this scheduler.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname='ironlog-notification-worker';
SELECT cron.schedule('ironlog-notification-worker','* * * * *',$job$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='ironlog_notification_worker_url'),
    headers := jsonb_build_object('Authorization','Bearer ' ||
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='ironlog_notification_worker_secret')),
    timeout_milliseconds := 180000
  );
$job$);
