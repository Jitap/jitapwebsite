import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getProviderSession} from '@/lib/provider-session-server';
import {sameOrigin} from '@/lib/jitap-auth';
import {supabasePrivate} from '@/lib/coordinator-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const respond=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const uuid=z.string().uuid();
const action=z.discriminatedUnion('action',[
 z.object({action:z.literal('location'),sharing:z.boolean(),latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional()}).strict(),
 z.object({action:z.literal('respond'),requestId:uuid,decision:z.enum(['accepted','declined'])}).strict()
]);
type Offer={request_id:string;distance_km:number;wave:number;expires_at:string;state:string};
type Job={request_id:string;state:string;started_at:string;matched_provider_user_id:string|null;category:string};
type Request={id:string;payload:Record<string,unknown>};
type Review={status:string};
function safeText(raw:unknown,limit:number){
 return String(typeof raw==='string'?raw:'').replace(/(?:\+?254|0)[17][0-9]{8}/g,'[contact withheld]')
  .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[email withheld]').replace(/https?:\/\/\S+/gi,'').slice(0,limit);
}
async function approved(userId:string){
 const reviews=await supabasePrivate<Review[]>('jitap_provider_reviews?select=status&user_id=eq.'+userId+'&limit=1');
 return reviews[0]?.status==='approved';
}
export async function GET(req:NextRequest){
 const session=await getProviderSession(req);
 if(!session)return respond({error:'Provider sign-in required'},401);
 if(!await approved(session.userId))return respond({offer:null,eligible:false,serverNow:new Date().toISOString()});
 try{
  // Idempotent, bounded fan-out. Refresh never prolongs any wave or offer.
  await supabasePrivate('rpc/jitap_wave_dispatch_tick',{method:'POST',body:JSON.stringify({p_limit:10})});
  const offers=await supabasePrivate<Offer[]>(
   'jitap_wave_offers?select=request_id,distance_km,wave,expires_at,state&provider_user_id=eq.'+session.userId+
   '&state=eq.pending&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&order=expires_at.asc&limit=8');
  if(!offers.length)return respond({offer:null,eligible:true,serverNow:new Date().toISOString()});
  const ids=offers.map(o=>o.request_id);
  const jobs=await supabasePrivate<Job[]>('jitap_wave_dispatch_jobs?select=request_id,state,started_at,matched_provider_user_id,category&request_id=in.('+ids.join(',')+')');
  const jobById=new Map(jobs.map(j=>[j.request_id,j]));
  const first=offers.find(o=>jobById.get(o.request_id)?.state==='searching');
  if(!first)return respond({offer:null,eligible:true,serverNow:new Date().toISOString()});
  const request=await supabasePrivate<Request[]>('website_intake?select=id,payload&id=eq.'+first.request_id+'&limit=1');
  const payload=request[0]?.payload||{};
  return respond({
   eligible:true,serverNow:new Date().toISOString(),
   offer:{
    requestId:first.request_id,ref:'JT-'+first.request_id.slice(0,8).toUpperCase(),
    category:safeText(jobById.get(first.request_id)?.category,72),
    brief:safeText(payload.description||payload.title||'Service assessment requested',180),
    location:safeText(payload.locationLabel||payload.area||'Location shared after acceptance',105),
    preferredTime:safeText(payload.preferredTime||payload.timing||'',42),
    distanceKm:Number(first.distance_km),wave:first.wave,expiresAt:first.expires_at,
   }
  });
 }catch{return respond({error:'Wave BUZZ temporarily unavailable'},503)}
}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return respond({error:'Invalid request origin'},403);
 const session=await getProviderSession(req);
 if(!session)return respond({error:'Provider sign-in required'},401);
 if(!await approved(session.userId))return respond({error:'Provider verification required'},403);
 const input=action.safeParse(await req.json().catch(()=>null));
 if(!input.success)return respond({error:'Invalid action'},400);
 const body=input.data;
 try{
  if(body.action==='location'){
   if(!body.sharing){
    await supabasePrivate('jitap_wave_provider_locations?provider_user_id=eq.'+session.userId,{
     method:'DELETE',headers:{Prefer:'return=minimal'}
    });
    return respond({sharing:false});
   }
   if(body.latitude===undefined||body.longitude===undefined)return respond({error:'Location required'},422);
   // Only explicit, user-triggered geolocation sharing is accepted.
   await supabasePrivate('jitap_wave_provider_locations?on_conflict=provider_user_id',{
    method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify({provider_user_id:session.userId,latitude:body.latitude,longitude:body.longitude,observed_at:new Date().toISOString(),sharing_enabled:true})
   });
   return respond({sharing:true,expiresInSeconds:900});
  }
  const result=await supabasePrivate<{status:string;requestId?:string}>('rpc/jitap_wave_respond',{
   method:'POST',body:JSON.stringify({p_request_id:body.requestId,p_provider_user_id:session.userId,p_decision:body.decision})
  });
  return respond(result);
 }catch{return respond({error:'Unable to process Wave BUZZ. Please try again.'},503)}
}
