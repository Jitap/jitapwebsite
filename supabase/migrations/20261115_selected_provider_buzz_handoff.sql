-- Applied to the JiTap Supabase project on 2026-11-15.
CREATE OR REPLACE FUNCTION public.jitap_assign_selected_provider(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_intake public.website_intake%rowtype;
 v_case public.coordinator_cases%rowtype;
 v_provider public.provider_profiles%rowtype;
 v_assignment public.coordinator_provider_assignments%rowtype;
 v_provider_id text;
 v_area text;
 v_trade text;
 v_eligible boolean;
 v_contact_ok boolean;
 v_inserted boolean := false;
begin
 select * into v_intake from public.website_intake
 where id=p_request_id and kind='request' for update;
 if not found then return pg_catalog.jsonb_build_object('status','request_not_found');end if;

 v_provider_id := v_intake.payload->>'preferredProviderId';
 if v_provider_id is null then return pg_catalog.jsonb_build_object('status','no_provider_selected');end if;
 if v_provider_id !~ '^fund-[0-9]{3}$' then return pg_catalog.jsonb_build_object('status','invalid_provider');end if;

 select * into v_case from public.coordinator_cases
 where source_kind='website_request' and source_id=p_request_id limit 1 for update;
 if not found then return pg_catalog.jsonb_build_object('status','case_not_ready');end if;
 if v_case.status in ('completed','closed','cancelled') then
  return pg_catalog.jsonb_build_object('status','request_closed');
 end if;

 select * into v_provider from public.provider_profiles
 where id=v_provider_id and is_public=true and verified_at is not null;
 if not found then return pg_catalog.jsonb_build_object('status','provider_review_required');end if;

 v_area := pg_catalog.lower(pg_catalog.trim(v_intake.payload->>'area'));
 v_trade := pg_catalog.lower(pg_catalog.trim(v_intake.payload->>'category'));
 v_eligible := (
   exists (select 1 from pg_catalog.unnest(v_provider.service_areas) a
           where pg_catalog.lower(pg_catalog.trim(a))=v_area)
   and exists (
    select 1 from pg_catalog.unnest(v_provider.service_categories) c
    where
     (v_trade='plumbing' and c ilike '%plumb%')
     or (v_trade='moving' and (c ilike '%mov%' or c ilike '%relocat%'))
     or (v_trade in ('it-repairs','computer-phone-repair') and
        (c ilike '%computer%' or c ilike '%phone%' or c ilike '%it support%'))
     or (v_trade='electrical' and c ilike '%electric%')
     or (v_trade='cleaning' and (c ilike '%clean%' or c ilike '%laundry%'))
     or (v_trade='appliance-repair' and c ilike '%appliance%')
     or (pg_catalog.replace(v_trade,'-',' ') <> '' and
         c ilike '%' || pg_catalog.replace(v_trade,'-',' ') || '%')
   )
 );
 if not v_eligible then return pg_catalog.jsonb_build_object('status','provider_not_eligible');end if;

 if exists (select 1 from public.coordinator_provider_assignments
  where case_id=v_case.id and state='accepted' and provider_id<>v_provider_id) then
  return pg_catalog.jsonb_build_object('status','already_assigned_elsewhere');
 end if;

 insert into public.coordinator_provider_assignments(case_id,provider_id,assigned_by,notes)
 values(v_case.id,v_provider_id,'jitap-website-intake','Customer selected this provider in JiTap.')
 on conflict(case_id,provider_id) do nothing
 returning * into v_assignment;
 v_inserted:=found;
 if not v_inserted then
  select * into v_assignment from public.coordinator_provider_assignments
  where case_id=v_case.id and provider_id=v_provider_id;
 end if;
 if v_assignment.id is null then return pg_catalog.jsonb_build_object('status','assignment_unavailable');end if;
 if v_inserted then
  update public.coordinator_cases set status='matching',updated_at=now()
  where id=v_case.id and status in ('new','needs_sourcing');
 end if;

 select exists(select 1 from public.provider_notification_contacts c
  where c.provider_id=v_provider_id and c.sms_opt_in=true and c.opted_out_at is null
   and c.phone_e164 ~ '^\\+?254[17][0-9]{8}$') into v_contact_ok;
 return pg_catalog.jsonb_build_object(
  'status',case when not v_inserted then 'already_recorded'
                when v_contact_ok then 'sms_queued' else 'manual_contact_required' end,
  'assignmentId',v_assignment.id);
end;
$function$

revoke all on function public.jitap_assign_selected_provider(uuid) from public,anon,authenticated;
grant execute on function public.jitap_assign_selected_provider(uuid) to service_role;
