import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {supabasePrivate} from '@/lib/coordinator-server';
import {nativeVerifiedProvider} from '@/lib/native-provider-session';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const uuid=z.string().uuid();
const responseSchema=z.object({requestId:uuid,decision:z.enum(['accepted','declined'])}).strict();
type Offer={request_id:string;provider_user_id:string;wave:number;distance_km:number;expires_at:string;state:string};
type Job={state:string;category:string};
type RequestRow={payload:Record<string,unknown>;status:string};
const clean=(value:unknown,max=140)=>String(typeof value==='string'?value:'')
 .replace(/(?:\+?254|0)[17][0-9]{8}/g,'[contact withheld]')
 .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[email withheld]')
 .replace(/https?:\/\/\S+/gi,'').slice(0,max);
export async function GET(req:NextRequest){
 const provider=await nativeVerifiedProvider(req).catch(()=>null);
 if(!provider)return reply({error:'Provider sign-in required'},401);
 const requestId=req.nextUrl.searchParams.get('requestId')||'';
 if(!uuid.safeParse(requestId).success)return reply({error:'Invalid request'},400);
 try{
  const offers=await supabasePrivate<Offer[]>(
   'jitap_wave_offers?select=request_id,provider_user_id,wave,distance_km,expires_at,state&request_id=eq.'+
   requestId+'&provider_user_id=eq.'+provider+'&limit=1');
  const offer=offers[0];
  if(!offer)return reply({status:'not_available',serverNow:new Date().toISOString()},404);
  const jobs=await supabasePrivate<Job[]>('jitap_wave_dispatch_jobs?select=state,category&request_id=eq.'+requestId+'&limit=1');
  const job=jobs[0];
  const now=new Date().toISOString();
  if(offer.state!=='pending'||offer.expires_at<=now||job?.state!=='searching')
   return reply({status:'expired',serverNow:now});
  const requests=await supabasePrivate<RequestRow[]>(
   'website_intake?select=payload,status&id=eq.'+requestId+'&limit=1');
  if(requests[0]?.status!=='new')return reply({status:'expired',serverNow:now});
  const p=requests[0]?.payload||{};
  return reply({status:'open',serverNow:now,offer:{
   requestId,ref:'JT-'+requestId.slice(0,8).toUpperCase(),
   category:clean(job.category,75),
   summary:clean(p.description||p.title||'Service requested',180),
   area:clean(p.area||'Mombasa',75),
   distanceKm:Number(offer.distance_km),wave:offer.wave,expiresAt:offer.expires_at,
   requestedDate:clean(p.preferredDate||'',20),
   requestedTime:clean(p.preferredTime||'',20)
  }});
 }catch{return reply({error:'Unable to load this opportunity'},503)}
}
export async function POST(req:NextRequest){
 const provider=await nativeVerifiedProvider(req).catch(()=>null);
 if(!provider)return reply({error:'Provider sign-in required'},401);
 if(Number(req.headers.get('content-length')||0)>800)return reply({error:'Payload too large'},413);
 const parsed=responseSchema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return reply({error:'Invalid response'},422);
 try{
  const {requestId,decision}=parsed.data;
  // The database must re-check expiry and atomically lock the original customer ticket.
  const result=await supabasePrivate<{status:string;requestId?:string}>('rpc/jitap_wave_respond',{
   method:'POST',body:JSON.stringify({p_request_id:requestId,p_provider_user_id:provider,p_decision:decision})
  });
  if(result.status==='declined'){
   await supabasePrivate('rpc/jitap_wave_dispatch_tick',{
    method:'POST',body:JSON.stringify({p_limit:20})
   }).catch(()=>{});
  }
  return reply(result);
 }catch{return reply({error:'Unable to respond to JiTap BUZZ'},503)}
}
