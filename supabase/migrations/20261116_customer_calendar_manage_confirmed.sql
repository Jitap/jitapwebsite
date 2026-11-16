-- Changes to an already confirmed scheduled booking require a fresh
-- provider decision. The original appointment remains valid until accepted.
alter table public.jitap_customer_calendar_bookings drop constraint if exists jitap_customer_calendar_bookings_status_check;
alter table public.jitap_customer_calendar_bookings add constraint jitap_customer_calendar_bookings_status_check
 check(status in ('draft','pending','proposed','accepted','declined','change_requested','change_proposed','cancelled'));
create or replace function public.jitap_customer_manage_calendar_booking(
 p_customer uuid,p_booking uuid,p_action text,
 p_start timestamptz default null,p_end timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.jitap_customer_calendar_bookings%rowtype; a public.jitap_provider_appointments%rowtype;
begin
 select * into b from public.jitap_customer_calendar_bookings
 where id=p_booking and customer_user_id=p_customer for update;
 if not found then return jsonb_build_object('error','booking_not_found');end if;
 select * into a from public.jitap_provider_appointments where request_id=b.request_id for update;
 if p_action='cancel' then
  if b.status='cancelled' then return jsonb_build_object('error','already_cancelled');end if;
  if a.id is not null and a.status in ('on_my_way','arrived','in_progress','completed')
   then return jsonb_build_object('error','job_already_started');end if;
  update public.jitap_customer_calendar_bookings set status='cancelled',
   updated_at=now(),invitation_version=invitation_version+1 where id=b.id;
  if a.id is not null then
   update public.jitap_provider_appointments set status='cancelled',updated_at=now() where id=a.id;
  end if;
  update public.website_intake set status='cancelled',updated_at=now() where id=b.request_id
   and status in ('new','scheduled');
  return jsonb_build_object('ok',true,'status','cancelled');
 elsif p_action='reschedule' then
  if b.status<>'accepted' or a.id is null or a.status<>'confirmed'
   then return jsonb_build_object('error','booking_not_confirmed');end if;
  if p_start is null or p_end is null or p_start<now()+interval '20 minutes'
  or p_start>now()+interval '180 days' or p_end<=p_start or p_end>p_start+interval '12 hours'
   then return jsonb_build_object('error','invalid_schedule');end if;
  if exists(select 1 from public.jitap_provider_appointments other
   where other.provider_user_id=b.provider_user_id and other.id<>a.id
    and other.status not in ('completed','cancelled')
    and other.starts_at<p_end and other.ends_at>p_start)
   then return jsonb_build_object('error','provider_has_conflict');end if;
  update public.jitap_customer_calendar_bookings set status='change_requested',
   proposed_start_at=p_start,proposed_end_at=p_end,updated_at=now(),
   invitation_version=invitation_version+1 where id=b.id;
  return jsonb_build_object('ok',true,'status','change_requested');
 end if;
 return jsonb_build_object('error','invalid_action');
end $$;
revoke all on function public.jitap_customer_manage_calendar_booking(uuid,uuid,text,timestamptz,timestamptz)
 from public,anon,authenticated;
grant execute on function public.jitap_customer_manage_calendar_booking(uuid,uuid,text,timestamptz,timestamptz) to service_role;

create or replace function public.jitap_provider_manage_calendar_change(
 p_provider uuid,p_booking uuid,p_action text,
 p_start timestamptz default null,p_end timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.jitap_customer_calendar_bookings%rowtype;a public.jitap_provider_appointments%rowtype;
begin
 select * into b from public.jitap_customer_calendar_bookings
 where id=p_booking and provider_user_id=p_provider and status='change_requested' for update;
 if not found then return jsonb_build_object('error','change_not_pending');end if;
 select * into a from public.jitap_provider_appointments where request_id=b.request_id for update;
 if a.id is null or a.provider_user_id<>p_provider or a.status<>'confirmed'
  then return jsonb_build_object('error','appointment_unavailable');end if;
 if p_action='decline' then
  update public.jitap_customer_calendar_bookings set status='accepted',
   proposed_start_at=null,proposed_end_at=null,updated_at=now() where id=b.id;
  return jsonb_build_object('ok',true,'status','accepted','changeDeclined',true);
 elsif p_action='accept' then
  if b.proposed_start_at<now()+interval '5 minutes' then
   return jsonb_build_object('error','proposed_time_passed');end if;
  if exists(select 1 from public.jitap_provider_appointments other
   where other.provider_user_id=p_provider and other.id<>a.id
   and other.status not in ('cancelled','completed')
   and other.starts_at<b.proposed_end_at and other.ends_at>b.proposed_start_at)
   then return jsonb_build_object('error','schedule_conflict');end if;
  update public.jitap_provider_appointments set starts_at=b.proposed_start_at,
   ends_at=b.proposed_end_at,updated_at=now() where id=a.id;
  update public.jitap_customer_calendar_bookings set starts_at=proposed_start_at,
   ends_at=proposed_end_at,status='accepted',proposed_start_at=null,
   proposed_end_at=null,updated_at=now() where id=b.id;
  return jsonb_build_object('ok',true,'status','accepted');
 elsif p_action='propose' then
  if p_start is null or p_end is null or p_start<now()+interval '20 minutes'
   or p_end<=p_start or p_end>p_start+interval '12 hours'
   then return jsonb_build_object('error','invalid_schedule');end if;
  update public.jitap_customer_calendar_bookings set status='change_proposed',
   proposed_start_at=p_start,proposed_end_at=p_end,
   responded_at=now(),updated_at=now() where id=b.id;
  return jsonb_build_object('ok',true,'status','change_proposed');
 end if;
 return jsonb_build_object('error','invalid_action');
end $$;
revoke all on function public.jitap_provider_manage_calendar_change(uuid,uuid,text,timestamptz,timestamptz)
 from public,anon,authenticated;
grant execute on function public.jitap_provider_manage_calendar_change(uuid,uuid,text,timestamptz,timestamptz) to service_role;

create or replace function public.jitap_customer_respond_calendar_change(
 p_customer uuid,p_booking uuid,p_accept boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.jitap_customer_calendar_bookings%rowtype;a public.jitap_provider_appointments%rowtype;
begin
 select * into b from public.jitap_customer_calendar_bookings
 where id=p_booking and customer_user_id=p_customer and status='change_proposed' for update;
 if not found then return jsonb_build_object('error','change_not_pending');end if;
 select * into a from public.jitap_provider_appointments where request_id=b.request_id for update;
 if a.id is null or a.status<>'confirmed' then return jsonb_build_object('error','appointment_unavailable');end if;
 if not p_accept then
  update public.jitap_customer_calendar_bookings set status='accepted',
   proposed_start_at=null,proposed_end_at=null,updated_at=now() where id=b.id;
  return jsonb_build_object('ok',true,'status','accepted','changeDeclined',true);
 end if;
 if b.proposed_start_at<now()+interval '5 minutes'
 or exists(select 1 from public.jitap_provider_appointments other
  where other.provider_user_id=b.provider_user_id and other.id<>a.id
  and other.status not in ('completed','cancelled')
  and other.starts_at<b.proposed_end_at and other.ends_at>b.proposed_start_at)
 then return jsonb_build_object('error','schedule_conflict');end if;
 update public.jitap_provider_appointments set starts_at=b.proposed_start_at,
  ends_at=b.proposed_end_at,updated_at=now() where id=a.id;
 update public.jitap_customer_calendar_bookings set starts_at=proposed_start_at,
  ends_at=proposed_end_at,status='accepted',proposed_start_at=null,
  proposed_end_at=null,updated_at=now() where id=b.id;
 return jsonb_build_object('ok',true,'status','accepted');
end $$;
revoke all on function public.jitap_customer_respond_calendar_change(uuid,uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.jitap_customer_respond_calendar_change(uuid,uuid,boolean) to service_role;
