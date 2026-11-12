-- JiTap event-driven communications: delivery records are not booking state.
-- Existing five approved lifecycle WhatsApp templates remain authoritative.
create table if not exists public.jitap_service_followups (
 id uuid primary key default gen_random_uuid(),
 event_key text not null unique,
 request_id uuid not null references public.website_intake(id) on delete cascade,
 appointment_id uuid references public.jitap_provider_appointments(id) on delete cascade,
 recipient_role text not null check(recipient_role in ('customer','provider')),
 channel text not null default 'whatsapp' check(channel='whatsapp'),
 event_type text not null check(event_type in ('provider_accepted','eta_confirmed','on_my_way','arrived','completed')),
 recipient_phone text,
 template_kind text not null,
 template_parameters jsonb not null default '[]'::jsonb,
 status text not null default 'pending' check(status in ('pending','blocked','sending','submitted','delivered','read','failed','unknown','expired','skipped')),
 provider_message_id text,
 error_code text,
 created_at timestamptz not null default now(),
 attempted_at timestamptz,
 finished_at timestamptz,
 constraint followups_params_is_array check(jsonb_typeof(template_parameters)='array')
);
create index if not exists jitap_followups_due_idx on public.jitap_service_followups(created_at) where status='pending';
create index if not exists jitap_followups_request_idx on public.jitap_service_followups(request_id,created_at desc);
alter table public.jitap_service_followups enable row level security;
revoke all on public.jitap_service_followups from anon,authenticated;
create table if not exists public.jitap_soc_provider_reminders(
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null unique references public.coordinator_provider_assignments(id) on delete cascade,
 case_id uuid not null references public.coordinator_cases(id) on delete cascade,
 state text not null default 'sending' check(state in ('sending','submitted','rejected','unknown','blocked')),
 gateway_message_id text,
 error_code text,
 sent_by text not null,
 created_at timestamptz not null default now(),
 finished_at timestamptz
);
alter table public.jitap_soc_provider_reminders enable row level security;
revoke all on public.jitap_soc_provider_reminders from anon,authenticated;
-- Optional provider ETA, separate from customer's preferred service appointment.
alter table public.jitap_provider_appointments add column if not exists provider_eta_at timestamptz;
-- Enqueue only meaningful status transitions, never the initial historical rows.
create or replace function public.jitap_queue_service_followup()
returns trigger language plpgsql security invoker set search_path=public as $$
declare
 p jsonb;
 customer_phone text;
 provider_phone text;
 display_name text;
 reference text;
 service_name text;
 accepted boolean;
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
 -- Existing booking template is already enqueued by the approved lifecycle trigger.
 -- Record a distinct provider acknowledgement using its own *approved* template.
 if (tg_op='INSERT' or old.status is distinct from new.status) and new.status='confirmed' then
  select regexp_replace(coalesce(u.phone_e164,''),'[^0-9]','','g')
  into provider_phone from public.jitap_provider_workspaces u where u.user_id=new.provider_user_id limit 1;
  if provider_phone like '0%' then provider_phone:='254'||substring(provider_phone from 2);end if;
  if provider_phone ~ '^254[17][0-9]{8}$' then
   insert into public.jitap_service_followups(event_key,request_id,appointment_id,recipient_role,event_type,recipient_phone,template_kind,template_parameters,status)
   values('provider-accepted:'||new.id,new.request_id,new.id,'provider','provider_accepted',provider_phone,
   'provider_accepted',jsonb_build_array(reference,service_name,'Open your booking in JiTap'),
   'blocked') on conflict(event_key) do nothing;
  end if;
 end if;
 if coalesce(p->>'whatsappOptIn','false')<>'true' or customer_phone !~ '^254[17][0-9]{8}$' then return new;end if;
 if tg_op='UPDATE' and new.provider_eta_at is distinct from old.provider_eta_at
   and new.provider_eta_at is not null and new.provider_eta_at>now() then
  insert into public.jitap_service_followups(event_key,request_id,appointment_id,recipient_role,event_type,recipient_phone,template_kind,template_parameters)
  values('eta:'||new.id||':'||floor(extract(epoch from new.provider_eta_at))::text,
    new.request_id,new.id,'customer','eta_confirmed',customer_phone,'eta',
    jsonb_build_array(reference,display_name,to_char(new.provider_eta_at at time zone 'Africa/Nairobi','DD Mon HH12:MI AM')||' EAT'))
  on conflict(event_key) do nothing;
 end if;
 if tg_op='UPDATE' and old.status is distinct from new.status and new.status in ('on_my_way','arrived','completed') then
  insert into public.jitap_service_followups(event_key,request_id,appointment_id,recipient_role,event_type,recipient_phone,template_kind,template_parameters)
  values(new.status||':'||new.id,new.request_id,new.id,'customer',new.status,customer_phone,new.status,
  jsonb_build_array(reference,display_name,service_name))
  on conflict(event_key) do nothing;
 end if;
 return new;
end $$;
drop trigger if exists jitap_service_followup_events on public.jitap_provider_appointments;
create trigger jitap_service_followup_events after insert or update of status,provider_eta_at
on public.jitap_provider_appointments for each row execute function public.jitap_queue_service_followup();

create or replace function public.jitap_claim_followup_events(p_limit int default 5)
returns setof public.jitap_service_followups language plpgsql security invoker set search_path=public as $$
begin
 return query with selected as (
  select id from public.jitap_service_followups where status='pending' order by created_at
  limit least(greatest(coalesce(p_limit,5),1),10) for update skip locked
 ) update public.jitap_service_followups f
 set status='sending',attempted_at=now()
 from selected where f.id=selected.id returning f.*;
end $$;
revoke all on function public.jitap_claim_followup_events(int) from public,anon,authenticated;
grant execute on function public.jitap_claim_followup_events(int) to service_role;
