alter table public.jitap_calendar_delivery_attempts
 drop constraint if exists jitap_calendar_delivery_attempts_event_type_check;
alter table public.jitap_calendar_delivery_attempts
 add constraint jitap_calendar_delivery_attempts_event_type_check
 check (event_type in ('invite','proposed','declined','accepted','cancelled','reschedule_requested'));