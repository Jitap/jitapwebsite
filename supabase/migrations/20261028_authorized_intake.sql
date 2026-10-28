-- Internal token gateway for the JiTap website, when a service-role key is not available.
-- Only Vercel holds the plaintext token; this database keeps a SHA-256 hash.
create schema if not exists jitap_private;
revoke all on schema jitap_private from public, anon, authenticated;
create table if not exists jitap_private.intake_tokens (
  id bigint generated always as identity primary key,
  token_hash text not null unique check (length(token_hash)=64),
  created_at timestamptz not null default now()
);
revoke all on jitap_private.intake_tokens from public, anon, authenticated;

create or replace function public.submit_website_intake_authorized(
  p_kind text,
  p_payload jsonb,
  p_source_hash text,
  p_request_key text,
  p_token text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null
    or pg_catalog.length(p_token) <> 64
    or not exists (
      select 1 from jitap_private.intake_tokens t
       where t.token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex')
    ) then
    raise exception 'unauthorized intake token' using errcode='42501';
  end if;
  return public.submit_website_intake(p_kind,p_payload,p_source_hash,p_request_key);
end;
$$;
revoke all on function public.submit_website_intake_authorized(text,jsonb,text,text,text) from public, authenticated, anon;
grant execute on function public.submit_website_intake_authorized(text,jsonb,text,text,text) to anon, service_role;
comment on function public.submit_website_intake_authorized(text,jsonb,text,text,text) is 'Server-only token authenticated database intake; never include the token in browser JS.';
