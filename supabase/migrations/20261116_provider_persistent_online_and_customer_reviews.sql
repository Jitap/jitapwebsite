-- A provider's choice to be Online persists until they explicitly go Offline.
-- Stale GPS prevents spatial eligibility, but does not silently change availability.
create or replace function public.jitap_expire_stale_provider_gps()
returns integer language plpgsql security definer set search_path to '' as $$
declare v_count integer;
begin
 delete from public.jitap_wave_provider_locations
 where observed_at<now()-interval '15 minutes';
 get diagnostics v_count=row_count;
 return v_count;
end $$;
revoke all on function public.jitap_expire_stale_provider_gps() from public,anon,authenticated;
grant execute on function public.jitap_expire_stale_provider_gps() to service_role;
-- Customer-to-provider reviews are separate from jitap_customer_ratings,
-- which represents the PROVIDER rating a customer, not the reverse.
create table if not exists public.jitap_customer_provider_reviews(
 id uuid primary key default gen_random_uuid(),
 appointment_id uuid not null unique references public.jitap_provider_appointments(id) on delete cascade,
 request_id uuid not null references public.website_intake(id) on delete cascade,
 provider_user_id uuid not null references auth.users(id),
 customer_user_id uuid not null references auth.users(id),
 stars smallint not null check(stars between 1 and 5),
 comment text not null default '' check(length(comment)<=500),
 created_at timestamptz not null default now()
);
create index if not exists jitap_customer_provider_reviews_provider_idx
 on public.jitap_customer_provider_reviews(provider_user_id,created_at desc);
alter table public.jitap_customer_provider_reviews enable row level security;
revoke all on public.jitap_customer_provider_reviews from public,anon,authenticated;
grant all on public.jitap_customer_provider_reviews to service_role;
