-- Correct approved-review join in Wave BUZZ accepted-provider guard.
CREATE OR REPLACE FUNCTION public.jitap_wave_respond(p_request_id uuid, p_provider_user_id uuid, p_decision text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j public.jitap_wave_dispatch_jobs%rowtype;
 o public.jitap_wave_offers%rowtype;
 w public.website_intake%rowtype;
 requested_date text;requested_time text;
 scheduled_start timestamptz:=null;scheduled_end timestamptz:=null;
begin
 if p_decision not in ('accepted','declined') then return jsonb_build_object('status','invalid');end if;
 select * into w from public.website_intake where id=p_request_id and kind='request' for update;
 if not found or w.status<>'new' then return jsonb_build_object('status','already_matched');end if;
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
 if p_decision='accepted' and not exists(
  select 1 from public.jitap_provider_workspaces workspace
  join public.jitap_provider_reviews review on review.user_id=workspace.user_id and review.status='approved'
  join public.jitap_accounts account on account.user_id=workspace.user_id and account.account_type='provider'
  join public.jitap_wave_provider_locations gps on gps.provider_user_id=workspace.user_id
  where workspace.user_id=p_provider_user_id and workspace.is_online=true
  and gps.sharing_enabled and gps.observed_at>now()-interval '15 minutes'
 ) then return jsonb_build_object('status','provider_offline');end if;
  if p_decision='accepted' and (
   exists(select 1 from public.jitap_provider_appointments a where a.request_id=p_request_id)
   or exists(select 1 from public.jitap_provider_buzz_responses b where b.request_id=p_request_id and b.decision='accepted')
   or exists(select 1 from public.coordinator_provider_assignments a join public.coordinator_cases c on c.id=a.case_id
     where c.source_kind='website_request' and c.source_id=p_request_id and a.state='accepted')
 ) then return jsonb_build_object('status','already_matched');end if;
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
 requested_date:=w.payload->>'preferredDate';
 requested_time:=w.payload->>'preferredTime';
 if length(coalesce(requested_date,''))=10 and length(coalesce(requested_time,''))=5 then
  begin
   scheduled_start:=(requested_date||' '||requested_time)::timestamp at time zone 'Africa/Nairobi';
   scheduled_end:=scheduled_start+interval '1 hour';
  exception when others then scheduled_start:=null;scheduled_end:=null;end;
 end if;
 insert into public.jitap_provider_appointments(request_id,provider_user_id,starts_at,ends_at,status)
 values(p_request_id,p_provider_user_id,scheduled_start,scheduled_end,'confirmed');
 update public.website_intake set status='scheduled',updated_at=now() where id=p_request_id;
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