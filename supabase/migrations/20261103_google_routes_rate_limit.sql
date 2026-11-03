-- Cap billable Google Routes attempts per moving lead.
alter table public.moving_leads add column if not exists route_attempts integer not null default 0;
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
   moving_date=v_date,distance_km=case when p_payload->>'routeStatus'='verified' then nullif(p_payload->>'distanceKm','')::numeric else null end,
   route_status=case when p_payload->>'routeStatus'='verified' and nullif(p_payload->>'distanceKm','') is not null then 'verified' else 'unavailable' end,
   route_provider=case when p_payload->>'routeStatus'='verified' and nullif(p_payload->>'distanceKm','') is not null then 'google_routes' else null end,
   distance_verified_at=case when p_payload->>'routeStatus'='verified' and nullif(p_payload->>'distanceKm','') is not null then now() else null end,
   route_attempts=route_attempts+case when p_payload->>'routeStatus'='pending' then 1 else 0 end,
   current_stage=2,updated_at=now() where id=out_id;
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
 return jsonb_build_object('leadId',out_id,'stage',lead.current_stage,'estimateKes',quote,'distanceKm',lead.distance_km,'distanceVerified',lead.route_status='verified','routeStatus',lead.route_status,'routeAttempts',lead.route_attempts);
end;$function$
;
revoke all on function public.save_moving_lead_authorized(text,uuid,text,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.save_moving_lead_authorized(text,uuid,text,integer,jsonb,text) to anon,service_role;
