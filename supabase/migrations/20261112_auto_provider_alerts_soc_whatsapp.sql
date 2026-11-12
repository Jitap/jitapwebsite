-- Event-driven, idempotent provider notification queue and SOC WhatsApp audit.
create table if not exists public.jitap_provider_alerts (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.coordinator_provider_assignments(id) on delete cascade,
 case_id uuid not null references public.coordinator_cases(id) on delete cascade,
 channel text not null check(channel in ('sms','whatsapp')),
 state text not null default 'pending' check(state in ('pending','sending','submitted','rejected','unknown','blocked','skipped')),
 provider_message_id text,
 last_error text,
 requested_at timestamptz not null default now(),
 attempted_at timestamptz,
 finished_at timestamptz,
 unique (assignment_id,channel)
);
create index if not exists jitap_provider_alerts_pending_idx on public.jitap_provider_alerts (requested_at) where state='pending';
alter table public.jitap_provider_alerts enable row level security;
revoke all on public.jitap_provider_alerts from anon,authenticated;
create table if not exists public.jitap_soc_whatsapp_sends (
 id uuid primary key default gen_random_uuid(),
 update_id uuid not null unique references public.coordinator_customer_updates(id) on delete cascade,
 case_id uuid not null references public.coordinator_cases(id) on delete cascade,
 state text not null default 'sending' check(state in ('sending','submitted','rejected','unknown','blocked')),
 provider_message_id text,
 last_error text,
 sent_by text not null,
 attempted_at timestamptz not null default now(),
 finished_at timestamptz
);
alter table public.jitap_soc_whatsapp_sends enable row level security;
revoke all on public.jitap_soc_whatsapp_sends from anon,authenticated;
create or replace function public.jitap_queue_provider_alerts()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.state='proposed' and (tg_op='INSERT' or old.state is distinct from new.state) then
  insert into public.jitap_provider_alerts(assignment_id,case_id,channel)
  select new.id,new.case_id,channels.channel
  from public.provider_notification_contacts c
  cross join lateral (values ('sms',c.sms_opt_in),('whatsapp',c.whatsapp_opt_in)) as channels(channel,enabled)
  where c.provider_id=new.provider_id and c.opted_out_at is null and channels.enabled=true
  on conflict (assignment_id,channel) do nothing;
 end if;
 return new;
end $$;
drop trigger if exists jitap_auto_alert_new_assignment on public.coordinator_provider_assignments;
create trigger jitap_auto_alert_new_assignment after insert or update of state
on public.coordinator_provider_assignments for each row execute function public.jitap_queue_provider_alerts();
create or replace function public.jitap_claim_provider_alerts(p_limit integer default 6,p_assignment_id uuid default null)
returns setof public.jitap_provider_alerts language plpgsql set search_path=public as $$
begin
 return query
 with selected as (
  select id from public.jitap_provider_alerts
  where state='pending' and (p_assignment_id is null or assignment_id=p_assignment_id)
  order by requested_at,id for update skip locked
  limit least(greatest(coalesce(p_limit,6),1),10)
 )
 update public.jitap_provider_alerts a set state='sending',attempted_at=now()
 from selected where a.id=selected.id returning a.*;
end $$;
revoke all on function public.jitap_claim_provider_alerts(integer,uuid) from public,anon,authenticated;
grant execute on function public.jitap_claim_provider_alerts(integer,uuid) to service_role;
