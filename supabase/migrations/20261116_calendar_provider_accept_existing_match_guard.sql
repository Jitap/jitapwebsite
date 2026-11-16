CREATE OR REPLACE FUNCTION public.jitap_provider_respond_calendar_booking(p_provider uuid, p_booking uuid, p_action text, p_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end timestamp with time zone DEFAULT NULL::timestamp with time zone, p_note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v public.jitap_customer_calendar_bookings%rowtype;
begin
 select * into v from public.jitap_customer_calendar_bookings
 where id=p_booking and provider_user_id=p_provider and status='pending' for update;
 if not found then return jsonb_build_object('error','invitation_not_available');end if;
 if p_action='decline' then
  update public.jitap_customer_calendar_bookings set status='declined',
  responded_at=now(),updated_at=now() where id=v.id;
  return jsonb_build_object('ok',true,'status','declined');
 elsif p_action='propose' then
  if p_start is null or p_end is null or p_start<now()+interval '20 minutes'
  or p_start>now()+interval '180 days' or p_end<=p_start
  or p_end>p_start+interval '12 hours' or length(coalesce(p_note,''))>500 then
   return jsonb_build_object('error','invalid_schedule');end if;
  update public.jitap_customer_calendar_bookings
   set status='proposed',proposed_start_at=p_start,proposed_end_at=p_end,
   response_note=coalesce(p_note,''),responded_at=now(),updated_at=now()
   where id=v.id;
  return jsonb_build_object('ok',true,'status','proposed');
 elsif p_action='accept' then
  if v.starts_at<now()+interval '5 minutes' then
   return jsonb_build_object('error','booking_time_passed');end if;
  if exists(select 1 from public.jitap_provider_appointments
   where provider_user_id=p_provider and status not in ('cancelled','completed')
   and starts_at is not null and starts_at<v.ends_at and ends_at>v.starts_at) then
   return jsonb_build_object('error','schedule_conflict');end if;
  if exists(select 1 from public.coordinator_provider_assignments a
    join public.coordinator_cases c on c.id=a.case_id
    where c.source_kind='website_request' and c.source_id=v.request_id and a.state='accepted')
   or exists(select 1 from public.jitap_provider_buzz_responses b
    where b.request_id=v.request_id and b.decision='accepted') then
   return jsonb_build_object('error','request_already_matched');end if;
  if exists(select 1 from public.jitap_provider_appointments where request_id=v.request_id) then
   return jsonb_build_object('error','request_already_matched');end if;
  insert into public.jitap_provider_appointments(
   request_id,provider_user_id,starts_at,ends_at,status,confirmed_at)
  values(v.request_id,p_provider,v.starts_at,v.ends_at,'confirmed',now());
  update public.jitap_customer_calendar_bookings
   set status='accepted',responded_at=now(),updated_at=now() where id=v.id;
  update public.coordinator_cases set status='scheduled',updated_at=now()
   where source_kind='website_request' and source_id=v.request_id
   and status not in ('completed','closed','cancelled');
  update public.jitap_wave_dispatch_jobs set state='matched',updated_at=now()
   where request_id=v.request_id and state<>'matched';
  return jsonb_build_object('ok',true,'status','accepted');
 end if;
 return jsonb_build_object('error','invalid_action');
end $function$
