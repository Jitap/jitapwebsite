-- JiTap Expo push outbox: private native device registrations and exactly one
-- delivery attempt per Wave BUZZ offer/device. An Expo "ok" is not handset delivery.
create table if not exists public.jitap_push_devices(
 provider_user_id uuid not null references auth.users(id) on delete cascade,
 device_id uuid not null,
 platform text not null check(platform in ('android','ios')),
 expo_push_token text not null unique,
 enabled boolean not null default true,
 registered_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 primary key(provider_user_id,device_id)
);
create index if not exists jitap_push_devices_online_idx on public.jitap_push_devices(provider_user_id)
 where enabled;
create table if not exists public.jitap_wave_push_outbox(
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null,
 provider_user_id uuid not null,
 device_id uuid not null,
 platform text not null check(platform in ('android','ios')),
 expires_at timestamptz not null,
 state text not null default 'pending' check(state in ('pending','processing','submitted','checking','receipt_ok','failed','expired')),
 expo_ticket_id text,
 expo_error_code text,
 attempt_count integer not null default 0,
 processed_at timestamptz,
 receipt_checked_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(request_id,provider_user_id) references public.jitap_wave_offers(request_id,provider_user_id) on delete cascade,
 foreign key(provider_user_id,device_id) references public.jitap_push_devices(provider_user_id,device_id) on delete cascade,
 unique(request_id,provider_user_id,device_id)
);
create index if not exists jitap_wave_push_outbox_claim_idx on public.jitap_wave_push_outbox(state,created_at)
 where state='pending';
create index if not exists jitap_wave_push_outbox_receipts_idx on public.jitap_wave_push_outbox(state,processed_at)
 where state='submitted';
alter table public.jitap_push_devices enable row level security;
alter table public.jitap_wave_push_outbox enable row level security;
revoke all on public.jitap_push_devices, public.jitap_wave_push_outbox from public,anon,authenticated;
grant all on public.jitap_push_devices, public.jitap_wave_push_outbox to service_role;

create or replace function public.jitap_queue_wave_push()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state='pending' and new.expires_at>now() then
  insert into public.jitap_wave_push_outbox(request_id,provider_user_id,device_id,platform,expires_at)
  select new.request_id,new.provider_user_id,d.device_id,d.platform,new.expires_at
  from public.jitap_push_devices d where d.provider_user_id=new.provider_user_id and d.enabled
  on conflict do nothing;
 end if;
 return new;
end $$;
drop trigger if exists jitap_queue_wave_push on public.jitap_wave_offers;
create trigger jitap_queue_wave_push after insert on public.jitap_wave_offers
 for each row execute function public.jitap_queue_wave_push();

-- The dispatcher receives a secret from pg_cron/pg_net, not from native clients.
-- Do not expose token values in diagnostic queries or logs.
do $do$ begin
 if not exists(select 1 from vault.secrets where name='jitap_wave_push_dispatch_auth') then
  perform vault.create_secret(encode(gen_random_bytes(32),'hex'),'jitap_wave_push_dispatch_auth');
 end if;
end $do$;

create or replace function public.jitap_push_authorized(p_dispatch_secret text)
returns boolean language sql security definer set search_path='' as $$
 select length(coalesce(p_dispatch_secret,''))>=40 and exists (
  select 1 from vault.decrypted_secrets s
  where s.name='jitap_wave_push_dispatch_auth'
  and s.decrypted_secret=p_dispatch_secret
 );
$$;
revoke all on function public.jitap_push_authorized(text) from public,anon,authenticated;
grant execute on function public.jitap_push_authorized(text) to service_role;

create or replace function public.jitap_claim_wave_push(p_dispatch_secret text,p_limit int default 40)
returns table(
 id uuid, expo_push_token text, platform text, request_id uuid,
 provider_user_id uuid, expires_at timestamptz, category text
)
language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function public.jitap_claim_wave_push(text,int) from public,anon,authenticated;
grant execute on function public.jitap_claim_wave_push(text,int) to service_role;

create or replace function public.jitap_claim_wave_receipts(p_dispatch_secret text,p_limit int default 50)
returns table(id uuid,expo_ticket_id text)
language plpgsql security definer set search_path='' as $$
begin
 if not public.jitap_push_authorized(p_dispatch_secret) then
  raise exception 'Unauthorized dispatch' using errcode='42501';end if;
 return query with selected as (
  select q.id from public.jitap_wave_push_outbox q
  where q.state='submitted' and q.expo_ticket_id is not null
  and q.processed_at<now()-interval '15 minutes'
  and q.processed_at>now()-interval '24 hours'
  order by q.processed_at limit least(greatest(p_limit,1),100)
  for update skip locked
 ), claimed as (
  update public.jitap_wave_push_outbox q
  set state='checking' from selected s where q.id=s.id
  returning q.id,q.expo_ticket_id
 )
 select c.id,c.expo_ticket_id from claimed c;
end $$;
revoke all on function public.jitap_claim_wave_receipts(text,int) from public,anon,authenticated;
grant execute on function public.jitap_claim_wave_receipts(text,int) to service_role;
