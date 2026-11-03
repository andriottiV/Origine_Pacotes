-- OPTIONAL EXTERNAL SETUP, not a schema migration. Not executed automatically.
-- Enable Supabase Cron (pg_cron), pg_net and Vault in the Dashboard first.
-- Create Vault secrets using the Dashboard, NOT committed SQL literals:
--   origine_app_url       = canonical HTTPS origin, without trailing slash
--   origine_push_cron     = the SAME CRON_SECRET as in the application server
-- Never use SUPABASE_SERVICE_ROLE_KEY as an HTTP scheduler token.
-- Ensure access to Vault/pg_net queue and SQL logins is restricted to trusted DB
-- administrators; pg_net temporarily stores request headers in its queue.
-- This named schedule can be re-run to update it, without duplicating the job.
select cron.schedule(
  'origine-web-push-worker',
  '* * * * *',
  $job$
    select net.http_post(
      url := (select vs.decrypted_secret from vault.decrypted_secrets as vs where vs.name='origine_app_url') || '/api/push/process',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
        (select vs.decrypted_secret from vault.decrypted_secrets as vs where vs.name='origine_push_cron')),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $job$
);
-- To disable only this job:
-- select cron.unschedule('origine-web-push-worker');
