import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getProviderSession} from '@/lib/provider-session-server';
import {supabasePrivate} from '@/lib/coordinator-server';
import {sameOrigin} from '@/lib/jitap-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const input=z.object({appointmentId:z.string().uuid(),origin:z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)})}).strict();
const reply=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
type Appointment={id:string;request_id:string;status:string};
type Intake={payload:Record<string,unknown>};
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return reply({error:'Invalid origin'},403);
 const session=await getProviderSession(req);if(!session)return reply({error:'Sign in required'},401);
 const parsed=input.safeParse(await req.json().catch(()=>null));if(!parsed.success)return reply({error:'Invalid coordinates'},422);
 try{
  const rows=await supabasePrivate<Appointment[]>('jitap_provider_appointments?id=eq.'+parsed.data.appointmentId+'&provider_user_id=eq.'+session.userId+'&status=in.(confirmed,on_my_way,arrived,in_progress)&select=id,request_id,status&limit=1');
  if(!rows.length)return reply({error:'Active booking not found'},404);
  const request=await supabasePrivate<Intake[]>('website_intake?id=eq.'+rows[0].request_id+'&select=payload&limit=1');
  const p=request[0]?.payload||{};
  const lat=p.locationLat,lng=p.locationLng;
  if(typeof lat!=='number'||typeof lng!=='number'||!Number.isFinite(lat)||!Number.isFinite(lng))
    return reply({available:false,reason:'Customer GPS coordinates not available'});
  const key=process.env.GOOGLE_MAPS_API_KEY;
  if(!key)return reply({available:false,reason:'Routes service not configured'});
  const point=(latitude:number,longitude:number)=>({location:{latLng:{latitude,longitude}}});
  const result=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{
   method:'POST',headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':'routes.duration,routes.distanceMeters','Content-Type':'application/json'},
   body:JSON.stringify({origin:point(parsed.data.origin.lat,parsed.data.origin.lng),destination:point(lat,lng),travelMode:'TWO_WHEELER',units:'METRIC'}),
   cache:'no-store',signal:AbortSignal.timeout(8000)
  });
  if(!result.ok)return reply({available:false,reason:'Route estimate unavailable'});
  const data=await result.json() as {routes?:{duration:string;distanceMeters:number}[]};
  const route=data.routes?.[0];const secs=Number(route?.duration?.replace(/s$/,''));
  if(!route||!Number.isFinite(secs)||!Number.isFinite(route.distanceMeters))return reply({available:false,reason:'No route found'});
  return reply({available:true,minutes:Math.max(1,Math.ceil(secs/60)),kilometers:Math.round(route.distanceMeters/100)/10,mode:'motorcycle'});
 }catch{return reply({available:false,reason:'Route estimate unavailable'})}
}
