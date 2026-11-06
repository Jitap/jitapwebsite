-- Associate new authenticated customer requests without exposing guest or other customer records.
alter table public.website_intake
  add column if not exists customer_user_id uuid references auth.users(id) on delete set null;
create index if not exists website_intake_customer_created_idx
 on public.website_intake(customer_user_id,created_at desc)
 where customer_user_id is not null and kind='request';
alter table public.website_intake enable row level security;
drop policy if exists website_intake_customer_read_own on public.website_intake;
create policy website_intake_customer_read_own
 on public.website_intake for select to authenticated
 using (kind='request' and customer_user_id=(select auth.uid()));
-- Authenticated customers can inspect their own records only, not insert/update/delete directly.
grant select (id,kind,payload,status,created_at,customer_user_id) on public.website_intake to authenticated;

-- The server keeps the private intake token; do not allow callers to claim existing guest rows.
-- One transaction submits (or idempotently retrieves) the record and links it to the
-- verified account. Linkage is contingent on a matching verified customer phone.
create or replace function public.submit_website_intake_customer_authorized(
 p_kind text,p_payload jsonb,p_source_hash text,p_request_key text,p_token text,p_customer_user_id uuid
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_phone text; v_payload_phone text; v_owner uuid;
begin
 if p_kind <> 'request' or p_customer_user_id is null then
   raise exception 'invalid customer request' using errcode='22023';
 end if;
 select regexp_replace(a.phone,'[^0-9]','','g') into v_phone
 from public.jitap_accounts a
 where a.user_id=p_customer_user_id and a.account_type='customer';
 v_payload_phone := regexp_replace(coalesce(p_payload->>'phone',''),'[^0-9]','','g');
 if v_phone is null or v_phone <> v_payload_phone then
   raise exception 'customer phone does not match authenticated account' using errcode='22023';
 end if;
 -- Verify the private intake token and preserve the current rate limits/idempotency.
 v_id := public.submit_website_intake_authorized(p_kind,p_payload,p_source_hash,p_request_key,p_token);
 select customer_user_id into v_owner from public.website_intake where id=v_id for update;
 if v_owner is not null and v_owner <> p_customer_user_id then
   raise exception 'request already belongs to another account' using errcode='42501';
 end if;
 update public.website_intake
 set customer_user_id=p_customer_user_id
 where id=v_id and customer_user_id is null;
 return v_id;
end;
$$;
revoke all on function public.submit_website_intake_customer_authorized(text,jsonb,text,text,text,uuid) from PUBLIC,anon,authenticated;
grant execute on function public.submit_website_intake_customer_authorized(text,jsonb,text,text,text,uuid) to anon;
comment on function public.submit_website_intake_customer_authorized(text,jsonb,text,text,text,uuid)
 is 'Backend-token-only transactional request submission tied to a verified JiTap customer account.';
