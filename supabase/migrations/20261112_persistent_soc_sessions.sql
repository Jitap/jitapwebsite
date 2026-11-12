-- Persistent staff sessions replace expiring one-hour Supabase JWT cookies.
-- Opaque bearer tokens are never stored as plaintext. Staff revocation is immediate.
create table if not exists public.jitap_coordinator_sessions (
 id uuid primary key default gen_random_uuid(),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 staff_email text not null,
 created_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '90 days'),
 revoked_at timestamptz,
 user_agent_hash text,
 constraint jitap_coordinator_sessions_expiry check(expires_at>created_at)
);
create index if not exists jitap_coordinator_sessions_email_idx
 on public.jitap_coordinator_sessions(lower(staff_email),expires_at desc)
 where revoked_at is null;
create index if not exists jitap_coordinator_sessions_expiration_idx
 on public.jitap_coordinator_sessions(expires_at)
 where revoked_at is null;
alter table public.jitap_coordinator_sessions enable row level security;
revoke all on public.jitap_coordinator_sessions from anon,authenticated;
comment on table public.jitap_coordinator_sessions is 'SOC authenticated session tokens hashed SHA-256. Sliding 90-day inactivity; explicit logout/revocation.';
