import {NextRequest,NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {calculateDrivingRoute} from '@/lib/moving-routes';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const respond=(message:string,status:number)=>NextResponse.json({error:message},{status,headers});
const base=z.object({
  leadId:z.string().uuid().nullable(),
  secret:z.string().min(32).max(120),
  stage:z.number().int().min(1).max(4),
  payload:z.record(z.unknown())
});
const discovery=z.object({pickup:z.string().trim().min(3).max(200),dropoff:z.string().trim().min(3).max(200),movingDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),pickupArea:z.string().trim().min(2).max(80)});
const home=z.object({homeSize:z.enum(['bedsitter','1-bed','2-bed','3-bed']),pickupFloor:z.number().int().min(0).max(40),dropoffFloor:z.number().int().min(0).max(40),liftPickup:z.boolean(),liftDropoff:z.boolean()});
const inventory=z.object({packing:z.enum(['self-packing','fragile-only','full-packing']),special:z.boolean()});
const contact=z.object({phone:z.string().regex(/^(?:\+254|254|0)(?:7|1)\d{8}$/),email:z.union([z.literal(''),z.string().email().max(150)]),intakeReference:z.string().uuid()});
function allowed(req:NextRequest){
 const origin=req.headers.get('origin');if(!origin)return true;
 try{
 const url=new URL(origin);const host=req.headers.get('x-forwarded-host')||req.headers.get('host')||'';
 return url.origin===req.nextUrl.origin||url.origin==='https://'+host||url.origin==='https://www.jitap.app';
 }catch{return false}
}
export async function POST(req:NextRequest){
 if(!allowed(req))return respond('Invalid origin',403);
 if(!req.headers.get('content-type')?.startsWith('application/json'))return respond('JSON required',415);
 let raw:string;try{raw=await req.text();}catch{return respond('Invalid request',400)}
 if(raw.length>8500)return respond('Request too large',413);
 let input:unknown;try{input=JSON.parse(raw)}catch{return respond('Invalid JSON',400)}
 const b=base.safeParse(input);if(!b.success)return respond('Check moving details',422);
 const {leadId,secret,stage}=b.data;
 const schema=stage===1?discovery:stage===2?home:stage===3?inventory:contact;
 const p=schema.safeParse(b.data.payload);if(!p.success)return respond('Please check the highlighted moving details.',422);
 const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const key=process.env.SUPABASE_ANON_KEY;const token=process.env.INTAKE_RPC_TOKEN;const salt=process.env.INTAKE_HASH_SECRET;
 if(!url||!key||!token||!salt)return respond('Moving requests are temporarily unavailable',503);
 const forwarded=(req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-forwarded-for')||'unknown').split(',')[0].slice(0,100);
 const source=createHash('sha256').update(salt+':'+forwarded).digest('hex');
 try{
  const result=await fetch(url+'/rest/v1/rpc/save_moving_lead_authorized',{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({p_token:token,p_lead_id:leadId,p_session_secret:secret,p_stage:stage,p_payload:stage===1?{...p.data,distanceKm:null,routeStatus:process.env.GOOGLE_MAPS_API_KEY?'pending':'unavailable'}:p.data,p_source_hash:source}),
   cache:'no-store',signal:AbortSignal.timeout(12000)
  });
  if(!result.ok){console.error('JiTap moving save failed',{stage,status:result.status});return respond('Could not save your moving progress. Please try again.',502)}
  let saved=await result.json();
  // Persist the session first so the existing database rate limit runs before any billable Maps request.
  if(stage===1&&process.env.GOOGLE_MAPS_API_KEY&&saved.routeAttempts<=5){
   const loc=discovery.parse(p.data);
   const route=await calculateDrivingRoute(loc.pickup,loc.dropoff,loc.pickupArea);
   const verified=await fetch(url+'/rest/v1/rpc/save_moving_lead_authorized',{
    method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({p_token:token,p_lead_id:saved.leadId,p_session_secret:secret,p_stage:1,p_payload:{
     pickup:loc.pickup,dropoff:loc.dropoff,movingDate:loc.movingDate,
     distanceKm:route.distanceKm,routeStatus:route.status
    },p_source_hash:source}),
    cache:'no-store',signal:AbortSignal.timeout(12000)
   });
   if(verified.ok)saved=await verified.json();
   else console.error('JiTap route verification state could not be saved',{status:verified.status});
  }
  return NextResponse.json({ok:true,leadId:saved.leadId,stage:saved.stage,
   estimateKes:saved.estimateKes,distanceKm:saved.distanceKm??null,
   distanceVerified:saved.distanceVerified===true,routeStatus:saved.routeStatus||'unavailable'
  },{status:200,headers});
 }catch{console.error('JiTap moving service unavailable',{stage});return respond('Could not save your moving progress. Please try again.',502)}
}
