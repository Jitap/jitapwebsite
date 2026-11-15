-- Applied to JiTap Supabase on 2026-11-15. Source-controlled schema of GPS Wave BUZZ.
-- Real job routing requires explicitly shared, fresh provider GPS positions.
create table if not exists public.jitap_wave_provider_locations(
 provider_user_id uuid primary key references auth.users(id) on delete cascade,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 observed_at timestamptz not null default now(),
 sharing_enabled boolean not null default true
);
create table if not exists public.jitap_wave_dispatch_jobs(
 request_id uuid primary key references public.website_intake(id) on delete cascade,
 category text not null,latitude double precision not null,longitude double precision not null,
 started_at timestamptz not null default now(),
 state text not null default 'searching' check(state in ('searching','matched','needs_sourcing')),
 matched_provider_user_id uuid references auth.users(id),accepted_at timestamptz,
 updated_at timestamptz not null default now()
);
create table if not exists public.jitap_wave_offers(
 request_id uuid not null references public.jitap_wave_dispatch_jobs(request_id) on delete cascade,
 provider_user_id uuid not null references auth.users(id) on delete cascade,
 wave smallint not null check(wave between 1 and 3),
 distance_km numeric(7,3) not null check(distance_km between 0 and 10),
 offered_at timestamptz not null default now(),expires_at timestamptz not null,
 state text not null default 'pending' check(state in ('pending','declined','matched','dismissed')),
 primary key(request_id,provider_user_id),
 constraint wave_offer_expiry_check check(expires_at>offered_at)
);
create index if not exists jitap_wave_offers_active_idx
 on public.jitap_wave_offers(provider_user_id,expires_at desc) where state='pending';
alter table public.jitap_wave_provider_locations enable row level security;
alter table public.jitap_wave_dispatch_jobs enable row level security;
alter table public.jitap_wave_offers enable row level security;
revoke all on public.jitap_wave_provider_locations,public.jitap_wave_dispatch_jobs,public.jitap_wave_offers from public,anon,authenticated;
grant all on public.jitap_wave_provider_locations,public.jitap_wave_dispatch_jobs,public.jitap_wave_offers to service_role;
CREATE OR REPLACE FUNCTION public.jitap_wave_dispatch_tick(p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare job public.jitap_wave_dispatch_jobs%rowtype;
 v_wave integer;
 v_added integer;
 v_total integer:=0;
 v_candidates integer:=0;
 v_deadline timestamptz;
begin
 for job in
  select * from public.jitap_wave_dispatch_jobs j
  where j.state='searching' and j.started_at>=now()-interval '1 day'
  order by j.started_at asc limit least(greatest(p_limit,1),30)
  for update skip locked
 loop
  if now()>=job.started_at+interval '45 seconds' then
   update public.jitap_wave_dispatch_jobs
    set state='needs_sourcing',updated_at=now() where request_id=job.request_id and state='searching';
   continue;
  end if;
  v_wave:=least(3,greatest(1,floor(extract(epoch from (now()-job.started_at))/15)::integer+1));
  v_deadline:=job.started_at+(v_wave*interval '15 seconds');
  with candidates as (
   select p.user_id, d.km, coalesce(rating.average,0) as stars, coalesce(rating.reviews,0) as reviews
   from public.jitap_provider_workspaces p
   join public.jitap_provider_reviews review on review.user_id=p.user_id and review.status='approved'
   join public.jitap_wave_provider_locations gps on gps.provider_user_id=p.user_id
    and gps.sharing_enabled and gps.observed_at>=now()-interval '15 minutes'
   cross join lateral (
    select 6371.0*acos(least(1.0,greatest(-1.0,
     sin(radians(job.latitude))*sin(radians(gps.latitude))+
     cos(radians(job.latitude))*cos(radians(gps.latitude))*
     cos(radians(gps.longitude-job.longitude))))) as km
   ) d
   left join lateral (
    select avg(stars)::numeric as average,count(*)::integer as reviews
    from public.jitap_customer_ratings cr where cr.provider_user_id=p.user_id
   ) rating on true
   where p.is_online=true
   and public.jitap_canonical_trade(job.category)=any(
    array(select public.jitap_canonical_trade(t) from unnest(p.categories) as t))
   and d.km <= 10
   and ((v_wave=1 and d.km<2) or (v_wave=2 and d.km>=2 and d.km<5)
        or (v_wave=3 and d.km>=5 and d.km<=10))
   and not exists(select 1 from public.jitap_wave_offers old
    where old.request_id=job.request_id and old.provider_user_id=p.user_id)
   order by stars desc, reviews desc, d.km asc, p.user_id
   limit 8
  ), inserted as (
   insert into public.jitap_wave_offers(request_id,provider_user_id,wave,distance_km,expires_at)
   select job.request_id,c.user_id,v_wave,round(c.km::numeric,3),v_deadline
   from candidates c where v_deadline>now()
   on conflict do nothing returning provider_user_id
  ) select count(*) into v_added from inserted;
  v_total:=v_total+v_added;
  v_candidates:=v_candidates+1;
 end loop;
 return jsonb_build_object('createdOffers',v_total,'jobsChecked',v_candidates);
end $function$


CREATE OR REPLACE FUNCTION public.jitap_wave_queue_intake()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_lat double precision; v_lng double precision;
begin
 if new.kind<>'request' or new.payload ? 'preferredProviderId' then return new;end if;
 if not (coalesce(new.payload->>'locationLat','')~'^-?[0-9]{1,2}(\.[0-9]+)?$'
 and coalesce(new.payload->>'locationLng','')~'^-?[0-9]{1,3}(\.[0-9]+)?$') then return new;end if;
 v_lat:=(new.payload->>'locationLat')::double precision;
 v_lng:=(new.payload->>'locationLng')::double precision;
 if v_lat not between -5 and 5 or v_lng not between 33 and 42 then return new;end if;
 insert into public.jitap_wave_dispatch_jobs(request_id,category,latitude,longitude)
 values(new.id,public.jitap_canonical_trade(new.payload->>'category'),v_lat,v_lng)
 on conflict(request_id) do nothing;
 return new;
end $function$


CREATE OR REPLACE FUNCTION public.jitap_wave_respond(p_request_id uuid, p_provider_user_id uuid, p_decision text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j public.jitap_wave_dispatch_jobs%rowtype;
 o public.jitap_wave_offers%rowtype;
begin
 if p_decision not in ('accepted','declined') then return jsonb_build_object('status','invalid');end if;
 select * into j from public.jitap_wave_dispatch_jobs
  where request_id=p_request_id for update;
 if not found then return jsonb_build_object('status','not_found');end if;
 if j.state<>'searching' then return jsonb_build_object('status',j.state);end if;
 select * into o from public.jitap_wave_offers
  where request_id=p_request_id and provider_user_id=p_provider_user_id for update;
 if not found or o.state<>'pending' or o.expires_at<=now()
  or j.started_at+interval '45 seconds'<=now() then
  return jsonb_build_object('status','expired');
 end if;
 if p_decision='declined' then
  update public.jitap_wave_offers set state='declined'
   where request_id=p_request_id and provider_user_id=p_provider_user_id;
  return jsonb_build_object('status','declined');
 end if;
 update public.jitap_wave_dispatch_jobs set state='matched',
  matched_provider_user_id=p_provider_user_id,accepted_at=now(),updated_at=now()
  where request_id=p_request_id;
 update public.jitap_wave_offers set state=case when provider_user_id=p_provider_user_id
  then 'matched' else 'dismissed' end
  where request_id=p_request_id and state='pending';
 update public.coordinator_cases set status='provider_contacted',updated_at=now()
  where source_kind='website_request' and source_id=p_request_id
    and status in ('new','matching','needs_sourcing');
 return jsonb_build_object('status','matched','requestId',p_request_id);
end $function$

drop trigger if exists jitap_wave_queue_new_request on public.website_intake;
create trigger jitap_wave_queue_new_request after insert on public.website_intake
 for each row execute function public.jitap_wave_queue_intake();
revoke all on function public.jitap_wave_dispatch_tick(integer) from public,anon,authenticated;
grant execute on function public.jitap_wave_dispatch_tick(integer) to service_role;
revoke all on function public.jitap_wave_queue_intake() from public,anon,authenticated;
grant execute on function public.jitap_wave_queue_intake() to service_role;
revoke all on function public.jitap_wave_respond(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.jitap_wave_respond(uuid,uuid,text) to service_role;
