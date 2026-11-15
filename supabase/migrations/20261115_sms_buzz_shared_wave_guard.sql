-- Existing secure SMS BUZZ shares a customer row lock with GPS Wave BUZZ.
CREATE OR REPLACE FUNCTION public.provider_buzz_respond(p_token_hash text, p_decision text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_link public.provider_response_links%rowtype;v_assignment public.coordinator_provider_assignments%rowtype;
 v_case public.coordinator_cases%rowtype;v_note text;
 v_source_id uuid;
 v_request public.website_intake%rowtype;
begin
 if p_decision not in ('accepted','declined','needs_clarification') then raise exception 'invalid_response';end if;
 v_note:=nullif(trim(coalesce(p_note,'')),'');
 if length(coalesce(v_note,''))>500 or (p_decision='needs_clarification' and length(coalesce(v_note,''))<3) then raise exception 'invalid_note';end if;
 select * into v_link from public.provider_response_links where token_hash=p_token_hash for update;
 if not found then return jsonb_build_object('status','invalid');end if;
 if v_link.used_at is not null then return jsonb_build_object('status','already_responded','decision',v_link.decision);end if;
 if v_link.expires_at<=now() then return jsonb_build_object('status','expired');end if;
 if v_link.opened_at is null or v_link.opened_at+interval '59 seconds'<=now() then return jsonb_build_object('status','expired');end if;
 select source_id into v_source_id from public.coordinator_cases
  where id=v_link.case_id and source_kind='website_request';
 if v_source_id is not null then
  select * into v_request from public.website_intake where id=v_source_id for update;
  if not found or v_request.status<>'new' then
   return jsonb_build_object('status','already_matched');
  end if;
  if exists(select 1 from public.jitap_wave_dispatch_jobs j
      where j.request_id=v_source_id and j.state='matched')
    or exists(select 1 from public.jitap_provider_appointments a where a.request_id=v_source_id) then
   return jsonb_build_object('status','already_matched');
  end if;
 end if;
  select * into v_case from public.coordinator_cases where id=v_link.case_id for update;
 select * into v_assignment from public.coordinator_provider_assignments where id=v_link.assignment_id for update;
 if v_case.status in ('cancelled','closed','completed') or v_assignment.state not in ('proposed','contacted','needs_clarification','quote_requested') then return jsonb_build_object('status','unavailable');end if;
 if p_decision='accepted' and exists(select 1 from public.coordinator_provider_assignments where case_id=v_link.case_id and state='accepted' and id<>v_assignment.id) then return jsonb_build_object('status','already_matched');end if;
 if p_decision='accepted' and v_source_id is not null then
  update public.jitap_wave_dispatch_jobs set state='matched',
   accepted_at=now(),updated_at=now()
  where request_id=v_source_id and state='searching';
  update public.jitap_wave_offers set state='dismissed'
  where request_id=v_source_id and state='pending';
 end if;
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

