-- Supabase pg_cron executes the bounded Wave Buzz dispatcher every five seconds.
-- Repeat scheduling by the same name updates the existing job without duplication.
-- The function is idempotent, only issues offers to explicitly geolocated,
-- approved, online providers and never contacts providers without opt-in.
select cron.schedule('jitap-wave-buzz-dispatch','5 seconds',
  $sql$select public.jitap_wave_dispatch_tick(20);$sql$);
