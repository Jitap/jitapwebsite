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
const valid=(lat:unknown,lng:unknown):lat is number=>typeof lat==='number'&&typeof lng==='number'&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
export async function GET(req:NextRequest){
 const identity=await getCustomerIdentity(req);
 if(identity.kind!=='customer')return reply({error:'Customer sign-in required'},401);
 const requestId=req.nextUrl.searchParams.get('requestId')||'';
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(requestId))return reply({error:'Invalid request'},422);
 try{
  const requests=await supabasePrivate<Intake[]>('website_intake?select=customer_user_id,payload&id=eq.'+requestId+'&kind=eq.request&limit=1');
  const record=requests[0];
  if(!record||record.customer_user_id!==identity.identity.userId||
    normalizeKenyanPhone(String(record.payload?.phone||''))!==identity.identity.phone)
   return reply({error:'Booking not found'},404);
  const appointments=await supabasePrivate<Appointment[]>('jitap_provider_appointments?select=provider_user_id,status&request_id=eq.'+requestId+'&limit=1');
  const ap=appointments[0];
  if(!ap||ap.status!=='on_my_way')return reply({available:false,reason:'Provider is not en route'});
  const positions=await supabasePrivate<Position[]>('jitap_wave_provider_locations?select=latitude,longitude,observed_at,sharing_enabled&provider_user_id=eq.'+ap.provider_user_id+'&limit=1');
  const position=positions[0];
  if(!position||!position.sharing_enabled||Date.now()-Date.parse(position.observed_at)>120000)
   return reply({available:false,reason:'Waiting for a current provider GPS update'});
  const {locationLat,locationLng}=record.payload;
  if(!valid(locationLat,locationLng)||!valid(position.latitude,position.longitude))
   return reply({available:false,reason:'Route coordinates unavailable'});
  const key=process.env.GOOGLE_MAPS_API_KEY;
  if(!key)return reply({available:false,reason:'Route estimates unavailable'});
  const point=(latitude:number,longitude:number)=>({location:{latLng:{latitude,longitude}}});
  const route=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{
   method:'POST',headers:{'X-Goog-Api-Key':key,'Content-Type':'application/json',
    'X-Goog-FieldMask':'routes.duration,routes.distanceMeters'},
   body:JSON.stringify({
    origin:point(position.latitude,position.longitude),
    destination:point(locationLat,locationLng),
    travelMode:'TWO_WHEELER',units:'METRIC'
   }),cache:'no-store',signal:AbortSignal.timeout(8000)
  });
  if(!route.ok)return reply({available:false,reason:'Current travel estimate unavailable'});
  const data=await route.json() as {routes?:{distanceMeters:number;duration:string}[]};
  const first=data.routes?.[0];
  const seconds=Number(first?.duration?.replace(/s$/,''));
  if(!first||!Number.isFinite(first.distanceMeters)||first.distanceMeters<0||
   !Number.isFinite(seconds)||seconds<0)return reply({available:false,reason:'No current route'});
  return reply({
   available:true,distanceKm:Math.round(first.distanceMeters/100)/10,
   etaMinutes:Math.max(1,Math.ceil(seconds/60)),
   lastLocationAt:position.observed_at,estimatedAt:new Date().toISOString(),
   travelMode:'motorcycle'
  });
 }catch{return reply({available:false,reason:'Location or routes temporarily unavailable'})}
}
