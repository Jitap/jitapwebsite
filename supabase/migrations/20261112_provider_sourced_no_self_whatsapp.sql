-- Provider-created bookings do not BUZZ the provider about the job they just created.
CREATE OR REPLACE FUNCTION public.jitap_queue_service_followup()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
 p jsonb;customer_phone text;provider_phone text;display_name text;
 reference text;service_name text;
begin
 select payload into p from public.website_intake where id=new.request_id;
 if p is null then return new;end if;
 reference:='JT-'||upper(left(new.request_id::text,8));
 service_name:=left(coalesce(nullif(p->>'category',''),'service'),80);
 customer_phone:=regexp_replace(coalesce(p->>'phone',''),'[^0-9]','','g');
 if customer_phone like '0%' then customer_phone:='254'||substring(customer_phone from 2);end if;
 select coalesce(nullif(w.business_name,''),nullif(w.full_name,''),'Your provider')
 into display_name from public.jitap_provider_workspaces w where w.user_id=new.provider_user_id limit 1;
 display_name:=left(coalesce(display_name,'Your provider'),100);
 if new.status='confirmed' and coalesce(p->>'source','')<>'provider_direct_booking' and (tg_op='INSERT' or old.status is distinct from new.status) then
  select regexp_replace(coalesce(ac.phone,''),'[^0-9]','','g')
  into provider_phone from public.jitap_accounts ac
  where ac.user_id=new.provider_user_id and ac.whatsapp_updates_opt_in=true limit 1;
  if provider_phone like '0%' then provider_phone:='254'||substring(provider_phone from 2);end if;
  if provider_phone ~ '^254[17][0-9]{8}$' then
   insert into public.jitap_service_followups(event_key,request_id,appointment_id,recipient_role,event_type,recipient_phone,template_kind,template_parameters)
   values('provider-accepted:'||new.id,new.request_id,new.id,'provider','provider_accepted',provider_phone,
   'provider_accepted',jsonb_build_array(reference,service_name,'Open confirmed job in JiTap'))
   on conflict(event_key) do nothing;
  end if;
 end if;
 if coalesce(p->>'whatsappOptIn','false')<>'true' or customer_phone !~ '^254[17][0-9]{8}$' then return new;end if;
 if tg_op='UPDATE' and new.provider_eta_at is distinct from old.provider_eta_at
 and new.provider_eta_at is not null and new.provider_eta_at>now() then
  insert into public.jitap_service_followups(event_key,request_id,appointment_id,recipient_role,event_type,recipient_phone,template_kind,template_parameters)
  values('eta:'||new.id||':'||floor(extract(epoch from new.provider_eta_at))::text,
  new.request_id,new.id,'customer','eta_confirmed',customer_phone,'eta',
  jsonb_build_array(reference,display_name,'Estimated arrival: '||to_char(new.provider_eta_at at time zone 'Africa/Nairobi','DD Mon HH12:MI AM')||' EAT'))
  on conflict(event_key) do nothing;
 end if;
 if tg_op='UPDATE' and old.status is distinct from new.status and new.status in ('on_my_way','arrived','completed') then
  insert into public.jitap_service_followups(event_key,request_id,appointment_id,recipient_role,event_type,recipient_phone,template_kind,template_parameters)
  values(new.status||':'||new.id,new.request_id,new.id,'customer',new.status,customer_phone,new.status,
  jsonb_build_array(reference,display_name,case new.status
   when 'on_my_way' then 'On the way for your '||service_name||' service'
   when 'arrived' then 'Arrived at the service location'
   else 'Service marked completed'
  end))
  on conflict(event_key) do nothing;
 end if;
 return new;
end $function$
;
