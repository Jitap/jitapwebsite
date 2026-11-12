-- Provider-originated off-platform bookings have a one-time, consented SMS invitation.
-- Do not disclose contact details through public tracking previews.
create table if not exists public.jitap_provider_booking_sms (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references public.website_intake(id) on delete cascade,
 provider_user_id uuid not null,
 recipient_phone text not null,
 state text not null default 'sending' check(state in ('sending','submitted','rejected','unknown','skipped')),
 provider_message_id text,
 error_code text,
 consent_confirmed boolean not null check(consent_confirmed=true),
 requested_at timestamptz not null default now(),
 finished_at timestamptz
);
create index if not exists jitap_provider_booking_sms_provider_idx on public.jitap_provider_booking_sms(provider_user_id,requested_at desc);
alter table public.jitap_provider_booking_sms enable row level security;
revoke all on public.jitap_provider_booking_sms from anon,authenticated;
comment on table public.jitap_provider_booking_sms is 'One-time SMS invitation to a provider-sourced customer, with explicit consent and Wasiliana audit';
