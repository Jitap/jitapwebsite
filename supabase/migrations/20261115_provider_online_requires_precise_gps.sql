create or replace function public.jitap_require_provider_gps_online()
returns trigger language plpgsql security definer set search_path to ''
as $$
begin
 if new.is_online=true and (
  tg_op='INSERT' or old.is_online is distinct from true
 ) then
  if not exists(
   select 1 from public.jitap_wave_provider_locations gps
   where gps.provider_user_id=new.user_id and gps.sharing_enabled=true
    and gps.observed_at>now()-interval '15 minutes'
  ) then
   raise exception 'Precise location permission is required to go online and receive nearby jobs'
    using errcode='23514';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.jitap_require_provider_gps_online() from public,anon,authenticated;
drop trigger if exists jitap_require_provider_gps_online on public.jitap_provider_workspaces;
create trigger jitap_require_provider_gps_online before insert or update of is_online
 on public.jitap_provider_workspaces for each row execute function public.jitap_require_provider_gps_online();
-- Existing online sessions cannot be grandfathered into proximity dispatch without permission.
update public.jitap_provider_workspaces w set is_online=false
where is_online=true and not exists (
 select 1 from public.jitap_wave_provider_locations gps
 where gps.provider_user_id=w.user_id and gps.sharing_enabled=true
 and gps.observed_at>now()-interval '15 minutes'
);