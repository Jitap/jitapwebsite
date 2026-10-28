-- JiTap website: secure, transactional public intake storage
-- Apply in Supabase SQL Editor with an authorized administrator account.
-- Do not enable public INSERT permissions or expose service-role keys in browsers.

create extension if not exists pgcrypto;

create table if not exists public.website_intake (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('request','provider','contact','early-access')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  requester_hash text not null check (length(requester_hash) = 64),
  idempotency_key text not null check (length(idempotency_key) = 64),
  status text not null default 'new' check (status in ('new','reviewing','handled','spam','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_intake_idempotency_unique unique (kind,idempotency_key)
);

create index if not exists website_intake_created_at_idx on public.website_intake(created_at desc);
create index if not exists website_intake_kind_status_idx on public.website_intake(kind,status,created_at desc);
create index if not exists website_intake_source_recent_idx on public.website_intake(requester_hash,created_at desc);

alter table public.website_intake enable row level security;
revoke all on public.website_intake from anon, authenticated;
-- Only the backend service role can invoke this function. No public direct table access.
create or replace function public.submit_website_intake(
 p_kind text,
 p_payload jsonb,
 p_source_hash text,
 p_request_key text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
 if p_kind not in ('request','provider','contact','early-access') then
   raise exception 'invalid kind' using errcode='22023';
 end if;
 if p_source_hash !~ '^[0-9a-f]{64}$' or p_request_key !~ '^[0-9a-f]{64}$' then
   raise exception 'invalid source metadata' using errcode='22023';
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or pg_catalog.octet_length(p_payload::text)>12000 then
   raise exception 'invalid payload' using errcode='22023';
 end if;
 -- Serialize submissions by source to enforce a concurrent-safe rolling rate limit.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_source_hash,0));
 -- Idempotent retries must return existing record, not consume the hourly quota.
 select id into v_id from public.website_intake
  where kind=p_kind and idempotency_key=p_request_key limit 1;
 if v_id is not null then return v_id; end if;
 if (select count(*) from public.website_intake
       where requester_hash=p_source_hash and created_at>now()-interval '1 hour') >= 10 then
   raise exception 'submission rate exceeded' using errcode='P0001';
 end if;
 insert into public.website_intake(kind,payload,requester_hash,idempotency_key)
 values (p_kind,p_payload,p_source_hash,p_request_key)
 returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.submit_website_intake(text,jsonb,text,text) from PUBLIC,anon,authenticated;
grant execute on function public.submit_website_intake(text,jsonb,text,text) to service_role;

-- Restrict payload visibility to backend service_role and privileged administrators.
-- Review Supabase dashboard personnel access before enabling live intake.
comment on table public.website_intake is
 'Private JiTap website intake. Contains personal information. Access using privileged backend only.';
