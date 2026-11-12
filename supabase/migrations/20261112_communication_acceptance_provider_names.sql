-- Enrich the existing approved customer booking template with the accepted provider.
-- Only pending events are updated; do not alter accepted/delivered messages.
create or replace function public.jitap_communication_on_soc_accept()
returns trigger language plpgsql security invoker set search_path=public as $$
declare
 c public.coordinator_cases%rowtype;
 p jsonb;
 provider_name text;
 phone text;
 ref text;
begin
 if new.state<>'accepted' or (tg_op='UPDATE' and old.state='accepted') then return new;end if;
 select * into c from public.coordinator_cases where id=new.case_id;
 if not found or c.source_kind<>'website_request' then return new;end if;
 select payload into p from public.website_intake where id=c.source_id and kind='request';
 if p is null then return new;end if;
 select coalesce(nullif(business_name,''),'Service provider') into provider_name from public.provider_profiles
 where id=new.provider_id;
 provider_name:=left(coalesce(provider_name,'Service provider'),70);
 -- The existing booking template uses body variable 3 for the service summary.
 -- Add the provider name here without changing the approved template's structure.
 update public.jitap_kapso_messages m set
 template_parameters=jsonb_set(m.template_parameters,'{2}',
 to_jsonb(left(coalesce(nullif(p->>'category',''),'Service')||' · '||provider_name,170)),updated_at=now())
 where m.request_id=c.source_id and m.template_kind='booking' and m.status='pending'
 and m.event_key='sod-booking:'||new.id::text;
 select phone_e164 into phone from public.provider_notification_contacts
 where provider_id=new.provider_id and whatsapp_opt_in=true and opted_out_at is null;
 phone:=regexp_replace(coalesce(phone,''),'[^0-9]','','g');
 if phone like '0%' then phone:='254'||substring(phone from 2);end if;
 ref:='JT-'||upper(left(c.source_id::text,8));
 if phone ~ '^254[17][0-9]{8}$' then
  insert into public.jitap_service_followups
  (event_key,request_id,recipient_role,event_type,recipient_phone,template_kind,template_parameters,status)
  values ('sod-provider-accepted:'||new.id,c.source_id,'provider','provider_accepted',
  phone,'provider_accepted',jsonb_build_array(ref,provider_name,'Review confirmed job details in JiTap'),'pending')
  on conflict (event_key) do nothing;
 end if;
 return new;
end $$;
drop trigger if exists zzz_jitap_communication_soc_accepted on public.coordinator_provider_assignments;
create trigger zzz_jitap_communication_soc_accepted
after insert or update of state on public.coordinator_provider_assignments
for each row execute function public.jitap_communication_on_soc_accept();

create or replace function public.jitap_communication_on_native_accept()
returns trigger language plpgsql security invoker set search_path=public as $$
declare provider_name text; p jsonb;
begin
 if new.status<>'confirmed' or (tg_op='UPDATE' and old.status='confirmed') then return new;end if;
 select coalesce(nullif(business_name,''),nullif(full_name,''),'Service provider')
 into provider_name from public.jitap_provider_workspaces where user_id=new.provider_user_id;
 select payload into p from public.website_intake where id=new.request_id;
 update public.jitap_kapso_messages m set
 template_parameters=jsonb_set(m.template_parameters,'{2}',
 to_jsonb(left(coalesce(nullif(p->>'category',''),'Service')||' · '||coalesce(provider_name,'Service provider'),170)),updated_at=now())
 where m.request_id=new.request_id and m.template_kind='booking' and m.status='pending';
 return new;
end $$;
drop trigger if exists zzz_jitap_communication_native_accepted on public.jitap_provider_appointments;
create trigger zzz_jitap_communication_native_accepted
after insert or update of status on public.jitap_provider_appointments
for each row execute function public.jitap_communication_on_native_accept();
