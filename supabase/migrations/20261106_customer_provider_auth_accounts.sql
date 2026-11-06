-- JiTap customer/provider account identity, separate from provider verification status.
create table if not exists public.jitap_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('customer','provider')),
  phone text not null check (phone ~ '^[+]254[17][0-9]{8}),
  full_name text,
  created_at timestamptz not null default now()
);
create index if not exists jitap_accounts_type_idx on public.jitap_accounts (account_type);
alter table public.jitap_accounts enable row level security;
revoke all on public.jitap_accounts from anon;
grant select, insert on public.jitap_accounts to authenticated;
drop policy if exists jitap_accounts_read_self on public.jitap_accounts;
create policy jitap_accounts_read_self on public.jitap_accounts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists jitap_accounts_insert_self on public.jitap_accounts;
create policy jitap_accounts_insert_self on public.jitap_accounts for insert to authenticated
with check ((select auth.uid()) = user_id);
-- Account type is a customer-facing signup preference, NEVER proof of provider approval.
-- Do not grant access to provider opportunities based solely on this account_type.
),
  full_name text,
  created_at timestamptz not null default now()
);
create index if not exists jitap_accounts_type_idx on public.jitap_accounts (account_type);
alter table public.jitap_accounts enable row level security;
revoke all on public.jitap_accounts from anon;
grant select, insert on public.jitap_accounts to authenticated;
drop policy if exists jitap_accounts_read_self on public.jitap_accounts;
create policy jitap_accounts_read_self on public.jitap_accounts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists jitap_accounts_insert_self on public.jitap_accounts;
create policy jitap_accounts_insert_self on public.jitap_accounts for insert to authenticated
with check ((select auth.uid()) = user_id);
-- Account type is a customer-facing signup preference, NEVER proof of provider approval.
-- Do not grant access to provider opportunities based solely on this account_type.
