-- The SMS token can be delivered within its existing lifetime; the 59-second
-- response offer starts only on the first successful service brief preview.
-- Customer ticket remains open after the individual provider offer expires.
CREATE OR REPLACE FUNCTION public.provider_buzz_preview(p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_link public.provider_response_links%rowtype;v_case public.coordinator_cases%rowtype;
 v_assignment public.coordinator_provider_assignments%rowtype;v_payload jsonb;v_business text;
begin
 select * into v_link from public.provider_response_links where token_hash=p_token_hash for update;
 if not found then return jsonb_build_object('status','invalid');end if;
 if v_link.used_at is not null then return jsonb_build_object('status','responded','decision',v_link.decision);end if;
 if v_link.expires_at<=now() then return jsonb_build_object('status','expired');end if;
 if v_link.opened_at is not null and v_link.opened_at+interval '59 seconds'<=now() then return jsonb_build_object('status','expired');end if;
 select * into v_case from public.coordinator_cases where id=v_link.case_id;
 select * into v_assignment from public.coordinator_provider_assignments where id=v_link.assignment_id;
 if v_case.status in ('cancelled','closed','completed') or v_assignment.state not in ('proposed','contacted','needs_clarification','quote_requested') then
  return jsonb_build_object('status','unavailable');end if;
 update public.provider_response_links
 set opened_at=coalesce(opened_at,now())
 where token_hash=p_token_hash
 returning * into v_link;
 select business_name into v_business from public.provider_profiles where id=v_assignment.provider_id;
 if v_case.source_kind='website_request' then
  select payload into v_payload from public.website_intake where id=v_case.source_id;
 else
  v_payload:='{}'::jsonb;
 end if;
 return jsonb_build_object('status','open','business',v_business,'ref','JT-'||upper(left(replace(v_case.source_id::text,'-',''),8)),
  'category',left(coalesce(v_payload->>'category','Service request'),80),
  'description',left(regexp_replace(coalesce(v_payload->>'description','Service request'),'(?:\\+?254|0)[17][0-9]{8}','[contact withheld]','g'),600),
  'area',left(coalesce(v_payload->>'locationLabel',v_payload->>'area','Mombasa'),130),
  'preferredDate',left(coalesce(v_payload->>'preferredDate',''),35),
  'preferredTime',left(coalesce(v_payload->>'preferredTime',''),35),
  'offerExpiresAt',v_link.opened_at+interval '59 seconds');
end;
$function$
;
CREATE OR REPLACE FUNCTION public.provider_buzz_respond(p_token_hash text, p_decision text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_link public.provider_response_links%rowtype;v_assignment public.coordinator_provider_assignments%rowtype;
 v_case public.coordinator_cases%rowtype;v_note text;
begin
 if p_decision not in ('accepted','declined','needs_clarification') then raise exception 'invalid_response';end if;
 v_note:=nullif(trim(coalesce(p_note,'')),'');
 if length(coalesce(v_note,''))>500 or (p_decision='needs_clarification' and length(coalesce(v_note,''))<3) then raise exception 'invalid_note';end if;
 select * into v_link from public.provider_response_links where token_hash=p_token_hash for update;
 if not found then return jsonb_build_object('status','invalid');end if;
 if v_link.used_at is not null then return jsonb_build_object('status','already_responded','decision',v_link.decision);end if;
 if v_link.expires_at<=now() then return jsonb_build_object('status','expired');end if;
 if v_link.opened_at is null or v_link.opened_at+interval '59 seconds'<=now() then return jsonb_build_object('status','expired');end if;
 select * into v_case from public.coordinator_cases where id=v_link.case_id for update;
 select * into v_assignment from public.coordinator_provider_assignments where id=v_link.assignment_id for update;
 if v_case.status in ('cancelled','closed','completed') or v_assignment.state not in ('proposed','contacted','needs_clarification','quote_requested') then return jsonb_build_object('status','unavailable');end if;
 if p_decision='accepted' and exists(select 1 from public.coordinator_provider_assignments where case_id=v_link.case_id and state='accepted' and id<>v_assignment.id) then return jsonb_build_object('status','already_matched');end if;
 update public.coordinator_provider_assignments set state=p_decision,notes=coalesce(v_note,notes),responded_at=now(),updated_at=now() where id=v_link.assignment_id;
 update public.coordinator_cases set status=case when p_decision='accepted' then 'provider_contacted' else 'needs_sourcing' end,updated_at=now() where id=v_link.case_id;
 update public.provider_response_links set used_at=now(),decision=p_decision,response_note=v_note where token_hash=p_token_hash;
 insert into public.coordinator_activity(case_id,actor_email,action,note,old_value,new_value)
 values(v_link.case_id,'provider-response@jitap.app','note_added','Provider responded via secure BUZZ: '||p_decision||
 case when v_note is null then '' else '. Clarification: '||v_note end,
 v_assignment.state,p_decision);
 return jsonb_build_object('status','recorded','decision',p_decision);
end;
$function$
;