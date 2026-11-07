import {NextRequest,NextResponse,after} from 'next/server';
import {z} from 'zod';
import {getProviderSession} from '@/lib/provider-session-server';
import {sameOrigin,setAuthCookies} from '@/lib/jitap-auth';
import {SERVICE_OPTIONS,KENYAN_SERVICE_AREAS} from '@/lib/provider-options';
import {getProviderMedia} from '@/lib/provider-media-server';
import {supabasePrivate} from '@/lib/coordinator-server';
import {saveServiceBrief} from '@/lib/service-brief-server';
import {inferService} from '@/lib/data';
import {notifyProviderAccepted} from '@/lib/wasiliana-booking-notifications';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'private, no-store'};
const error=(message:string,status=400)=>NextResponse.json({error:message},{status,headers:noStore});
const allowedCategories=SERVICE_OPTIONS.map(c=>c.value) as [string,...string[]];
const allowedAreas=[...KENYAN_SERVICE_AREAS] as [string,...string[]];
const profile=z.object({
 action:z.literal('save'),
 fullName:z.string().trim().min(2).max(120),
 businessName:z.string().trim().max(120).default(''),
 categories:z.array(z.enum(allowedCategories)).min(1).max(12),
 areas:z.array(z.enum(allowedAreas)).min(1).max(12),
 baseArea:z.enum(allowedAreas),
 experienceYears:z.number().int().min(0).max(60),
 skills:z.string().trim().max(1200).default(''),
 submit:z.boolean().default(false)
}).strict().refine(d=>d.areas.includes(d.baseArea),{message:'Base area must be one of your service areas'});
const availability=z.object({action:z.literal('availability'),online:z.boolean()}).strict();
function config(){
 const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw Error('Supabase not configured');
 return {url,key};
}
async function dbRequest(token:string,path:string,method='GET',body?:unknown,additional?:Record<string,string>){
 const c=config();
 const response=await fetch(c.url+'/rest/v1/'+path,{
  method,headers:{apikey:c.key,Authorization:'Bearer '+token,
   'Content-Type':'application/json',Accept:'application/json',
   ...(method!=='GET'?{Prefer:'return=representation'}:{}),...additional},
  ...(body?{body:JSON.stringify(body)}:{}),
  cache:'no-store',signal:AbortSignal.timeout(9000)
 });
 const data=await response.json().catch(()=>null);
 return {ok:response.ok,status:response.status,data};
}
async function identity(req:NextRequest){return getProviderSession(req)}
function responseWithSession(data:unknown,session:NonNullable<Awaited<ReturnType<typeof identity>>>,status=200){
 const response=NextResponse.json(data,{status,headers:noStore});
 if(session.rotated)setAuthCookies(response,session.rotated.access,session.rotated.refresh,session.rotated.expires);
 return response;
}
export async function GET(req:NextRequest){
 const session=await identity(req);
 if(!session)return error('Sign in with your provider account.',401);
 try{
  const id='eq.'+encodeURIComponent(session.userId);
  const [profileResult,reviewResult,responses,opportunities,media]=await Promise.all([
   dbRequest(session.accessToken,'jitap_provider_workspaces?user_id='+id+'&select=*'),
   dbRequest(session.accessToken,'jitap_provider_reviews?user_id='+id+'&select=status,reviewed_at'),
   dbRequest(session.accessToken,'jitap_provider_buzz_responses?provider_user_id='+id+'&select=request_id,decision,created_at&order=created_at.desc&limit=15'),
   dbRequest(session.accessToken,'rpc/jitap_provider_available_buzz','POST',{}),
   getProviderMedia(session.userId)
  ]);
  if(!profileResult.ok||!reviewResult.ok||!responses.ok||!opportunities.ok)throw Error('read failed');
  // Defense in depth: BUZZ must never offer a trade outside the provider's
  // approved categories and selected service areas, even if RPC behavior changes.
  // A clear conflicting task classification is also excluded (for example a
  // request filed under plumbing but explicitly describing laptop repair).
  const workspace=Array.isArray(profileResult.data)?profileResult.data[0]||null:null;
  const approvedCategories=new Set<string>(Array.isArray(workspace?.categories)?workspace.categories:[]);
  const coverage=new Set<string>(Array.isArray(workspace?.service_areas)?workspace.service_areas:[]);
  type Buzz={request_id:string;category:string;area:string;technical_summary?:string};
  const matchingOpportunities=(Array.isArray(opportunities.data)?opportunities.data:[]).filter((candidate:unknown):candidate is Buzz=>{
   if(!candidate||typeof candidate!=='object')return false;
   const item=candidate as Partial<Buzz>;
   if(typeof item.request_id!=='string'||typeof item.category!=='string'||typeof item.area!=='string')return false;
   if(!approvedCategories.has(item.category)||!coverage.has(item.area))return false;
   const inferred=typeof item.technical_summary==='string'?inferService(item.technical_summary):undefined;
   // If there is no confident classification, preserve the actual category
   // submitted by the customer rather than guessing a different trade.
   const equivalent=(inferred==='it-repairs'&&item.category==='computer-phone-repair')||
    (inferred==='computer-phone-repair'&&item.category==='it-repairs');
   return !inferred||inferred===item.category||equivalent;
  });
  // Lazily organize older, customer-reported requests into professional
  // briefs in small batches. This runs after the response and never blocks BUZZ.
  const oldBriefs=(matchingOpportunities as unknown[])
   .filter((o):o is {request_id:string;brief_source:string}=>
     !!o&&typeof o==='object'&&(o as {brief_source?:string}).brief_source==='reported')
   .slice(0,2);
  if(oldBriefs.length)after(async()=>{
   try{
    const ids=oldBriefs.map(o=>o.request_id);
    const existing=await supabasePrivate<{request_id:string}[]>(
     'jitap_request_service_briefs?select=request_id&request_id=in.('+ids.join(',')+')');
    const processed=new Set(existing.map(b=>b.request_id));
    if(processed.size===ids.length)return;
    const rows=await supabasePrivate<{id:string;payload:Record<string,unknown>}[]>(
     'website_intake?select=id,payload&id=in.('+ids.filter(id=>!processed.has(id)).join(',')+')');
    for(const row of rows){
     const p=row.payload;
     if(typeof p.description!=='string'||typeof p.category!=='string')continue;
     await saveServiceBrief({
      id:row.id,category:p.category,description:p.description,
      area:typeof p.area==='string'?p.area:'',
      timing:typeof p.timing==='string'?p.timing:''
     });
    }
   }catch{console.warn('JiTap historical service brief enrichment skipped')}
  });
  // Confirmed appointments belong to this authenticated provider only.
  // Contact information is never included in public BUZZ opportunities.
  const confirmed=await supabasePrivate<{id:string;request_id:string;provider_user_id:string;status:string}[]>(
   'jitap_provider_appointments?provider_user_id=eq.'+encodeURIComponent(session.userId)+'&status=in.(confirmed,on_my_way,arrived,in_progress,completed)&select=id,request_id,provider_user_id,status&order=created_at.desc&limit=25');
  const confirmedRequests=confirmed.length?await supabasePrivate<{id:string;payload:Record<string,unknown>}[]>(
   'website_intake?id=in.('+confirmed.map(x=>x.request_id).join(',')+')&select=id,payload'):[];
  const confirmedById=new Map(confirmedRequests.map(x=>[x.id,x.payload]));
  const ratings=confirmed.length?await supabasePrivate<{appointment_id:string;stars:number}[]>('jitap_customer_ratings?provider_user_id=eq.'+encodeURIComponent(session.userId)+'&select=appointment_id,stars'):[];
  const confirmedJobs=confirmed.map(a=>{
   const p=confirmedById.get(a.request_id)||{};
   const clean=(x:unknown,max=160)=>typeof x==='string'?x.slice(0,max):'';
   return {id:a.id,requestId:a.request_id,status:a.status,
    customerName:clean(p.name)||'Customer',customerPhone:clean(p.phone,30),
    location:clean(p.locationLabel)||clean(p.area),service:clean(p.category)||'Service',
    latitude:typeof p.locationLat==='number'?p.locationLat:null,
    longitude:typeof p.locationLng==='number'?p.locationLng:null,
    placeId:clean(p.locationPlaceId),rated:ratings.some(r=>r.appointment_id===a.id)};
  });
  return responseWithSession({
   confirmedJobs,
   profile:Array.isArray(profileResult.data)?profileResult.data[0]||null:null,
   reviewStatus:Array.isArray(reviewResult.data)?reviewResult.data[0]?.status||'not_submitted':'not_submitted',
   recentResponses:Array.isArray(responses.data)?responses.data:[],
   opportunities:matchingOpportunities,
   uploadedMedia:media.map(x=>({kind:x.kind,uploadedAt:x.uploaded_at}))
  },session);
 }catch{return error('Unable to load your provider dashboard.',503)}
}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return error('Invalid origin',403);
 if(Number(req.headers.get('content-length')||0)>6500)return error('Payload too large',413);
 const session=await identity(req);if(!session)return error('Sign in with your provider account.',401);
 let input:unknown;
 try{input=await req.json()}catch{return error('Invalid request',400)}
 if(typeof input!=='object'||input===null)return error('Invalid request',400);
 try{
  if((input as {action?:string}).action==='save'){
   const state=await dbRequest(session.accessToken,'jitap_provider_reviews?user_id=eq.'+encodeURIComponent(session.userId)+'&select=status');
   if(!state.ok)throw Error('review status unavailable');
   if(Array.isArray(state.data)&&state.data[0]?.status==='approved')
    return error('Your verified profile is locked. Contact JiTap Service Operations to request changes.',403);
   const parsed=profile.safeParse(input);if(!parsed.success)return error('Please complete your name, services and Kenyan service areas.',422);
   const d=parsed.data;
   const existing=await dbRequest(session.accessToken,'jitap_provider_workspaces?user_id=eq.'+encodeURIComponent(session.userId)+'&select=submitted_at');
   if(!existing.ok)throw Error('read failed');
   const prior=Array.isArray(existing.data)?existing.data[0]?.submitted_at:null;
   const row={
    user_id:session.userId,full_name:d.fullName,business_name:d.businessName,
    categories:[...new Set(d.categories)],service_areas:[...new Set(d.areas)],
    base_area:d.baseArea,experience_years:d.experienceYears,skills:d.skills,
    submitted_at:prior|| (d.submit?new Date().toISOString():null)
   };
   const save=await dbRequest(session.accessToken,'jitap_provider_workspaces?on_conflict=user_id','POST',row,
    {Prefer:'resolution=merge-duplicates,return=representation'});
   if(!save.ok)return error('Unable to save your provider profile. Please try again.',save.status===403?403:503);
   return responseWithSession({saved:true,submitted:!!row.submitted_at},session);
  }
  if((input as {action?:string}).action==='availability'){
   const parsed=availability.safeParse(input);if(!parsed.success)return error('Invalid availability setting',422);
   const r=await dbRequest(session.accessToken,
    'jitap_provider_workspaces?user_id=eq.'+encodeURIComponent(session.userId),
    'PATCH',{is_online:parsed.data.online});
   if(!r.ok)return error(parsed.data.online?'Your profile must be verified by JiTap before you can go online.':'Unable to change availability.',403);
   if(!Array.isArray(r.data)||!r.data.length)return error('Complete provider onboarding first.',409);
   return responseWithSession({online:r.data[0].is_online===true},session);
  }
  if((input as {action?:string}).action==='respond'){
   const parsed=z.object({
    action:z.literal('respond'),requestId:z.string().uuid(),
    decision:z.enum(['accepted','declined','needs_clarification']),
    note:z.string().trim().max(500).default('')
   }).strict().safeParse(input);
   if(!parsed.success)return error('Invalid BUZZ response',422);
   const r=await dbRequest(session.accessToken,'rpc/jitap_provider_answer_buzz','POST',{
    p_request_id:parsed.data.requestId,p_decision:parsed.data.decision,p_note:parsed.data.note
   });
   if(!r.ok)return error('This request has already been accepted or is no longer available.',409);
   if(r.data===true&&parsed.data.decision==='accepted')after(async()=>{try{await notifyProviderAccepted(parsed.data.requestId,session.userId)}catch{console.warn('Wasiliana booking SMS could not be queued')}});
   return responseWithSession({recorded:r.data===true,confirmedBooking:parsed.data.decision==='accepted'},session);
  }
  return error('Unsupported provider action',400);
 }catch{return error('Provider service is temporarily unavailable.',503)}
}
