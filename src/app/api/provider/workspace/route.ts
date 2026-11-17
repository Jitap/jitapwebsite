import {getReviewSession} from '@/lib/jitap-review-session';
import {reviewerProviderDashboard} from '@/lib/jitap-review-fixtures';
import {NextRequest,NextResponse,after} from 'next/server';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {getProviderSession} from '@/lib/provider-session-server';
import {sameOrigin,setAuthCookies,normalizeKenyanPhone} from '@/lib/jitap-auth';
import {SERVICE_OPTIONS,KENYAN_SERVICE_AREAS} from '@/lib/provider-options';
import {getProviderMedia} from '@/lib/provider-media-server';
import {supabasePrivate} from '@/lib/coordinator-server';
import {saveServiceBrief} from '@/lib/service-brief-server';
import {inferService} from '@/lib/data';
import {canonicalTrade} from '@/lib/provider-ranking';
import {dispatchKapsoQueue} from '@/lib/kapso-dispatcher';
import {providerResponseToken} from '@/lib/provider-alerts';
import {customerTrustMetrics} from '@/lib/trust-metrics-server';

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
const availability=z.discriminatedUnion('online',[
 z.object({action:z.literal('availability'),online:z.literal(true),latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180)}).strict(),
 z.object({action:z.literal('availability'),online:z.literal(false)}).strict()
]);
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
type DirectInvitation={requestId:string;serviceId:string;category:string;area:string;url:string};
async function directProviderInvitations(verifiedPhone:string):Promise<DirectInvitation[]>{
 // This fallback is restricted to an OTP-verified provider account whose mobile
 // number exactly matches the notification contact registered for the provider ID.
 // Neither provider IDs nor BUZZ links can be requested from the browser.
 const contacts=await supabasePrivate<{provider_id:string;phone_e164:string;opted_out_at:string|null}[]>(
  'provider_notification_contacts?select=provider_id,phone_e164,opted_out_at&limit=500');
 const providerIds=contacts
  .filter(c=>!c.opted_out_at&&normalizeKenyanPhone(c.phone_e164)===verifiedPhone)
  .map(c=>c.provider_id);
 if(!providerIds.length)return [];
 const verified=await supabasePrivate<{id:string}[]>(
  'provider_profiles?select=id&id=in.('+providerIds.map(encodeURIComponent).join(',')+')&verified_at=not.is.null&is_public=eq.true');
 if(!verified.length)return [];
 const ids=verified.map(p=>p.id);
 const assignments=await supabasePrivate<{id:string;case_id:string;provider_id:string}[]>(
  'coordinator_provider_assignments?select=id,case_id,provider_id&provider_id=in.('+ids.join(',')+')&state=in.(proposed,contacted,needs_clarification,quote_requested)&order=assigned_at.desc&limit=20');
 if(!assignments.length)return [];
 const links=await supabasePrivate<{assignment_id:string;token_hash:string;used_at:string|null;expires_at:string;opened_at:string|null}[]>(
  'provider_response_links?select=assignment_id,token_hash,used_at,expires_at,opened_at&assignment_id=in.('+assignments.map(a=>a.id).join(',')+')');
 const validLinks=new Map(links.filter(l=>!l.used_at&&Date.parse(l.expires_at)>Date.now()&&(!l.opened_at||Date.parse(l.opened_at)+59000>Date.now())).map(l=>[l.assignment_id,l]));
 const cases=await supabasePrivate<{id:string;source_id:string;source_kind:string;status:string}[]>(
  'coordinator_cases?select=id,source_id,source_kind,status&id=in.('+assignments.map(a=>a.case_id).join(',')+')');
 const liveCases=new Map(cases.filter(c=>c.source_kind==='website_request'&&!['cancelled','closed','completed'].includes(c.status)).map(c=>[c.id,c]));
 if(!liveCases.size)return [];
 const requests=await supabasePrivate<{id:string;payload:Record<string,unknown>}[]>(
  'website_intake?select=id,payload&id=in.('+Array.from(new Set([...liveCases.values()].map(c=>c.source_id))).join(',')+')');
 const byRequest=new Map(requests.map(r=>[r.id,r.payload]));
 return assignments.flatMap(a=>{
  const l=validLinks.get(a.id),c=liveCases.get(a.case_id);
  if(!l||!c)return [];
  const token=providerResponseToken(a.id);
  if(createHash('sha256').update(token).digest('hex')!==l.token_hash)return [];
  const payload=byRequest.get(c.source_id);
  if(!payload)return [];
  return [{
   requestId:c.source_id,serviceId:'JT-'+c.source_id.slice(0,8).toUpperCase(),
   category:typeof payload.category==='string'?payload.category.slice(0,80):'Service',
   area:typeof payload.area==='string'?payload.area.slice(0,80):'Mombasa',
   url:'/buzz#'+token
  }];
 });
}
export async function GET(req:NextRequest){
 const review=getReviewSession(req);
 if(review)return review.role==='provider'?NextResponse.json({...reviewerProviderDashboard,reviewer:true},{headers:noStore}):error('Provider mode required',403);
 const session=await identity(req);
 if(!session)return error('Sign in with your provider account.',401);
 try{
  const id='eq.'+encodeURIComponent(session.userId);
  const [profileResult,reviewResult,responses,opportunities,media,notificationReads]=await Promise.all([
   dbRequest(session.accessToken,'jitap_provider_workspaces?user_id='+id+'&select=*'),
   dbRequest(session.accessToken,'jitap_provider_reviews?user_id='+id+'&select=status,reviewed_at'),
   dbRequest(session.accessToken,'jitap_provider_buzz_responses?provider_user_id='+id+'&select=request_id,decision,created_at&order=created_at.desc&limit=15'),
   dbRequest(session.accessToken,'rpc/jitap_provider_available_buzz','POST',{}),
   getProviderMedia(session.userId),
   dbRequest(session.accessToken,'jitap_provider_notification_reads?provider_user_id='+id+'&select=request_id&order=read_at.desc&limit=1000')
  ]);
  if(!profileResult.ok||!reviewResult.ok||!responses.ok||!opportunities.ok||!notificationReads.ok)throw Error('read failed');
  // Defense in depth: BUZZ must never offer a trade outside the provider's
  // approved categories and selected service areas, even if RPC behavior changes.
  // A clear conflicting task classification is also excluded (for example a
  // request filed under plumbing but explicitly describing laptop repair).
  const workspace=Array.isArray(profileResult.data)?profileResult.data[0]||null:null;
  const approvedCategories=new Set<string>((Array.isArray(workspace?.categories)?workspace.categories:[]).map(canonicalTrade));
  const coverage=new Set<string>(Array.isArray(workspace?.service_areas)?workspace.service_areas:[]);
  // Fetch after the offer-issuing RPC. The timestamp comes from Postgres, not
  // the handset clock, and is never renewed by refresh or repeated polling.
  const offerRecords=await dbRequest(session.accessToken,
   'jitap_provider_offer_windows?select=request_id,expires_at&provider_user_id='+id+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&limit=200');
  if(!offerRecords.ok)throw Error('Offer expiry state unavailable');
  const expirationById=new Map<string,string>((Array.isArray(offerRecords.data)?offerRecords.data:[])
   .map((o:{request_id:string;expires_at:string})=>[o.request_id,o.expires_at]));
  type Buzz={request_id:string;category:string;area:string;technical_summary?:string};
  const matchingOpportunities=(Array.isArray(opportunities.data)?opportunities.data:[])
   .filter((candidate:unknown):candidate is Buzz=>{
    if(!candidate||typeof candidate!=='object')return false;
    const item=candidate as Partial<Buzz>;
    if(typeof item.request_id!=='string'||typeof item.category!=='string'||typeof item.area!=='string')return false;
    if(!approvedCategories.has(canonicalTrade(item.category))||!coverage.has(item.area))return false;
    const inferred=typeof item.technical_summary==='string'?inferService(item.technical_summary):undefined;
    return !inferred||canonicalTrade(inferred)===canonicalTrade(item.category);
   })
   .filter(o=>expirationById.has(o.request_id))
   .map(o=>({...o,offer_expires_at:expirationById.get(o.request_id)!}));
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
   'jitap_provider_appointments?provider_user_id=eq.'+encodeURIComponent(session.userId)+'&status=in.(confirmed,on_my_way,arrived,in_progress,completed)&select=id,request_id,provider_user_id,status&order=created_at.desc&limit=250');
  const confirmedRequests=confirmed.length?await supabasePrivate<{id:string;payload:Record<string,unknown>;customer_user_id:string|null}[]>(
   'website_intake?id=in.('+confirmed.map(x=>x.request_id).join(',')+')&select=id,payload,customer_user_id'):[];
  const confirmedById=new Map(confirmedRequests.map(x=>[x.id,x.payload]));
  const requestById=new Map(confirmedRequests.map(x=>[x.id,x]));
  const customerStats=await customerTrustMetrics(confirmedRequests.map(x=>x.customer_user_id||'')).catch(()=>new Map());
  const ratings=confirmed.length?await supabasePrivate<{appointment_id:string;stars:number}[]>('jitap_customer_ratings?provider_user_id=eq.'+encodeURIComponent(session.userId)+'&select=appointment_id,stars'):[];
  const confirmedJobs=confirmed.map(a=>{
   const p=confirmedById.get(a.request_id)||{};
    const customer=customerStats.get(requestById.get(a.request_id)?.customer_user_id||'');
   const clean=(x:unknown,max=160)=>typeof x==='string'?x.slice(0,max):'';
   return {id:a.id,requestId:a.request_id,status:a.status,
    customerName:clean(p.name)||'Customer',customerPhone:clean(p.phone,30),
    location:clean(p.locationLabel)||clean(p.area),service:clean(p.title)||clean(p.category)||'Service',
    latitude:typeof p.locationLat==='number'?p.locationLat:null,
    longitude:typeof p.locationLng==='number'?p.locationLng:null,
    placeId:clean(p.locationPlaceId),rated:ratings.some(r=>r.appointment_id===a.id),
     customerRating:customer?.rating??null,customerRatingCount:customer?.ratingCount??0,
     customerRequestedJobs:customer?.jobs??null};
  });
  // A missing carrier SMS must not prevent an authenticated provider from responding.
  const directInvitations=await directProviderInvitations(session.phone).catch(()=>[] as DirectInvitation[]);
  return responseWithSession({
   directInvitations,
   confirmedJobs,
   onboardingName:session.fullName||'',
   readNotificationIds:Array.isArray(notificationReads.data)?notificationReads.data.map((r:{request_id:string})=>r.request_id):[],
   profile:Array.isArray(profileResult.data)?profileResult.data[0]||null:null,
   reviewStatus:Array.isArray(reviewResult.data)?reviewResult.data[0]?.status||'not_submitted':'not_submitted',
   recentResponses:Array.isArray(responses.data)?responses.data:[],
   opportunities:matchingOpportunities,
   uploadedMedia:media.map(x=>({kind:x.kind,uploadedAt:x.uploaded_at}))
  },session);
 }catch{return error('Unable to load your provider dashboard.',503)}
}
export async function POST(req:NextRequest){
 if(getReviewSession(req))return error('Review mode: no live provider actions are allowed. Switch modes to review the customer experience.',403);
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
   const parsed=availability.safeParse(input);
   if(!parsed.success)return error('Allow precise location to go online and receive nearby requests.',422);
   const d=parsed.data;
   const gpsPath='jitap_wave_provider_locations?provider_user_id=eq.'+encodeURIComponent(session.userId);
   if(d.online){
    const review=await dbRequest(session.accessToken,
     'jitap_provider_reviews?select=status&user_id=eq.'+encodeURIComponent(session.userId));
    if(!review.ok||!Array.isArray(review.data)||review.data[0]?.status!=='approved')
     return error('JiTap verification is required before you can go online.',403);
    await supabasePrivate('jitap_wave_provider_locations?on_conflict=provider_user_id',{
     method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
     body:JSON.stringify({provider_user_id:session.userId,latitude:d.latitude,longitude:d.longitude,
      observed_at:new Date().toISOString(),sharing_enabled:true})
    });
   }
   const changed=await dbRequest(session.accessToken,
    'jitap_provider_workspaces?user_id=eq.'+encodeURIComponent(session.userId),
    'PATCH',{is_online:d.online});
   if(!changed.ok||!Array.isArray(changed.data)||!changed.data.length){
    if(d.online)await supabasePrivate(gpsPath,{method:'DELETE',headers:{Prefer:'return=minimal'}}).catch(()=>{});
    return error('Unable to update availability. Please try again.',503);
   }
   if(!d.online)await supabasePrivate(gpsPath,{method:'DELETE',headers:{Prefer:'return=minimal'}});
   return responseWithSession({online:changed.data[0].is_online===true,locationEnabled:d.online},session);
  }
  if((input as {action?:string}).action==='read_notification'){
   const parsed=z.object({action:z.literal('read_notification'),requestId:z.string().uuid()}).strict().safeParse(input);
   if(!parsed.success)return error('Invalid notification',422);
   // Only acknowledge an opportunity currently available to this provider.
   // Even if it was claimed after display, the read receipt is harmless.
   const available=await dbRequest(session.accessToken,'rpc/jitap_provider_available_buzz','POST',{});
   if(!available.ok)return error('Notifications temporarily unavailable',503);
   const hasRequest=Array.isArray(available.data)&&available.data.some((entry:{request_id?:string})=>entry.request_id===parsed.data.requestId);
   if(!hasRequest)return error('This notification is no longer available',409);
   const result=await dbRequest(session.accessToken,'jitap_provider_notification_reads?on_conflict=provider_user_id,request_id','POST',{
    provider_user_id:session.userId,request_id:parsed.data.requestId
   },{Prefer:'resolution=ignore-duplicates,return=representation'});
   if(!result.ok)return error('Could not mark notification as read',503);
   return responseWithSession({read:true},session);
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
   if(!r.ok){
    // A retry after a successful transaction must not look like a failed booking.
    const booked=await supabasePrivate<{id:string;provider_user_id:string;status:string}[]>(
     'jitap_provider_appointments?request_id=eq.'+parsed.data.requestId+'&select=id,provider_user_id,status&limit=1');
    if(parsed.data.decision==='accepted'&&booked.some(a=>a.provider_user_id===session.userId&&['confirmed','on_my_way','arrived','in_progress','completed'].includes(a.status)))
     return responseWithSession({recorded:true,confirmedBooking:true},session);
    if(booked.length)return error('This job is no longer available for acceptance.',409);
    const message=String(r.data?.message||'');
    if(r.status>=500)return error('Unable to record your response. Please retry.',503);
    if(/not approved and online/i.test(message))return error('Go online with an approved provider account to respond.',409);
    if(/already responded/i.test(message))return error('You have already responded to this request.',409);
    if(/no longer available/i.test(message))return error('Your offer expired or is no longer available. The customer request may still be active.',409);
    console.warn('JiTap BUZZ response rejected',r.data?.code||r.status);
    return error('Unable to record your response. Please retry.',503);
   }
   if(r.data===true&&parsed.data.decision==='accepted')after(async()=>{
    await dispatchKapsoQueue(3);
   });
   return responseWithSession({recorded:r.data===true,confirmedBooking:parsed.data.decision==='accepted'},session);
  }
  return error('Unsupported provider action',400);
 }catch{return error('Provider service is temporarily unavailable.',503)}
}
