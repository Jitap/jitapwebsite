-- Dedicated moving quote funnel. Supabase site intake token gateway must exist first.
create schema if not exists jitap_private;
create table if not exists public.movers(
 id uuid primary key default gen_random_uuid(),company_name text not null,
 base_bedsitter_rate numeric(12,2) not null default 9500,base_1bed_rate numeric(12,2) not null default 14500,
 base_2bed_rate numeric(12,2) not null default 23500,base_3bed_rate numeric(12,2) not null default 38000,
 per_km_rate numeric(10,2) not null default 120,staircase_charge_per_floor numeric(10,2) not null default 1100,
 created_at timestamptz not null default now());
alter table public.movers enable row level security;
revoke all on public.movers from public,anon,authenticated;
create table if not exists jitap_private.moving_pricing(
 id boolean primary key default true check(id),base_bedsitter_rate numeric(12,2) not null,
 base_1bed_rate numeric(12,2) not null,base_2bed_rate numeric(12,2) not null,
 base_3bed_rate numeric(12,2) not null,per_km_rate numeric(10,2) not null,
 staircase_charge_per_floor numeric(10,2) not null,special_items_surcharge numeric(10,2) not null,
 included_km numeric(10,2) not null);
insert into jitap_private.moving_pricing(id,base_bedsitter_rate,base_1bed_rate,base_2bed_rate,base_3bed_rate,per_km_rate,staircase_charge_per_floor,special_items_surcharge,included_km)
values(true,9500,14500,23500,38000,120,1100,3500,10) on conflict(id) do nothing;
revoke all on jitap_private.moving_pricing from public,anon,authenticated;
create table if not exists public.moving_leads(
 id uuid primary key default gen_random_uuid(),
 session_secret_hash text not null check(length(session_secret_hash)=64),source_hash text not null,
 current_stage integer not null default 1 check(current_stage between 1 and 4),
 pickup_address text,dropoff_address text,
 distance_km numeric(10,2) check(distance_km is null or distance_km between 0 and 2000),
 moving_date date,
 home_size text check(home_size in ('bedsitter','1-bed','2-bed','3-bed')),
 pickup_floor integer default 0 check(pickup_floor between 0 and 40),
 dropoff_floor integer default 0 check(dropoff_floor between 0 and 40),
 has_lift_pickup boolean not null default false,has_lift_dropoff boolean not null default false,
 packing_tier text not null default 'self-packing' check(packing_tier in ('self-packing','fragile-only','full-packing')),
 has_special_items boolean not null default false,customer_phone text,customer_email text,
 selected_mover_id uuid references public.movers(id),estimate_kes numeric(12,2),intake_reference uuid,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists moving_leads_source_window on public.moving_leads(source_hash,created_at);
alter table public.moving_leads enable row level security;
revoke all on public.moving_leads from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.calculate_moving_quote(mover_uuid uuid, h_size text, dist_km numeric, p_floor integer, d_floor integer, p_lift boolean, d_lift boolean, p_tier text, spec_items boolean)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare base_rate numeric; km_cost numeric; stairs numeric; mover_record public.movers%rowtype; config jitap_private.moving_pricing%rowtype; final_price numeric;
begin
 if h_size not in ('bedsitter','1-bed','2-bed','3-bed') or p_tier not in ('self-packing','fragile-only','full-packing') then raise exception 'Invalid moving options';end if;
 if dist_km is not null and (dist_km<0 or dist_km>2000) then raise exception 'Invalid distance';end if;
 if p_floor not between 0 and 40 or d_floor not between 0 and 40 then raise exception 'Invalid floors';end if;
 select * into config from jitap_private.moving_pricing where id=true;
 if mover_uuid is not null then
  select * into mover_record from public.movers where id=mover_uuid;
  if not found then raise exception 'Unknown mover';end if;
 end if;
 base_rate:=case h_size when 'bedsitter' then coalesce(mover_record.base_bedsitter_rate,config.base_bedsitter_rate)
 when '1-bed' then coalesce(mover_record.base_1bed_rate,config.base_1bed_rate)
 when '2-bed' then coalesce(mover_record.base_2bed_rate,config.base_2bed_rate)
 else coalesce(mover_record.base_3bed_rate,config.base_3bed_rate) end;
 km_cost:=greatest(coalesce(dist_km,config.included_km)-config.included_km,0)*coalesce(mover_record.per_km_rate,config.per_km_rate);
 stairs:=(case when coalesce(p_lift,false) then 0 else coalesce(p_floor,0) end+case when coalesce(d_lift,false) then 0 else coalesce(d_floor,0) end)*coalesce(mover_record.staircase_charge_per_floor,config.staircase_charge_per_floor);
 final_price:=base_rate+km_cost+stairs+case p_tier when 'full-packing' then base_rate*.20 when 'fragile-only' then base_rate*.08 else 0 end+case when spec_items then config.special_items_surcharge else 0 end;
 return round(final_price/100)*100;
end;$function$;

CREATE OR REPLACE FUNCTION public.save_moving_lead_authorized(p_token text, p_lead_id uuid, p_session_secret text, p_stage integer, p_payload jsonb, p_source_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare lead public.moving_leads%rowtype; hashed text; quote numeric; out_id uuid; v_date date;
begin
 if p_token is null or length(p_token)<>64 or not exists (
 select 1 from jitap_private.intake_tokens t
 where t.token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8')),'hex')
 ) then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_session_secret is null or length(p_session_secret)<32 or p_stage not between 1 and 4
 or length(coalesce(p_source_hash,''))<>64 or pg_catalog.length(p_payload::text)>8000 then raise exception 'Invalid moving request';end if;
 hashed:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_session_secret,'UTF8')),'hex');
 if p_lead_id is null then
  if p_stage<>1 then raise exception 'Start at stage one';end if;
  if (select count(*) from public.moving_leads where source_hash=p_source_hash and created_at>now()-interval '1 hour')>=15 then raise exception 'Moving request limit exceeded';end if;
  insert into public.moving_leads(session_secret_hash,source_hash) values(hashed,p_source_hash) returning id into out_id;
 else
  select * into lead from public.moving_leads where id=p_lead_id and session_secret_hash=hashed;
  if not found then raise exception 'Moving session not found';end if;
  out_id:=p_lead_id;
 end if;
 if p_stage=1 then
  v_date:=nullif(p_payload->>'movingDate','')::date;
  if v_date is null or v_date<current_date-1 or v_date>current_date+90 then raise exception 'Invalid moving date';end if;
  if length(trim(coalesce(p_payload->>'pickup','')))<3 or length(trim(coalesce(p_payload->>'dropoff','')))<3 then raise exception 'Both moving locations required';end if;
  update public.moving_leads set pickup_address=left(p_payload->>'pickup',200),dropoff_address=left(p_payload->>'dropoff',200),
   moving_date=v_date,distance_km=nullif(p_payload->>'distanceKm','')::numeric,current_stage=2,updated_at=now() where id=out_id;
 elsif p_stage=2 then
  if (p_payload->>'homeSize') not in ('bedsitter','1-bed','2-bed','3-bed') then raise exception 'Select home size';end if;
  update public.moving_leads set home_size=p_payload->>'homeSize',
   pickup_floor=(p_payload->>'pickupFloor')::int,dropoff_floor=(p_payload->>'dropoffFloor')::int,
   has_lift_pickup=coalesce((p_payload->>'liftPickup')::boolean,false),
   has_lift_dropoff=coalesce((p_payload->>'liftDropoff')::boolean,false),
   current_stage=3,updated_at=now() where id=out_id;
 elsif p_stage=3 then
  if p_payload->>'packing' not in ('self-packing','fragile-only','full-packing') then raise exception 'Select packing';end if;
  update public.moving_leads set packing_tier=p_payload->>'packing',
  has_special_items=coalesce((p_payload->>'special')::boolean,false),
  current_stage=4,updated_at=now() where id=out_id;
 elsif p_stage=4 then
  if coalesce(p_payload->>'phone','') !~ '^(\\+254|254|0)(7|1)[0-9]{8}$' then raise exception 'Valid Kenyan phone required'; end if;
  if nullif(p_payload->>'intakeReference','') is null then raise exception 'Submission reference required';end if;
  update public.moving_leads set customer_phone=left(p_payload->>'phone',20),customer_email=nullif(left(p_payload->>'email',150),''),
  intake_reference=(p_payload->>'intakeReference')::uuid,current_stage=4,updated_at=now() where id=out_id;
 end if;
 select * into lead from public.moving_leads where id=out_id;
 if lead.home_size is not null then
  quote:=public.calculate_moving_quote(null,lead.home_size,lead.distance_km,lead.pickup_floor,lead.dropoff_floor,lead.has_lift_pickup,lead.has_lift_dropoff,lead.packing_tier,lead.has_special_items);
  update public.moving_leads set estimate_kes=quote where id=out_id;
 end if;
 return jsonb_build_object('leadId',out_id,'stage',lead.current_stage,'estimateKes',quote,'distanceVerified',false);
end;$function$;

revoke all on function public.calculate_moving_quote(uuid,text,numeric,integer,integer,boolean,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.calculate_moving_quote(uuid,text,numeric,integer,integer,boolean,boolean,text,boolean) to service_role;
revoke all on function public.save_moving_lead_authorized(text,uuid,text,integer,jsonb,text) from public,anon,authenticated;
-- Token-gated RPC, called exclusively from the JiTap Vercel backend.
grant execute on function public.save_moving_lead_authorized(text,uuid,text,integer,jsonb,text) to anon,service_role;
