-- Store verified customer-selected coordinates for Google Routes and provider
-- ETA; leave technical appointment reservation duration internal only.
create or replace function public.jitap_customer_create_calendar_request_v2(
 p_customer uuid,p_phone text,p_name text,p_category text,p_area text,
 p_description text,p_location text,p_lat double precision,p_lng double precision,
 p_place_id text,p_start timestamptz,p_note text,p_provider uuid,p_submit boolean,p_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;v_id uuid;
begin
 if p_lat is null or p_lng is null
  or p_lat not between -5 and 5 or p_lng not between 33 and 42
  or length(coalesce(p_place_id,''))>250
 then return jsonb_build_object('error','select_exact_map_location');end if;
 -- A one-hour calendar reservation is an internal scheduling slot, NOT an
 -- estimated service duration or promised end time. Never display it to users.
 v_result:=public.jitap_customer_create_calendar_request(
  p_customer,p_phone,p_name,p_category,p_area,p_description,p_location,
  p_start,p_start+interval '1 hour',p_note,p_provider,p_submit,p_key);
 if v_result->>'ok'<>'true' then return v_result;end if;
 v_id:=(v_result->>'requestId')::uuid;
 update public.website_intake set payload=payload||
 jsonb_build_object('locationLat',p_lat,'locationLng',p_lng,
  'locationPlaceId',nullif(p_place_id,''),'locationSource',
  case when nullif(p_place_id,'') is not null then 'google_places' else 'map_pin' end)
 where id=v_id and customer_user_id=p_customer and kind='request';
 return v_result;
end $$;
revoke all on function public.jitap_customer_create_calendar_request_v2(uuid,text,text,text,text,text,text,double precision,double precision,text,timestamptz,text,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.jitap_customer_create_calendar_request_v2(uuid,text,text,text,text,text,text,double precision,double precision,text,timestamptz,text,uuid,boolean,text) to service_role;
