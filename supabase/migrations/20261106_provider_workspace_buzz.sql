-- JiTap provider onboarding + consent-based, approved matching.
-- Identity verification remains a staff action. No wallet or payment objects.
create table if not exists public.jitap_provider_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 business_name text not null default '',
 categories text[] not null default '{}',
 service_areas text[] not null default '{}',
 base_area text not null default '',
 experience_years integer not null default 0 check(experience_years between 0 and 60),
 skills text not null default '',
 is_online boolean not null default false,
 submitted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint workspace_name_limit check(length(full_name)<=120 and length(business_name)<=120),
 constraint workspace_skills_limit check(length(skills)<=1200),
 constraint workspace_categories_limit check(cardinality(categories)<=12),
 constraint workspace_areas_limit check(cardinality(service_areas)<=12)
);
create table if not exists public.jitap_provider_reviews (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_at timestamptz,
 reviewer_notes text,
 updated_at timestamptz not null default now()
);
create table if not exists public.jitap_provider_buzz_responses (
 request_id uuid not null references public.website_intake(id) on delete cascade,
 provider_user_id uuid not null references auth.users(id) on delete cascade,
 decision text not null check(decision in ('accepted','declined','needs_clarification')),
 note text not null default '' check(length(note)<=500),
 created_at timestamptz not null default now(),
 primary key (request_id,provider_user_id)
);
create index if not exists jitap_provider_buzz_responses_user_idx on public.jitap_provider_buzz_responses(provider_user_id,created_at desc);
create index if not exists jitap_provider_workspace_availability_idx on public.jitap_provider_workspaces(is_online) where is_online=true;
alter table public.jitap_provider_workspaces enable row level security;
alter table public.jitap_provider_reviews enable row level security;
alter table public.jitap_provider_buzz_responses enable row level security;
revoke all on public.jitap_provider_workspaces,public.jitap_provider_reviews,public.jitap_provider_buzz_responses from PUBLIC,anon,authenticated;
grant select,insert,update on public.jitap_provider_workspaces to authenticated;
grant select on public.jitap_provider_reviews to authenticated;
grant select on public.jitap_provider_buzz_responses to authenticated;
create policy jitap_workspace_own_read on public.jitap_provider_workspaces for select to authenticated using (user_id=(select auth.uid()));
create policy jitap_workspace_own_insert on public.jitap_provider_workspaces for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.jitap_accounts a where a.user_id=(select auth.uid()) and a.account_type='provider'));
create policy jitap_workspace_own_update on public.jitap_provider_workspaces for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy jitap_provider_review_own_read on public.jitap_provider_reviews for select to authenticated using(user_id=(select auth.uid()));
create policy jitap_provider_response_own_read on public.jitap_provider_buzz_responses for select to authenticated using(provider_user_id=(select auth.uid()));

-- Never allow providers to turn on availability unless a human reviewed their profile.
create or replace function public.jitap_guard_provider_workspace()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.is_online and not exists (
   select 1 from public.jitap_provider_reviews r where r.user_id=new.user_id and r.status='approved'
 ) then raise exception 'Approval is required before going online' using errcode='42501'; end if;
 if new.is_online and (length(trim(new.full_name))<2 or cardinality(new.categories)=0 or cardinality(new.service_areas)=0)
 then raise exception 'Complete your profile before going online' using errcode='22023'; end if;
 if new.is_online and new.submitted_at is null then raise exception 'Submit your profile before going online' using errcode='22023'; end if;
 new.updated_at=now();
 return new;
end; $$;
revoke all on function public.jitap_guard_provider_workspace() from PUBLIC,anon,authenticated;
drop trigger if exists jitap_workspace_guard on public.jitap_provider_workspaces;
create trigger jitap_workspace_guard before insert or update on public.jitap_provider_workspaces
for each row execute function public.jitap_guard_provider_workspace();

-- Request feed uses a strictly whitelisted summary: no phone, name,
-- detailed description, exact building, GPS or contact details.
create or replace function public.jitap_provider_available_buzz()
returns table(request_id uuid,category text,area text,preferred_date text,preferred_time text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare p public.jitap_provider_workspaces%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into p from public.jitap_provider_workspaces
 where user_id=auth.uid() and is_online=true and submitted_at is not null;
 if not found or not exists(select 1 from public.jitap_provider_reviews v where v.user_id=auth.uid() and v.status='approved') then return; end if;
 return query
 select w.id,w.payload->>'category',w.payload->>'area',
 left(coalesce(w.payload->>'preferredDate',''),30),
 left(coalesce(w.payload->>'preferredTime',''),30),w.created_at
 from public.website_intake w
 where w.kind='request' and w.status='new' and w.created_at>=now()-interval '7 days'
   and (w.payload->>'category')=any(p.categories)
   and (w.payload->>'area')=any(p.service_areas)
   and not exists(select 1 from public.jitap_provider_buzz_responses r
                  where r.request_id=w.id and r.provider_user_id=auth.uid())
 order by w.created_at desc limit 30;
end; $$;
revoke all on function public.jitap_provider_available_buzz() from PUBLIC,anon;
grant execute on function public.jitap_provider_available_buzz() to authenticated;

-- An acceptance is interest only, not a confirmed booking.
create or replace function public.jitap_provider_answer_buzz(
 p_request_id uuid,p_decision text,p_note text default ''
) returns boolean language plpgsql security definer set search_path='' as $$
declare p public.jitap_provider_workspaces%rowtype; w public.website_intake%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_decision not in ('accepted','declined','needs_clarification') or length(coalesce(p_note,''))>500
    or (p_decision='needs_clarification' and length(trim(coalesce(p_note,'')))<3)
 then raise exception 'Invalid response' using errcode='22023'; end if;
 select * into p from public.jitap_provider_workspaces where user_id=auth.uid() and is_online=true;
 if not found or not exists(select 1 from public.jitap_provider_reviews v where v.user_id=auth.uid() and v.status='approved')
 then raise exception 'Provider is not approved and online' using errcode='42501'; end if;
 select * into w from public.website_intake where id=p_request_id and kind='request' and status='new' and created_at>=now()-interval '7 days';
 if not found or not ((w.payload->>'category')=any(p.categories) and (w.payload->>'area')=any(p.service_areas))
 then raise exception 'Opportunity unavailable' using errcode='42501'; end if;
 insert into public.jitap_provider_buzz_responses(request_id,provider_user_id,decision,note)
 values(p_request_id,auth.uid(),p_decision,coalesce(trim(p_note),''))
 on conflict do nothing;
 return found;
end; $$;
revoke all on function public.jitap_provider_answer_buzz(uuid,text,text) from PUBLIC,anon;
grant execute on function public.jitap_provider_answer_buzz(uuid,text,text) to authenticated;
