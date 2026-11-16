alter table public.jitap_customer_calendar_bookings
 add column if not exists invitation_version integer not null default 1;
alter table public.jitap_calendar_delivery_attempts
 add column if not exists invitation_version integer not null default 1;
alter table public.jitap_calendar_delivery_attempts
 drop constraint if exists jitap_calendar_delivery_attempts_booking_id_event_type_channel_recipient_role_key;
create unique index if not exists jitap_calendar_delivery_per_invite_unique
 on public.jitap_calendar_delivery_attempts(booking_id,invitation_version,event_type,channel,recipient_role);