-- Verify both provider role and approval immediately before claiming a native push.
CREATE OR REPLACE FUNCTION public.jitap_claim_wave_push(p_dispatch_secret text, p_limit integer DEFAULT 40)
 RETURNS TABLE(id uuid, expo_push_token text, platform text, request_id uuid, provider_user_id uuid, expires_at timestamp with time zone, category text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not public.jitap_push_authorized(p_dispatch_secret) then
  raise exception 'Unauthorized dispatch' using errcode='42501';
 end if;
 -- Retire rows whose offer expired or was won elsewhere; no stale push is sent.
 update public.jitap_wave_push_outbox q set state='expired',processed_at=now()
 from public.jitap_wave_offers o
 join public.jitap_wave_dispatch_jobs j on j.request_id=o.request_id
 where q.request_id=o.request_id and q.provider_user_id=o.provider_user_id
 and q.state='pending' and
 (q.expires_at<=now() or o.state<>'pending' or j.state<>'searching');
 return query
 with selected as (
  select q.id from public.jitap_wave_push_outbox q
  join public.jitap_wave_offers o on o.request_id=q.request_id and o.provider_user_id=q.provider_user_id
  join public.jitap_wave_dispatch_jobs j on j.request_id=q.request_id
  join public.jitap_push_devices d on d.provider_user_id=q.provider_user_id and d.device_id=q.device_id
  join public.jitap_provider_workspaces w on w.user_id=q.provider_user_id and w.is_online=true
  join public.jitap_provider_reviews approved on approved.user_id=q.provider_user_id and approved.status='approved'
  join public.jitap_accounts account on account.user_id=q.provider_user_id and account.account_type='provider'
  join public.jitap_wave_provider_locations gps on gps.provider_user_id=q.provider_user_id
  where q.state='pending' and q.expires_at>now()
  and o.state='pending' and j.state='searching' and d.enabled
  and gps.sharing_enabled and gps.observed_at>now()-interval '15 minutes'
  order by q.created_at,q.id limit least(greatest(p_limit,1),50)
  for update of q skip locked
 ), claimed as (
  update public.jitap_wave_push_outbox q
  set state='processing',attempt_count=attempt_count+1,processed_at=now()
  from selected s where q.id=s.id
  returning q.id,q.request_id,q.provider_user_id,q.device_id,q.platform,q.expires_at
 )
 select c.id,d.expo_push_token,c.platform,c.request_id,c.provider_user_id,c.expires_at,j.category
 from claimed c
 join public.jitap_push_devices d on d.provider_user_id=c.provider_user_id and d.device_id=c.device_id
 join public.jitap_wave_dispatch_jobs j on j.request_id=c.request_id;
end $function$

revoke all on function public.jitap_claim_wave_push(text,integer) from public,anon,authenticated;
grant execute on function public.jitap_claim_wave_push(text,integer) to service_role;
