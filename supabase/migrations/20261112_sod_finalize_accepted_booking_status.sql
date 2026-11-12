-- The SOC RPC currently updates coordinator_cases to provider_contacted after it
-- updates the accepted assignment. Finalize the case status after that RPC update.
create or replace function public.jitap_soc_finalize_accepted_booking()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='provider_contacted' and old.status is distinct from new.status
    and exists(select 1 from public.coordinator_provider_assignments a where a.case_id=new.id and a.state='accepted')
    and exists(select 1 from public.jitap_kapso_messages m
      where m.request_id=new.source_id and m.event_key like 'sod-booking:%')
 then
  update public.coordinator_cases set status='scheduled',updated_at=now() where id=new.id;
 end if;
 return new;
end $$;
drop trigger if exists jitap_soc_finalize_accepted_booking_trigger on public.coordinator_cases;
create trigger jitap_soc_finalize_accepted_booking_trigger
after update of status on public.coordinator_cases
for each row execute function public.jitap_soc_finalize_accepted_booking();
revoke all on function public.jitap_soc_finalize_accepted_booking() from public,anon,authenticated;
