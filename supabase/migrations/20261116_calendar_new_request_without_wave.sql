-- A new customer Calendar request is created only when Save/Invite is tapped.
-- This dedicated flow never enters the immediate Wave BUZZ matching queue.
create or replace function public.jitap_wave_queue_intake()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_lat double precision;v_lng double precision;
begin
 if new.kind<>'request' or new.payload ? 'preferredProviderId'
  or new.payload->>'requestMode'='scheduled' then return new;end if;
 if not (coalesce(new.payload->>'locationLat','')~'^-?[0-9]{1,2}(\.[0-9]+)?$'
 and coalesce(new.payload->>'locationLng','')~'^-?[0-9]{1,3}(\.[0-9]+)?$') then return new;end if;
 v_lat:=(new.payload->>'locationLat')::double precision;
 v_lng:=(new.payload->>'locationLng')::double precision;
 if v_lat not between -5 and 5 or v_lng not between 33 and 42 then return new;end if;
 insert into public.jitap_wave_dispatch_jobs(request_id,category,latitude,longitude)
 values(new.id,public.jitap_canonical_trade(new.payload->>'category'),v_lat,v_lng)
 on conflict(request_id) do nothing;
 return new;
end $$;
create or replace function public.jitap_customer_create_calendar_request(
 p_customer uuid,p_phone text,p_name text,p_category text,p_area text,
 p_description text,p_location text,p_start timestamptz,p_end timestamptz,
 p_note text,p_provider uuid,p_submit boolean,p_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_req uuid;v_book jsonb;v_payload jsonb;
begin
 if p_customer is null or not exists(
   select 1 from public.jitap_accounts a where a.user_id=p_customer
   and regexp_replace(a.phone,'[^0-9]','','g')=
    regexp_replace(p_phone,'[^0-9]','','g')
 )
 or p_key !~ '^[a-f0-9]{64}$'
 or p_category not in ('plumbing','electrical','cleaning','moving','carpentry',
  'general-repairs','painting','masonry','tiling','solar-security',
  'appliance-repair','computer-phone-repair','roofing','pest-control',
  'welding','other-services')
 or length(trim(coalesce(p_description,'')))<10
 or length(coalesce(p_description,''))>1200
 or length(trim(coalesce(p_location,'')))<3
 or length(coalesce(p_location,''))>160
 or length(trim(coalesce(p_area,'')))<2
 or length(coalesce(p_area,''))>80
 or length(coalesce(p_name,''))>120
 then return jsonb_build_object('error','invalid_service_details');end if;
 select w.id into v_req from public.website_intake w
  where w.kind='request' and w.idempotency_key=p_key and w.customer_user_id=p_customer;
 if v_req is not null then
  select id into v_req from public.website_intake where id=v_req for update;
  select jsonb_build_object('ok',true,'id',b.id,'status',b.status,
   'requestId',b.request_id,'serviceId','JT-'||upper(left(b.request_id::text,8)))
    into v_book from public.jitap_customer_calendar_bookings b
    where b.request_id=v_req;
  if v_book is not null then return v_book;end if;
  return jsonb_build_object('error','previous_submission_pending');
 end if;
 v_payload:=jsonb_build_object(
  'category',p_category,'area',p_area,'description',trim(p_description),
  'title',left(trim(p_description),120),'location',trim(p_location),
  'name',coalesce(p_name,''),'phone',p_phone,'requestMode','scheduled',
  'notifyOptIn',false,
  'preferredDate',to_char(p_start at time zone 'Africa/Nairobi','YYYY-MM-DD'),
  'preferredTime',to_char(p_start at time zone 'Africa/Nairobi','HH24:MI')
 );
 insert into public.website_intake(kind,status,payload,requester_hash,idempotency_key,customer_user_id)
 values('request','new',v_payload,encode(extensions.digest(p_customer::text,'sha256'),'hex'),
  p_key,p_customer) returning id into v_req;
 v_book:=public.jitap_customer_save_calendar_booking(
  p_customer,v_req,p_provider,p_start,p_end,p_note,p_submit);
 if coalesce(v_book->>'ok','false')<>'true' then
  -- The caller must not leave a fabricated service request on failed booking.
  raise exception 'calendar_booking_failed:%',coalesce(v_book->>'error','unknown');
 end if;
 return v_book||jsonb_build_object('requestId',v_req,'serviceId','JT-'||upper(left(v_req::text,8)));
end $$;
revoke all on function public.jitap_customer_create_calendar_request(uuid,text,text,text,text,text,text,timestamptz,timestamptz,text,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.jitap_customer_create_calendar_request(uuid,text,text,text,text,text,text,timestamptz,timestamptz,text,uuid,boolean,text) to service_role;
