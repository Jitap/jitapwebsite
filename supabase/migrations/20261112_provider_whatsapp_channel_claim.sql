create or replace function public.jitap_claim_provider_whatsapp(p_assignment_id uuid)
returns setof public.jitap_provider_alerts language plpgsql set search_path=public as $$
begin
 return query
 with selected as (
  select id from public.jitap_provider_alerts
  where state='pending' and channel='whatsapp' and assignment_id=p_assignment_id
  order by requested_at,id for update skip locked limit 1
 )
 update public.jitap_provider_alerts a set state='sending',attempted_at=now()
 from selected where a.id=selected.id returning a.*;
end $$;
revoke all on function public.jitap_claim_provider_whatsapp(uuid) from public,anon,authenticated;
grant execute on function public.jitap_claim_provider_whatsapp(uuid) to service_role;