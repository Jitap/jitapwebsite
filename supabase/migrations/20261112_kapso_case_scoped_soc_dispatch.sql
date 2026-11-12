create or replace function public.jitap_kapso_claim_case(p_request_id uuid,p_limit integer default 5)
returns setof public.jitap_kapso_messages
language plpgsql security invoker set search_path=public as $$
begin
 return query
 with selected as (
 select id from public.jitap_kapso_messages
 where request_id=p_request_id and status='pending' and due_at<=now()
 and consent_confirmed=true and attempt_count<5
 order by due_at,created_at for update skip locked
 limit least(greatest(coalesce(p_limit,5),1),10)
 ) update public.jitap_kapso_messages m
 set status='processing',attempt_count=m.attempt_count+1,updated_at=now()
 from selected where m.id=selected.id returning m.*;
end $$;
revoke all on function public.jitap_kapso_claim_case(uuid,integer) from public,anon,authenticated;
grant execute on function public.jitap_kapso_claim_case(uuid,integer) to service_role;