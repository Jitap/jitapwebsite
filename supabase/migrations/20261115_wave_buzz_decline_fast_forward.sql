-- Immediately begin the next geographic wave when all active providers decline.
CREATE OR REPLACE FUNCTION public.jitap_wave_respond(p_request_id uuid, p_provider_user_id uuid, p_decision text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j public.jitap_wave_dispatch_jobs%rowtype;
 o public.jitap_wave_offers%rowtype;
begin
 if p_decision not in ('accepted','declined') then return jsonb_build_object('status','invalid');end if;
 select * into j from public.jitap_wave_dispatch_jobs
  where request_id=p_request_id for update;
 if not found then return jsonb_build_object('status','not_found');end if;
 if j.state<>'searching' then return jsonb_build_object('status',j.state);end if;
 select * into o from public.jitap_wave_offers
  where request_id=p_request_id and provider_user_id=p_provider_user_id for update;
 if not found or o.state<>'pending' or o.expires_at<=now()
  or j.started_at+interval '45 seconds'<=now() then
  return jsonb_build_object('status','expired');
 end if;
 if p_decision='declined' then
  update public.jitap_wave_offers set state='declined'
   where request_id=p_request_id and provider_user_id=p_provider_user_id;
  -- When everyone in the current ring has declined, advance the next ring
  -- immediately instead of waiting for the remaining timer.
  if not exists(
    select 1 from public.jitap_wave_offers remaining
    where remaining.request_id=p_request_id and remaining.state='pending'
     and remaining.expires_at>now()
  ) then
    update public.jitap_wave_dispatch_jobs set
     started_at=least(started_at,now()-(o.wave*interval '15 seconds')),
     updated_at=now()
    where request_id=p_request_id and state='searching';
  end if;
  return jsonb_build_object('status','declined');
 end if;
 update public.jitap_wave_dispatch_jobs set state='matched',
  matched_provider_user_id=p_provider_user_id,accepted_at=now(),updated_at=now()
  where request_id=p_request_id;
 update public.jitap_wave_offers set state=case when provider_user_id=p_provider_user_id
  then 'matched' else 'dismissed' end
  where request_id=p_request_id and state='pending';
 update public.coordinator_cases set status='provider_contacted',updated_at=now()
  where source_kind='website_request' and source_id=p_request_id
    and status in ('new','matching','needs_sourcing');
 return jsonb_build_object('status','matched','requestId',p_request_id);
end $function$

revoke all on function public.jitap_wave_respond(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.jitap_wave_respond(uuid,uuid,text) to service_role;
