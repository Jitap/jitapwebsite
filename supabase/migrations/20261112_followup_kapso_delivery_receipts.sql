-- Apply signed Kapso delivery receipts to new service follow-up messages.
-- Existing five lifecycle receipt processing remains unchanged.
create or replace function public.jitap_followup_record_receipt(p_message_id text,p_status text,p_error text default null)
returns void language plpgsql security invoker set search_path=public as $$
declare f public.jitap_service_followups%rowtype;next_state text;case_id uuid;
begin
 if length(coalesce(p_message_id,''))<3 or p_status not in ('sent','delivered','read','failed') then return;end if;
 select * into f from public.jitap_service_followups
 where provider_message_id=p_message_id for update;
 if not found then return;end if;
 next_state:=case
 when f.status='read' then 'read'
 when f.status='delivered' and p_status in ('sent','failed') then 'delivered'
 when p_status='sent' then 'submitted'
 else p_status end;
 if f.status=next_state then return;end if;
 update public.jitap_service_followups set status=next_state,
 error_code=case when p_status='failed' then left(coalesce(p_error,'gateway_delivery_failed'),150) else error_code end,
 finished_at=now() where id=f.id;
 select id into case_id from public.coordinator_cases
 where source_kind='website_request' and source_id=f.request_id limit 1;
 if case_id is not null then
  insert into public.coordinator_activity(case_id,actor_email,action,note,old_value,new_value)
  values(case_id,'kapso-webhook','whatsapp_delivery_updated',
   left('JiTap '||f.event_type||' WhatsApp '||f.recipient_role||': '||next_state,160),f.status,next_state);
  if next_state='failed' then
   update public.coordinator_cases set intervention_status='open',
    intervention_reason='WhatsApp follow-up failed: '||f.event_type,
    intervention_opened_at=now(),priority='high',updated_at=now()
   where id=case_id and intervention_status in ('none','resolved');
  end if;
 end if;
end $$;
revoke all on function public.jitap_followup_record_receipt(text,text,text) from public,anon,authenticated;
grant execute on function public.jitap_followup_record_receipt(text,text,text) to service_role;
