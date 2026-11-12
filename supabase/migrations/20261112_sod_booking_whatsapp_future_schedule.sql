-- Don't send stale booking confirmations for already-expired appointment preferences.
create or replace function public.jitap_soc_accepted_booking_notification()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
 v_case record;
 v_request jsonb;
begin
 if new.state<>'accepted' or (tg_op='UPDATE' and old.state='accepted') then return new; end if;
 select c.id,c.source_kind,c.source_id,c.status into v_case
 from public.coordinator_cases c where c.id=new.case_id;
 if v_case.source_kind is distinct from 'website_request'
    or v_case.status in ('closed','cancelled','completed') then return new;end if;
 select payload into v_request from public.website_intake where id=v_case.source_id and kind='request';
 if v_request is null then return new;end if;
 -- Avoid sending a booking confirmation for a request missing a scheduled visit.
 if nullif(v_request->>'preferredDate','') is null or nullif(v_request->>'preferredTime','') is null then return new;end if;
 -- Do not send confirmations for expired preferred visits.
 if (v_request->>'preferredDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or (v_request->>'preferredTime') !~ '^[0-9]{2}:[0-9]{2}$' then return new;end if;
 if ((v_request->>'preferredDate')::date + (v_request->>'preferredTime')::time)
    <= (now() at time zone 'Africa/Nairobi') then return new;end if;
 if exists(select 1 from public.jitap_provider_appointments p where p.request_id=v_case.source_id)
 then return new;end if;
 update public.coordinator_cases set status='scheduled',updated_at=now() where id=v_case.id;
 perform public.jitap_kapso_queue_event(v_case.source_id,
    'sod-booking:'||new.id::text,'booking',now());
 return new;
end $$;

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
 if (p->>'preferredDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or (p->>'preferredTime') !~ '^[0-9]{2}:[0-9]{2}$' then
  raise exception 'invalid_preferred_schedule';
 end if;
 if ((p->>'preferredDate')::date + (p->>'preferredTime')::time) <= (now() at time zone 'Africa/Nairobi') then
  raise exception 'preferred_visit_is_in_the_past';
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
