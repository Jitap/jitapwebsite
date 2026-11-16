-- Authenticated server APIs call these internal aggregates with IDs derived from
-- already authorized bookings. Neither function is callable by browser roles.
create or replace function public.jitap_provider_trust_metrics(p_ids uuid[])
returns table(provider_user_id uuid, rating numeric, rating_count bigint, completed_jobs bigint)
language sql stable security definer set search_path='' as $$
 select ids.id,
  (select round(avg(r.stars)::numeric,1) from public.jitap_customer_provider_reviews r
   where r.provider_user_id=ids.id),
  (select count(*) from public.jitap_customer_provider_reviews r
   where r.provider_user_id=ids.id),
  (select count(*) from public.jitap_provider_appointments a
   where a.provider_user_id=ids.id and a.status='completed')
 from (select distinct unnest(p_ids) id) ids
 where ids.id is not null
 limit 250
$$;
revoke all on function public.jitap_provider_trust_metrics(uuid[]) from public,anon,authenticated;
grant execute on function public.jitap_provider_trust_metrics(uuid[]) to service_role;

create or replace function public.jitap_customer_trust_metrics(p_ids uuid[])
returns table(customer_user_id uuid, rating numeric, rating_count bigint, requested_jobs bigint)
language sql stable security definer set search_path='' as $$
 select ids.id,
  (select round(avg(r.stars)::numeric,1) from public.jitap_customer_ratings r
   where r.customer_user_id=ids.id),
  (select count(*) from public.jitap_customer_ratings r
   where r.customer_user_id=ids.id),
  (select count(*) from public.website_intake w
   where w.customer_user_id=ids.id and w.kind='request')
 from (select distinct unnest(p_ids) id) ids
 where ids.id is not null
 limit 250
$$;
revoke all on function public.jitap_customer_trust_metrics(uuid[]) from public,anon,authenticated;
grant execute on function public.jitap_customer_trust_metrics(uuid[]) to service_role;