-- A coordinator may explicitly confirm an existing accepted SOC assignment.
-- Idempotent event key ensures the approved customer booking message can be
-- queued once, without creating a duplicate provider appointment.
create or replace function public.jitap_soc_confirm_existing_booking(p_case_id uuid,p_actor_email text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
 c public.coordinator_cases%rowtype;
 a public.coordinator_provider_assignments%rowtype;
 p jsonb;
begin
 if not exists(select 1 from public.coordinator_staff where email=lower(p_actor_email) and active) then
  raise exception 'soc_not_authorized';
 end if;
 select * into c from public.coordinator_cases where id=p_case_id for update;
 if not found or c.source_kind<>'website_request' or c.status in ('cancelled','closed','completed') then
  raise exception 'case_not_eligible';
 end if;
 select * into a from public.coordinator_provider_assignments
  where case_id=p_case_id and state='accepted' order by responded_at desc limit 1;
 if not found then raise exception 'no_accepted_provider';end if;
 select payload into p from public.website_intake where id=c.source_id and kind='request';
 if p is null or nullif(p->>'preferredDate','') is null or nullif(p->>'preferredTime','') is null then
  raise exception 'confirm_preferred_appointment_first';
 end if;
 if coalesce(p->>'whatsappOptIn','false')<>'true' then raise exception 'customer_whatsapp_consent_missing';end if;
 if exists(select 1 from public.jitap_provider_appointments where request_id=c.source_id) then
  raise exception 'booking_managed_by_provider_app';
 end if;
 if exists(select 1 from public.jitap_kapso_messages where event_key='sod-booking:'||a.id::text) then
  return jsonb_build_object('ok',true,'alreadyQueued',true,'requestId',c.source_id);
 end if;
 perform public.jitap_kapso_queue_event(c.source_id,'sod-booking:'||a.id::text,'booking',now());
 update public.coordinator_cases set status='scheduled',updated_at=now() where id=c.id;
 insert into public.coordinator_activity(case_id,actor_email,action,note)
 values(c.id,lower(p_actor_email),'note_added','SOC explicitly confirmed accepted provider booking for customer WhatsApp');
 return jsonb_build_object('ok',true,'alreadyQueued',false,'requestId',c.source_id);
end $$;
revoke all on function public.jitap_soc_confirm_existing_booking(uuid,text) from public,anon,authenticated;
grant execute on function public.jitap_soc_confirm_existing_booking(uuid,text) to service_role;
