-- Last known provider en-route display, retained when the latest GPS/route
-- lookup temporarily fails. Never exposed directly to anon/authenticated.
create table if not exists public.jitap_en_route_snapshots (
 request_id uuid primary key references public.website_intake(id) on delete cascade,
 provider_user_id uuid not null references auth.users(id) on delete cascade,
 provider_location_label text not null default '',
 location_observed_at timestamptz,
 distance_km numeric(8,2),
 eta_minutes integer,
 route_updated_at timestamptz,
 updated_at timestamptz not null default now(),
 constraint jitap_en_route_distance_positive check(distance_km is null or distance_km>=0),
 constraint jitap_en_route_eta_positive check(eta_minutes is null or eta_minutes>=0)
);
alter table public.jitap_en_route_snapshots enable row level security;
revoke all on table public.jitap_en_route_snapshots from public,anon,authenticated;
grant all on table public.jitap_en_route_snapshots to service_role;
create index if not exists jitap_en_route_snapshots_provider_idx
 on public.jitap_en_route_snapshots(provider_user_id);
