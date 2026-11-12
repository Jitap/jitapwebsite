-- SOC may dispatch one specifically selected, eligible WhatsApp follow-up after
-- its utility template is approved. Never retry uncertain gateway outcomes.
create or replace function public.jitap_claim_one_followup(p_event_id uuid)
returns setof public.jitap_service_followups language plpgsql security invoker set search_path=public as $$
begin
 return query
 with selected as(
  select id from public.jitap_service_followups
  where id=p_event_id and
   (status='pending' or (status='blocked' and error_code like 'approved_%_template_not_configured'))
  limit 1 for update skip locked
 ) update public.jitap_service_followups f
 set status='sending',attempted_at=now(),error_code=null
 from selected where f.id=selected.id returning f.*;
end $$;
revoke all on function public.jitap_claim_one_followup(uuid) from public,anon,authenticated;
grant execute on function public.jitap_claim_one_followup(uuid) to service_role;
