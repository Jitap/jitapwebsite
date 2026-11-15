-- Call deployed Edge push worker on each short Wave Buzz tick.
-- The dispatch authentication secret is read from Vault at runtime only.
select cron.schedule('jitap-native-wave-push','5 seconds',$job$
 select net.http_post(
  url:='https://vqktiwdksmfkdbwmdyvl.supabase.co/functions/v1/jitap-wave-push',
  headers:=jsonb_build_object(
   'Content-Type','application/json',
   'x-jitap-push-dispatch',
    (select decrypted_secret from vault.decrypted_secrets where name='jitap_wave_push_dispatch_auth')
  ),
  body:='{}'::jsonb,
  timeout_milliseconds:=10000
 );
$job$);