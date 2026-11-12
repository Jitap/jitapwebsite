-- SOD provider acceptance is the business confirmation event for manual coordinator bookings.
-- Avoid inventing a provider appointment: simply queue the already approved
-- CUSTOMER booking-confirmation template for a confirmed SOC assignment.
-- The normal provider-app appointment pathway retains its own booking trigger.
create or replace function public.jitap_soc_accepted_booking_notification()
returns trigger language plpgsql security definer set search_path='' as $$
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
 if exists(select 1 from public.jitap_provider_appointments p where p.request_id=v_case.source_id)
 then return new;end if;
 update public.coordinator_cases set status='scheduled',updated_at=now() where id=v_case.id;
 perform public.jitap_kapso_queue_event(v_case.source_id,
    'sod-booking:'||new.id::text,'booking',now());
 return new;
end $$;
drop trigger if exists jitap_soc_accepted_booking_notification_trigger on public.coordinator_provider_assignments;
create trigger jitap_soc_accepted_booking_notification_trigger
after insert or update of state on public.coordinator_provider_assignments
for each row execute function public.jitap_soc_accepted_booking_notification();
revoke all on function public.jitap_soc_accepted_booking_notification() from public,anon,authenticated;
