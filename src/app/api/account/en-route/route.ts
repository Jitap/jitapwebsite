import {NextRequest,NextResponse} from 'next/server';
import {getCustomerIdentity} from '@/lib/customer-session-server';
import {normalizeKenyanPhone} from '@/lib/jitap-auth';
import {supabasePrivate} from '@/lib/coordinator-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
type Intake={customer_user_id:string|null;payload:Record<string,unknown>};
type Appointment={provider_user_id:string;status:string};
type Position={latitude:number;longitude:number;observed_at:string;sharing_enabled:boolean};
type Snapshot={
 provider_user_id:string;provider_location_label:string;location_observed_at:string|null;
 distance_km:number|null;eta_minutes:number|null;route_updated_at:string|null;
};
const valid=(lat:unknown,lng:unknown):lat is number=>
 typeof lat==='number'&&typeof lng==='number'&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;

function present(snap:Snapshot|null,live=false){
 const lastLocationAt=snap?.location_observed_at||null;
 const routeUpdatedAt=snap?.route_updated_at||null;
 const locationLabel=snap?.provider_location_label||'';
 return {
  available:!!lastLocationAt,
  locationLabel:locationLabel||'Provider GPS location',
  lastLocationAt,
  routeUpdatedAt,
  distanceKm:snap?.distance_km===null||snap?.distance_km===undefined?null:Number(snap.distance_km),
  etaMinutes:snap?.eta_minutes===null||snap?.eta_minutes===undefined?null:Number(snap.eta_minutes),
  isLive:live,
  // Retain valid prior values, but tell customers if they are no longer fresh.
  isLastKnown:!live,
  travelMode:'motorcycle'
 };
}
async function addressForProvider(key:string,lat:number,lng:number):Promise<string|null>{
 try{
  const url='https://maps.googleapis.com/maps/api/geocode/json?latlng='+
   encodeURIComponent(lat+','+lng)+'&key='+encodeURIComponent(key);
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(5500)});
  if(!response.ok)return null;
  const data=await response.json() as {
   status?:string;results?:{formatted_address?:string;types?:string[]}[]
  };
  if(data.status!=='OK')return null;
  // Prefer the road/neighborhood name, not an unrelated landmark or precise
  // building/address. Exact GPS coordinates never leave this endpoint.
  const results=data.results||[];
  const chosen=results.find(x=>x.types?.includes('route'))||
   results.find(x=>x.types?.includes('neighborhood'))||
   results.find(x=>x.types?.includes('sublocality'))||
   results.find(x=>x.types?.includes('locality'));
  return chosen?.formatted_address?.slice(0,145)||null;
 }catch{return null}
}
async function routeForCustomer(key:string,from:Position,toLat:number,toLng:number){
 try{
  const point=(latitude:number,longitude:number)=>({location:{latLng:{latitude,longitude}}});
  const response=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{
   method:'POST',
   headers:{'X-Goog-Api-Key':key,'Content-Type':'application/json',
    'X-Goog-FieldMask':'routes.duration,routes.distanceMeters'},
   body:JSON.stringify({
    origin:point(from.latitude,from.longitude),
    destination:point(toLat,toLng),
    travelMode:'TWO_WHEELER',units:'METRIC'
   }),cache:'no-store',signal:AbortSignal.timeout(7500)
  });
  if(!response.ok)return null;
  const data=await response.json() as {routes?:{distanceMeters:number;duration:string}[]};
  const first=data.routes?.[0];
  const seconds=Number(first?.duration?.replace(/s$/,''));
  if(!first||!Number.isFinite(first.distanceMeters)||first.distanceMeters<0||
   !Number.isFinite(seconds)||seconds<0)return null;
  return {
   distance_km:Math.round(first.distanceMeters/100)/10,
   eta_minutes:Math.max(1,Math.ceil(seconds/60))
  };
 }catch{return null}
}

export async function GET(req:NextRequest){
 const identity=await getCustomerIdentity(req);
 if(identity.kind!=='customer')return reply({error:'Customer sign-in required'},401);
 const requestId=req.nextUrl.searchParams.get('requestId')||'';
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(requestId))return reply({error:'Invalid request'},422);
 try{
  const requests=await supabasePrivate<Intake[]>(
   'website_intake?select=customer_user_id,payload&id=eq.'+requestId+'&kind=eq.request&limit=1');
  const record=requests[0];
  if(!record||record.customer_user_id!==identity.identity.userId||
   normalizeKenyanPhone(String(record.payload?.phone||''))!==identity.identity.phone)
   return reply({error:'Booking not found'},404);

  const appointments=await supabasePrivate<Appointment[]>(
   'jitap_provider_appointments?select=provider_user_id,status&request_id=eq.'+requestId+'&limit=1');
  const appointment=appointments[0];
  if(!appointment||appointment.status!=='on_my_way')
   return reply({available:false,reason:'Provider is not en route'});

  const stored=await supabasePrivate<Snapshot[]>(
   'jitap_en_route_snapshots?select=provider_user_id,provider_location_label,location_observed_at,distance_km,eta_minutes,route_updated_at&request_id=eq.'+requestId+'&limit=1');
  // Never reuse a previous provider's location after rematching.
  const previous=stored[0]?.provider_user_id===appointment.provider_user_id?stored[0]:null;
  const positions=await supabasePrivate<Position[]>(
   'jitap_wave_provider_locations?select=latitude,longitude,observed_at,sharing_enabled&provider_user_id=eq.'+
   appointment.provider_user_id+'&limit=1');
  const position=positions[0];
  const fresh=!!position&&position.sharing_enabled&&
   valid(position.latitude,position.longitude)&&
   Number.isFinite(Date.parse(position.observed_at))&&
   Date.now()-Date.parse(position.observed_at)>=0&&
   Date.now()-Date.parse(position.observed_at)<120000;

  if(!fresh)return reply(present(previous));
  // A cached route remains visible even if the next Maps/Geocoding request fails.
  // Avoid recomputing for the same GPS timestamp on repeated customer polls.
  if(previous?.location_observed_at&&Date.parse(previous.location_observed_at)>=Date.parse(position.observed_at)){
   return reply(present(previous,true));
  }
  const key=process.env.GOOGLE_MAPS_API_KEY||'';
  const {locationLat,locationLng}=record.payload;
  const hasDestination=valid(locationLat,locationLng);
  const [label,route]=await Promise.all([
   key?addressForProvider(key,position.latitude,position.longitude):Promise.resolve(null),
   key&&hasDestination?routeForCustomer(key,position,locationLat as number,locationLng as number):Promise.resolve(null)
  ]);
  const next:Snapshot={
   provider_user_id:appointment.provider_user_id,
   provider_location_label:label||previous?.provider_location_label||'Provider GPS location',
   // Preserve the timestamp of the displayed place label if reverse
   // geocoding fails: an older street name is not a newly verified location.
   location_observed_at:label||!previous?.location_observed_at?
    position.observed_at:previous.location_observed_at,
   distance_km:route?.distance_km??previous?.distance_km??null,
   eta_minutes:route?.eta_minutes??previous?.eta_minutes??null,
   route_updated_at:route?new Date().toISOString():previous?.route_updated_at??null
  };
  // The snapshot is private and contains no raw provider GPS coordinates.
  try{
   await supabasePrivate('jitap_en_route_snapshots?on_conflict=request_id',{
    method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify({request_id:requestId,...next,updated_at:new Date().toISOString()})
   });
  }catch{/* Display freshly observed values even if snapshot persistence fails. */}
  return reply(present(next,true));
 }catch{
  // Do not pretend there is a current location when the database fails.
  return reply({available:false,locationLabel:'Provider location unavailable',
   lastLocationAt:null,distanceKm:null,etaMinutes:null,isLastKnown:true});
 }
}
