-- One SMS receipt per saved service request. Never send on failed saves or duplicate retries.
-- This table contains delivery metadata only; customer contact remains in private intake payload.
create table if not exists public.website_request_receipt_sms (
 request_id uuid primary key references public.website_intake(id) on delete cascade,
 state text not null default 'processing' check (state in ('processing','submitted','failed','unknown')),
 provider_message_id text,
 gateway_http_status integer,
 error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.website_request_receipt_sms enable row level security;
revoke all on public.website_request_receipt_sms from public,anon,authenticated;

-- Verify the private intake bearer token before claiming a receipt. Keeping
-- this database claim atomic prevents duplicate acknowledgments during retries.
create or replace function public.claim_website_request_receipt_sms(
 p_request_id uuid,p_token text
) returns boolean language plpgsql security definer set search_path=''
as $$
declare v_phone text; v_eligible boolean; v_claimed integer;
begin
 if p_token is null or pg_catalog.length(p_token) <> 64 or not exists (
   select 1 from jitap_private.intake_tokens t
   where t.token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex')
 ) then raise exception 'unauthorized intake token' using errcode='42501'; end if;
 select regexp_replace(coalesce(payload->>'phone',''),'[^0-9]','','g'),
        kind='request' and (payload->>'consent')='true'
 into v_phone,v_eligible
 from public.website_intake where id=p_request_id;
 if not coalesce(v_eligible,false) or v_phone !~ '^([+]?254|0)[17][0-9]{8}$' then return false; end if;
 -- Limit chargeable SMS acknowledgments to 3 per mobile per hour.
 if (select count(*) from public.website_request_receipt_sms s
   join public.website_intake w on w.id=s.request_id
   where regexp_replace(coalesce(w.payload->>'phone',''),'[^0-9]','','g')=v_phone
     and s.created_at>now()-interval '1 hour')>=3 then return false; end if;
 insert into public.website_request_receipt_sms(request_id)
 values(p_request_id) on conflict (request_id) do nothing;
 get diagnostics v_claimed=row_count;
 return v_claimed=1;
end;
$$;
revoke all on function public.claim_website_request_receipt_sms(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_website_request_receipt_sms(uuid,text) to anon;

create or replace function public.complete_website_request_receipt_sms(
 p_request_id uuid,p_token text,p_state text,p_gateway_http_status integer,
 p_provider_message_id text,p_error_code text
) returns boolean language plpgsql security definer set search_path=''
as $$
declare v_count integer;
begin
 if p_token is null or pg_catalog.length(p_token) <> 64 or not exists (
   select 1 from jitap_private.intake_tokens t
   where t.token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex')
 ) then raise exception 'unauthorized intake token' using errcode='42501'; end if;
 if p_state not in ('submitted','failed','unknown') then
   raise exception 'invalid SMS state' using errcode='22023';
 end if;
 update public.website_request_receipt_sms
 set state=p_state,
     gateway_http_status=p_gateway_http_status,
     provider_message_id=left(p_provider_message_id,120),
     error_code=left(p_error_code,100),
     updated_at=now()
 where request_id=p_request_id and state='processing';
 get diagnostics v_count=row_count;
 return v_count=1;
end;
$$;
revoke all on function public.complete_website_request_receipt_sms(uuid,text,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.complete_website_request_receipt_sms(uuid,text,text,integer,text,text) to anon;
