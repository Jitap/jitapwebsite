-- Allow a phone-verified JiTap provider to submit service requests only
-- through the explicit customer-mode API, without forfeiting their provider approval.
create or replace function public.submit_website_intake_customer_authorized(
 p_kind text,p_payload jsonb,p_source_hash text,p_request_key text,p_token text,p_customer_user_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_phone text;v_payload_phone text;v_owner uuid;
begin
 if p_kind<>'request' or p_customer_user_id is null then raise exception 'invalid customer request' using errcode='22023';end if;
 select regexp_replace(a.phone,'[^0-9]','','g') into v_phone from public.jitap_accounts a
 where a.user_id=p_customer_user_id and a.account_type in ('customer','provider');
 v_payload_phone:=regexp_replace(coalesce(p_payload->>'phone',''),'[^0-9]','','g');
 if v_phone is null or v_phone<>v_payload_phone then raise exception 'account phone mismatch' using errcode='22023';end if;
 v_id:=public.submit_website_intake_authorized(p_kind,p_payload,p_source_hash,p_request_key,p_token);
 select customer_user_id into v_owner from public.website_intake where id=v_id for update;
 if v_owner is not null and v_owner<>p_customer_user_id then raise exception 'request belongs to another account' using errcode='42501';end if;
 update public.website_intake set customer_user_id=p_customer_user_id where id=v_id and customer_user_id is null;
 return v_id;
end;$$;
revoke all on function public.submit_website_intake_customer_authorized(text,jsonb,text,text,text,uuid) from PUBLIC,anon,authenticated;
