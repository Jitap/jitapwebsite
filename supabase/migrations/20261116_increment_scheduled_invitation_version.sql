CREATE OR REPLACE FUNCTION public.jitap_customer_save_calendar_booking(p_customer uuid, p_request uuid, p_provider uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_note text, p_submit boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_booking public.jitap_customer_calendar_bookings%rowtype;
 v_request public.website_intake%rowtype;
 v_work public.jitap_provider_workspaces%rowtype;
begin
 if p_customer is null or p_request is null or p_start is null or p_end is null
  or p_start<now()+interval '20 minutes' or p_start>now()+interval '180 days'
  or p_end<=p_start or p_end>p_start+interval '12 hours'
  or length(coalesce(p_note,''))>500 then
  return jsonb_build_object('error','invalid_schedule');
 end if;
 select * into v_request from public.website_intake
  where id=p_request and kind='request' and customer_user_id=p_customer for update;
 if not found then return jsonb_build_object('error','request_not_found');end if;
 if v_request.status in ('completed','closed','cancelled') or exists(
  select 1 from public.jitap_provider_appointments where request_id=p_request
 ) then return jsonb_build_object('error','request_already_booked');end if;
 select * into v_booking from public.jitap_customer_calendar_bookings
  where request_id=p_request for update;
 if found and v_booking.status in ('pending','proposed','accepted') then
  return jsonb_build_object('error','booking_pending','bookingId',v_booking.id);
 end if;
 if p_submit then
  if p_provider is null then return jsonb_build_object('error','choose_provider');end if;
  select * into v_work from public.jitap_provider_workspaces where user_id=p_provider;
  if not found or not exists(select 1 from public.jitap_provider_reviews
   where user_id=p_provider and status='approved')
   or not (v_request.payload->>'category'=any(v_work.categories))
   or not (v_request.payload->>'area'=any(v_work.service_areas)) then
   return jsonb_build_object('error','provider_not_eligible');end if;
  if exists(select 1 from public.jitap_provider_appointments
   where provider_user_id=p_provider and status not in ('cancelled','completed')
   and starts_at is not null and starts_at<p_end and ends_at>p_start) then
   return jsonb_build_object('error','provider_has_conflict');end if;
 end if;
 if v_booking.id is not null then
  update public.jitap_customer_calendar_bookings
   set provider_user_id=case when p_submit then p_provider else null end,
   starts_at=p_start,ends_at=p_end,note=coalesce(p_note,''),
   status=case when p_submit then 'pending' else 'draft' end,
   proposed_start_at=null,proposed_end_at=null,response_note='',
   invitation_version=invitation_version+case when p_submit then 1 else 0 end,
   sent_at=case when p_submit then now() else null end,
   responded_at=null,updated_at=now()
   where id=v_booking.id returning * into v_booking;
 else
  insert into public.jitap_customer_calendar_bookings(
   request_id,customer_user_id,provider_user_id,starts_at,ends_at,note,status,sent_at)
  values(p_request,p_customer,case when p_submit then p_provider else null end,
   p_start,p_end,coalesce(p_note,''),
   case when p_submit then 'pending' else 'draft' end,
   case when p_submit then now() else null end)
  returning * into v_booking;
 end if;
 if p_submit then
  -- Scheduled bookings bypass Wave BUZZ, including subsequent ticks.
  update public.jitap_wave_dispatch_jobs set state='needs_sourcing',updated_at=now()
  where request_id=p_request and state='searching';
  -- Dismiss any already-issued immediate BUZZ offers for this request.
  update public.jitap_wave_offers set state='dismissed'
   where request_id=p_request and state='pending';
 end if;
 return jsonb_build_object('ok',true,'id',v_booking.id,'status',v_booking.status);
end $function$
