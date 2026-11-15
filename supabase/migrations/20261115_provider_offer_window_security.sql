create table if not exists public.jitap_provider_offer_windows (
 request_id uuid not null references public.website_intake(id) on delete cascade,
 provider_user_id uuid not null references auth.users(id) on delete cascade,
 round_id uuid not null default '00000000-0000-0000-0000-000000000000'::uuid,
 issued_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '59 seconds'),
 constraint jitap_provider_offer_windows_pk primary key(request_id,provider_user_id,round_id),
 constraint jitap_provider_offer_windows_expiry check(expires_at>issued_at)
);
create index if not exists jitap_offer_windows_active_idx on public.jitap_provider_offer_windows(provider_user_id,expires_at desc);
alter table public.jitap_provider_offer_windows enable row level security;
revoke all on public.jitap_provider_offer_windows from public,anon,authenticated;
grant select on public.jitap_provider_offer_windows to authenticated;
drop policy if exists jitap_provider_offer_owner_read on public.jitap_provider_offer_windows;
create policy jitap_provider_offer_owner_read on public.jitap_provider_offer_windows
 for select to authenticated using (provider_user_id = (select auth.uid()));
alter table public.provider_response_links add column if not exists opened_at timestamptz;
create or replace function public.jitap_canonical_trade(p_trade text) returns text
 language sql immutable parallel safe set search_path to '' as $canonical$
 select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_trade,'')))
 when 'it-repairs' then 'it-repairs'
 when 'computer-phone-repair' then 'it-repairs'
 when 'computer repair' then 'it-repairs'
 when 'computer services' then 'it-repairs'
 when 'it / phone / computer services' then 'it-repairs'
 when 'phone repair' then 'it-repairs'
 when 'plumber' then 'plumbing'
 when 'plumbers' then 'plumbing'
 when 'electrician' then 'electrical'
 when 'electricians' then 'electrical'
 when 'moving / delivery' then 'moving'
 when 'relocation' then 'moving'
 when 'appliance repairs' then 'appliance-repair'
 else pg_catalog.lower(pg_catalog.btrim(coalesce(p_trade,'')))
 end;
 $canonical$;
revoke all on function public.jitap_canonical_trade(text) from public,anon;
grant execute on function public.jitap_canonical_trade(text) to authenticated, service_role;