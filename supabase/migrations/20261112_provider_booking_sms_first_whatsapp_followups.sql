-- Retain opt-in WhatsApp for later updates; provider direct booking starts with SMS.
CREATE OR REPLACE FUNCTION public.jitap_provider_create_manual_job(p_provider_id uuid, p_title text, p_customer_name text, p_phone text, p_location text, p_description text, p_date date, p_start time without time zone, p_end time without time zone, p_repeat text, p_interval integer, p_unit text, p_count integer, p_reminder_minutes integer, p_reminder_channel text, p_whatsapp_opt_in boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare series uuid:=gen_random_uuid(); d date:=p_date; initial_date date:=p_date;
 sequence_no integer:=0; created integer:=0; request_uuid uuid; appointment_uuid uuid;
 upcoming_start timestamptz; upcoming_end timestamptz; first_uuid uuid;
 provider public.jitap_provider_workspaces%rowtype; clean_phone text;
 payload jsonb;
begin
 if p_provider_id is null then raise exception 'Missing provider';end if;
 select * into provider from public.jitap_provider_workspaces where user_id=p_provider_id and submitted_at is not null;
 if not found then raise exception 'Provider profile unavailable';end if;
 if length(trim(coalesce(p_title,''))) not between 3 and 120
 or length(trim(coalesce(p_customer_name,''))) not between 2 and 120
 or length(trim(coalesce(p_location,''))) not between 3 and 180
 or length(coalesce(p_description,''))>2000
 or p_start>=p_end or p_date<current_date-interval '1 day'
 or p_repeat not in ('none','daily','weekdays','weekly','monthly','yearly','custom')
 or p_count not between 1 and 24 or p_interval not between 1 and 12
 or p_unit not in ('days','weeks','months')
 or p_reminder_channel not in ('in_app','whatsapp_manual')
 or (p_reminder_minutes is not null and p_reminder_minutes not in (0,5,15,30,60,1440))
 then raise exception 'Invalid job schedule';end if;
 clean_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
 if clean_phone like '0%' then clean_phone:='254'||substr(clean_phone,2);end if;
 if clean_phone not similar to '254[17][0-9]{8}' then raise exception 'Invalid Kenyan mobile number';end if;
 if p_repeat='none' and p_count<>1 then raise exception 'Single job must have one occurrence';end if;
 if p_repeat<>'none' and p_count<2 then raise exception 'Select at least two occurrences';end if;
 if p_reminder_channel='whatsapp_manual' and not p_whatsapp_opt_in then
 raise exception 'Customer permission is needed for WhatsApp reminders';end if;
 while created<p_count loop
  if d>initial_date+interval '366 days' then exit;end if;
  if p_repeat<>'weekdays' or extract(isodow from d) between 1 and 5 then
   upcoming_start:=(d+p_start) at time zone 'Africa/Nairobi';
   upcoming_end:=(d+p_end) at time zone 'Africa/Nairobi';
   payload:=jsonb_build_object('name',trim(p_customer_name),'phone',clean_phone,
    'category',coalesce(provider.categories[1],'other-services'),
    'area',coalesce(nullif(provider.base_area,''),'Other'),
    'locationLabel',trim(p_location),'description',trim(p_description),
    'title',trim(p_title),'preferredDate',d::text,'preferredTime',to_char(p_start,'HH24:MI'),
    'source','provider_direct_booking','notifyOptIn',true,'whatsappOptIn',p_whatsapp_opt_in,
    'timing','scheduled');
   insert into public.website_intake(kind,payload,requester_hash,idempotency_key,status)
   values('request',payload,md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text),
    md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text),'scheduled')
   returning id into request_uuid;
   insert into public.jitap_provider_manual_jobs(request_id,provider_user_id,series_id,sequence_number,title,
    repeat_rule,repeat_interval,repeat_unit,reminder_minutes,reminder_channel,customer_whatsapp_opt_in)
   values(request_uuid,p_provider_id,series,created+1,trim(p_title),
    p_repeat,p_interval,p_unit,p_reminder_minutes,p_reminder_channel,p_whatsapp_opt_in);
   insert into public.jitap_provider_appointments(request_id,provider_user_id,starts_at,ends_at,status)
   values(request_uuid,p_provider_id,upcoming_start,upcoming_end,'confirmed') returning id into appointment_uuid;
   if p_reminder_minutes is not null then
    insert into public.jitap_provider_job_reminders(appointment_id,provider_user_id,due_at,channel)
    values(appointment_uuid,p_provider_id,upcoming_start-make_interval(mins=>p_reminder_minutes),p_reminder_channel);
   end if;
   if first_uuid is null then first_uuid:=request_uuid;end if;
   created:=created+1;
  end if;
  sequence_no:=sequence_no+1;
  if sequence_no>380 then exit;end if;
  d:=case p_repeat
   when 'daily' then d+1
   when 'weekdays' then d+1
   when 'weekly' then d+7
   when 'monthly' then (d+interval '1 month')::date
   when 'yearly' then (d+interval '1 year')::date
   when 'custom' then (d+make_interval(
      days=>case when p_unit='days' then p_interval else 0 end,
      weeks=>case when p_unit='weeks' then p_interval else 0 end,
      months=>case when p_unit='months' then p_interval else 0 end))::date
   else d+1 end;
 end loop;
 if created=0 then raise exception 'No occurrences in selected date range';end if;
 return jsonb_build_object('seriesId',series,'requestId',first_uuid,'count',created,'reference','JT-'||upper(substr(first_uuid::text,1,8)));
end;$function$
;
CREATE OR REPLACE FUNCTION public.jitap_kapso_booking_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if tg_op='INSERT' then
  -- Initial notification for provider-led jobs is SMS, not a booking WhatsApp.
  if not exists(select 1 from public.website_intake w where w.id=new.request_id
    and w.payload->>'source'='provider_direct_booking') then
   perform public.jitap_kapso_queue_event(new.request_id,'booking:'||new.id::text,'booking',now());
  end if;
  if new.starts_at is not null then
   perform public.jitap_kapso_queue_event(new.request_id,'reminder:'||new.id::text,'reminder',new.starts_at-interval '30 minutes');
  end if;
 elsif tg_op='UPDATE' and new.starts_at is distinct from old.starts_at then
  update public.jitap_kapso_messages
   set due_at=new.starts_at-interval '30 minutes',updated_at=now()
   where event_key='reminder:'||new.id::text and status='pending' and new.starts_at is not null;
  perform public.jitap_kapso_queue_event(new.request_id,'reschedule:'||new.id::text||':'||new.updated_at::text,'reschedule',now());
 elsif tg_op='UPDATE' and new.status='cancelled' and old.status<>'cancelled' then
  update public.jitap_kapso_messages set status='skipped',updated_at=now(),last_error='booking_cancelled'
  where event_key='reminder:'||new.id::text and status='pending';
 end if;
 return new;
end;$function$
;
