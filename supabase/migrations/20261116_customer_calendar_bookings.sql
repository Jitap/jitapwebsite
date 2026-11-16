-- Customer-initiated, asynchronous calendar bookings. Not part of Wave BUZZ.
create table if not exists public.jitap_customer_calendar_bookings(
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references public.website_intake(id) on delete cascade,
 customer_user_id uuid not null references auth.users(id),
 provider_user_id uuid references auth.users(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 note text not null default '' check(length(note)<=500),
 status text not null default 'draft'
 check(status in ('draft','pending','proposed','accepted','declined')),
 proposed_start_at timestamptz,
 proposed_end_at timestamptz,
 response_note text not null default '' check(length(response_note)<=500),
 sent_at timestamptz,
 responded_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint jitap_scheduled_valid_duration check(ends_at>starts_at and ends_at<=starts_at+interval '12 hours')
);
create index if not exists jitap_customer_calendar_provider_pending_idx
on public.jitap_customer_calendar_bookings(provider_user_id,status) where status in ('pending','proposed');
create index if not exists jitap_customer_calendar_customer_idx on public.jitap_customer_calendar_bookings(customer_user_id,starts_at);
alter table public.jitap_customer_calendar_bookings enable row level security;
revoke all on public.jitap_customer_calendar_bookings from public,anon,authenticated;
grant all on public.jitap_customer_calendar_bookings to service_role;

-- Mutations are transactionally serialized by the booking row and validated
-- against existing appointments. Caller identity originates server-side only.
create or replace function public.jitap_customer_save_calendar_booking(
 p_customer uuid,p_request uuid,p_provider uuid,p_start timestamptz,p_end timestamptz,
 p_note text,p_submit boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
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
 end if;
 return jsonb_build_object('ok',true,'id',v_booking.id,'status',v_booking.status);
end $$;
revoke all on function public.jitap_customer_save_calendar_booking(uuid,uuid,uuid,timestamptz,timestamptz,text,boolean) from public,anon,authenticated;
grant execute on function public.jitap_customer_save_calendar_booking(uuid,uuid,uuid,timestamptz,timestamptz,text,boolean) to service_role;

create or replace function public.jitap_provider_respond_calendar_booking(
 p_provider uuid,p_booking uuid,p_action text,
 p_start timestamptz default null,p_end timestamptz default null,p_note text default ''
) returns jsonb language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function public.jitap_provider_respond_calendar_booking(uuid,uuid,text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.jitap_provider_respond_calendar_booking(uuid,uuid,text,timestamptz,timestamptz,text) to service_role;

create or replace function public.jitap_customer_respond_calendar_proposal(
 p_customer uuid,p_booking uuid,p_accept boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.jitap_customer_calendar_bookings%rowtype;
begin
 select * into v from public.jitap_customer_calendar_bookings
 where id=p_booking and customer_user_id=p_customer and status='proposed' for update;
 if not found then return jsonb_build_object('error','proposal_not_available');end if;
 if not p_accept then
  update public.jitap_customer_calendar_bookings set status='declined',
   updated_at=now() where id=v.id;
  return jsonb_build_object('ok',true,'status','declined');
 end if;
 if v.proposed_start_at is null or v.proposed_end_at is null
  or v.proposed_start_at<now()+interval '5 minutes' then
  return jsonb_build_object('error','proposed_time_passed');end if;
 if exists(select 1 from public.jitap_provider_appointments where request_id=v.request_id)
  or exists(select 1 from public.jitap_provider_appointments
   where provider_user_id=v.provider_user_id and status not in ('cancelled','completed')
   and starts_at is not null and starts_at<v.proposed_end_at and ends_at>v.proposed_start_at)
 then return jsonb_build_object('error','schedule_conflict');end if;
 insert into public.jitap_provider_appointments(
  request_id,provider_user_id,starts_at,ends_at,status,confirmed_at)
 values(v.request_id,v.provider_user_id,v.proposed_start_at,v.proposed_end_at,'confirmed',now());
 update public.jitap_customer_calendar_bookings set status='accepted',
  starts_at=proposed_start_at,ends_at=proposed_end_at,updated_at=now()
 where id=v.id;
 update public.coordinator_cases set status='scheduled',updated_at=now()
 where source_kind='website_request' and source_id=v.request_id
 and status not in ('completed','closed','cancelled');
 update public.jitap_wave_dispatch_jobs set state='matched',updated_at=now()
 where request_id=v.request_id and state<>'matched';
 return jsonb_build_object('ok',true,'status','accepted');
end $$;
revoke all on function public.jitap_customer_respond_calendar_proposal(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.jitap_customer_respond_calendar_proposal(uuid,uuid,boolean) to service_role;
