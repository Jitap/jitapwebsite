create or replace function public.jitap_expire_stale_provider_gps()
returns integer language plpgsql security definer set search_path to '' as $$
declare v_count integer;
begin
 update public.jitap_provider_workspaces w set is_online=false
 where w.is_online=true and not exists(
  select 1 from public.jitap_wave_provider_locations gps
  where gps.provider_user_id=w.user_id and gps.sharing_enabled=true
  and gps.observed_at>now()-interval '15 minutes'
 );
 get diagnostics v_count=row_count;
 delete from public.jitap_wave_provider_locations where observed_at<now()-interval '15 minutes';
 return v_count;
end $$;
revoke all on function public.jitap_expire_stale_provider_gps() from public,anon,authenticated;
grant execute on function public.jitap_expire_stale_provider_gps() to service_role;
select cron.schedule('jitap-expire-stale-provider-gps','* * * * *',
 $cron$select public.jitap_expire_stale_provider_gps();$cron$);