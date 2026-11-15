-- Suppress competing offers after other dispatch channels match, and escalate all-unmatched waves to SOD.
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
  -- A match through legacy SMS/regular BUZZ invalidates all competing wave offers.
  if exists(select 1 from public.website_intake w where w.id=job.request_id and w.status<>'new')
   or exists(select 1 from public.jitap_provider_appointments a where a.request_id=job.request_id)
   or exists(select 1 from public.coordinator_provider_assignments a
      join public.coordinator_cases c on c.id=a.case_id
      where c.source_kind='website_request' and c.source_id=job.request_id and a.state='accepted')
   or exists(select 1 from public.jitap_provider_buzz_responses b
      where b.request_id=job.request_id and b.decision='accepted')
  then
   update public.jitap_wave_dispatch_jobs set state='matched',updated_at=now()
    where request_id=job.request_id and state='searching';
   update public.jitap_wave_offers set state='dismissed'
    where request_id=job.request_id and state='pending';
   continue;
  end if;
   if now()>=job.started_at+interval '45 seconds' then
   update public.jitap_wave_dispatch_jobs
    set state='needs_sourcing',updated_at=now() where request_id=job.request_id and state='searching';
   update public.coordinator_cases set status='needs_sourcing',updated_at=now()
    where source_kind='website_request' and source_id=job.request_id and status in ('new','matching');
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

revoke all on function public.jitap_wave_dispatch_tick(integer) from public,anon,authenticated;
grant execute on function public.jitap_wave_dispatch_tick(integer) to service_role;