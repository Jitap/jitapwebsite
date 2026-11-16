create table if not exists public.jitap_calendar_delivery_attempts(
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.jitap_customer_calendar_bookings(id) on delete cascade,
 event_type text not null check(event_type in ('invite','declined','proposed','accepted')),
 recipient_role text not null check(recipient_role in ('provider','customer')),
 channel text not null check(channel in ('sms','whatsapp')),
 status text not null default 'reserved' check(status in ('reserved','submitted','failed','skipped','needs_template')),
 provider_message_id text,
 error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(booking_id,event_type,channel,recipient_role)
);
alter table public.jitap_calendar_delivery_attempts enable row level security;
revoke all on table public.jitap_calendar_delivery_attempts from public,anon,authenticated;
grant all on table public.jitap_calendar_delivery_attempts to service_role;