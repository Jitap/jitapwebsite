-- JiTap provider profile preferences. Service category approval remains in jitap_provider_workspaces.
create table if not exists public.jitap_provider_profile_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 services jsonb not null default '[]'::jsonb,
 working_hours jsonb not null default '{}'::jsonb,
 language text not null default 'en' check(language in ('en','sw')),
 notifications_enabled boolean not null default true,
 updated_at timestamptz not null default now(),
 constraint services_array check(jsonb_typeof(services)='array'),
 constraint hours_object check(jsonb_typeof(working_hours)='object')
);
alter table public.jitap_provider_profile_preferences enable row level security;
revoke all on public.jitap_provider_profile_preferences from anon;
grant select,insert,update on public.jitap_provider_profile_preferences to authenticated;
drop policy if exists "provider preferences self read" on public.jitap_provider_profile_preferences;
create policy "provider preferences self read" on public.jitap_provider_profile_preferences for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "provider preferences self insert" on public.jitap_provider_profile_preferences;
create policy "provider preferences self insert" on public.jitap_provider_profile_preferences for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "provider preferences self update" on public.jitap_provider_profile_preferences;
create policy "provider preferences self update" on public.jitap_provider_profile_preferences for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
