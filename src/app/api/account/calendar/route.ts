import {NextRequest,NextResponse,after} from 'next/server';
import {z} from 'zod';
import {getCustomerIdentity} from '@/lib/customer-session-server';
import {normalizeKenyanPhone,sameOrigin,setAuthCookies} from '@/lib/jitap-auth';
import {supabasePrivate} from '@/lib/coordinator-server';
import {notifyScheduledBooking} from '@/lib/customer-calendar-notifications';
import {SERVICE_OPTIONS} from '@/lib/provider-options';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const uuid=z.string().uuid();
const time=z.string().datetime({offset:true});
const changes=z.discriminatedUnion('action',[
 z.object({action:z.enum(['save','invite']),requestId:uuid,providerId:uuid.optional(),
  startsAt:time,endsAt:time,note:z.string().max(500).default('')}).strict(),
 z.object({action:z.literal('respond_proposal'),bookingId:uuid,accept:z.boolean()}).strict(),
 z.object({action:z.enum(['create_save','create_invite']),category:z.string().max(70),
  area:z.string().trim().min(2).max(80),description:z.string().trim().min(10).max(1200),
  location:z.string().trim().min(3).max(160),providerId:uuid.optional(),
  startsAt:time,endsAt:time,note:z.string().max(500).default(''),
  idempotencyKey:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
 z.object({action:z.enum(['cancel','reschedule']),bookingId:uuid,
  startsAt:time.optional(),endsAt:time.optional()}).strict(),
 z.object({action:z.literal('respond_change'),bookingId:uuid,accept:z.boolean()}).strict()
]);
type Request={id:string;customer_user_id:string|null;payload:Record<string,unknown>;status:string};
type Offer={id:string;request_id:string;customer_user_id:string;provider_user_id:string|null;starts_at:string;ends_at:string;
 status:string;note:string;proposed_start_at:string|null;proposed_end_at:string|null;response_note:string;created_at:string};
type Provider={user_id:string;full_name:string;business_name:string;categories:string[];service_areas:string[]};
const clean=(v:unknown,max=100)=>typeof v==='string'?v.trim().slice(0,max):'';
const summary=(p:Record<string,unknown>)=>({
 category:clean(p.category,70),area:clean(p.area,70),
 description:clean(p.title,100)||clean(p.description,140)
});
async function customer(req:NextRequest){
 const identity=await getCustomerIdentity(req);
 return identity.kind==='customer'?identity.identity:null;
}
async function ownedRequest(userId:string,phone:string,requestId:string){
 const rows=await supabasePrivate<Request[]>('website_intake?select=id,customer_user_id,payload,status&id=eq.'+encodeURIComponent(requestId)+'&kind=eq.request&limit=1');
 const r=rows[0];
 if(!r||r.customer_user_id!==userId||
  normalizeKenyanPhone(clean(r.payload.phone,28))!==phone)return null;
 return r;
}
export async function GET(req:NextRequest){
 const session=await customer(req).catch(()=>null);
 if(!session)return reply({error:'Customer sign-in required'},401);
 try{
  const rows=await supabasePrivate<Offer[]>('jitap_customer_calendar_bookings?select=*&customer_user_id=eq.'+
   encodeURIComponent(session.userId)+'&order=starts_at.asc&limit=250');
  const bookingRequestIds=[...new Set(rows.map(b=>b.request_id))];
  const serviceRequests=bookingRequestIds.length?await supabasePrivate<{
   id:string;payload:Record<string,unknown>
  }[]>('website_intake?select=id,payload&id=in.('+bookingRequestIds.join(',')+')'):[];
  const requestById=new Map(serviceRequests.map(v=>[v.id,v.payload]));
  const providerIds=[...new Set(rows.map(b=>b.provider_user_id).filter((v):v is string=>!!v))];
  const providerNames=providerIds.length?await supabasePrivate<{user_id:string;business_name:string;full_name:string}[]>(
   'jitap_provider_workspaces?select=user_id,business_name,full_name&user_id=in.('+providerIds.join(',')+')'):[];
  const byProvider=new Map(providerNames.map(p=>[p.user_id,p.business_name||p.full_name||'JiTap provider']));
  const bookings=rows.map(b=>({...b,providerName:byProvider.get(b.provider_user_id||'')||null,
   service:summary(requestById.get(b.request_id)||{})}));
  const requestId=req.nextUrl.searchParams.get('requestId');
  const optionsCategory=req.nextUrl.searchParams.get('category');
  const optionsArea=req.nextUrl.searchParams.get('area');
  if(optionsCategory&&optionsArea&&!requestId){
   const validCategory=SERVICE_OPTIONS.some(s=>s.value===optionsCategory);
   if(!validCategory||optionsArea.length>80)return reply({error:'Invalid service or area'},422);
   const all=await supabasePrivate<Provider[]>('jitap_provider_workspaces?select=user_id,full_name,business_name,categories,service_areas&limit=500');
   const matching=all.filter(p=>p.categories?.includes(optionsCategory)&&p.service_areas?.includes(optionsArea));
   const approvals=matching.length?await supabasePrivate<{user_id:string}[]>(
    'jitap_provider_reviews?select=user_id&status=eq.approved&user_id=in.('+matching.map(p=>p.user_id).join(',')+')'):[];
   const approved=new Set(approvals.map(p=>p.user_id));
   return reply({bookings,providers:matching.filter(p=>approved.has(p.user_id)).map(p=>({
    id:p.user_id,name:p.business_name||p.full_name||'JiTap Provider'
   }))});
  }
  if(!requestId)return reply({bookings});
  if(!uuid.safeParse(requestId).success)return reply({error:'Invalid request'},422);
  const record=await ownedRequest(session.userId,session.phone,requestId);
  if(!record)return reply({error:'Request not found'},404);
  const p=record.payload;
  const all=await supabasePrivate<Provider[]>(
   'jitap_provider_workspaces?select=user_id,full_name,business_name,categories,service_areas&limit=500');
  const matching=all.filter(v=>v.categories?.includes(clean(p.category,70))&&
   v.service_areas?.includes(clean(p.area,70)));
  const approved=matching.length?await supabasePrivate<{user_id:string}[]>(
   'jitap_provider_reviews?select=user_id&status=eq.approved&user_id=in.('+
    matching.map(v=>v.user_id).join(',')+')'):[];
  const approvedIds=new Set(approved.map(v=>v.user_id));
  const providers=matching.filter(v=>approvedIds.has(v.user_id)).map(v=>({
   id:v.user_id,name:v.business_name||v.full_name||'JiTap Provider'
  }));
  const confirmed=await supabasePrivate<{id:string}[]>(
   'jitap_provider_appointments?select=id&request_id=eq.'+requestId+'&limit=1');
  return reply({bookings,request:summary(p),
   canSchedule:confirmed.length===0&&!['closed','completed','cancelled'].includes(record.status),
   providers});
 }catch{return reply({error:'Calendar temporarily unavailable'},503)}
}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return reply({error:'Invalid origin'},403);
 if(Number(req.headers.get('content-length')||0)>3000)return reply({error:'Payload too large'},413);
 const session=await customer(req).catch(()=>null);
 if(!session)return reply({error:'Customer sign-in required'},401);
 const parsed=changes.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return reply({error:'Check booking request, date and time'},422);
 const input=parsed.data;
 try{
  if(input.action==='respond_change'){
   const result=await supabasePrivate<{ok?:boolean;error?:string}>(
    'rpc/jitap_customer_respond_calendar_change',{method:'POST',
     body:JSON.stringify({p_customer:session.userId,p_booking:input.bookingId,p_accept:input.accept})});
   if(!result.ok)return reply({error:result.error||'Change no longer available'},409);
   if(input.accept)after(async()=>{await notifyScheduledBooking(input.bookingId,'accepted','provider').catch(()=>{})});
   return reply(result);
  }
  if(input.action==='cancel'||input.action==='reschedule'){
   if(input.action==='reschedule'&&(!input.startsAt||!input.endsAt))
    return reply({error:'Choose a new date and time'},422);
   const result=await supabasePrivate<{ok?:boolean;error?:string}>(
    'rpc/jitap_customer_manage_calendar_booking',{method:'POST',
     body:JSON.stringify({p_customer:session.userId,p_booking:input.bookingId,
      p_action:input.action,p_start:input.action==='reschedule'?input.startsAt:null,
      p_end:input.action==='reschedule'?input.endsAt:null})});
   if(!result.ok)return reply({error:result.error||'Unable to change this booking'},409);
   after(async()=>{await notifyScheduledBooking(input.bookingId,
    input.action==='cancel'?'cancelled':'reschedule_requested','provider').catch(()=>{})});
   return reply(result);
  }
  if(input.action==='create_save'||input.action==='create_invite'){
   if(!SERVICE_OPTIONS.some(opt=>opt.value===input.category))
    return reply({error:'Select a valid JiTap service'},422);
   if(input.action==='create_invite'&&!input.providerId)
    return reply({error:'Select a matching provider'},422);
   const result=await supabasePrivate<{ok?:boolean;error?:string;id?:string;requestId?:string;serviceId?:string}>(
    'rpc/jitap_customer_create_calendar_request',{method:'POST',body:JSON.stringify({
     p_customer:session.userId,p_phone:session.phone,p_name:session.fullName||'Customer',
     p_category:input.category,p_area:input.area,p_description:input.description,
     p_location:input.location,p_start:input.startsAt,p_end:input.endsAt,
     p_note:input.note,p_provider:input.action==='create_invite'?input.providerId:null,
     p_submit:input.action==='create_invite',p_key:input.idempotencyKey})});
   if(!result.ok)return reply({error:result.error||'Unable to create booking'},409);
   if(input.action==='create_invite'&&result.id)
    after(async()=>{await notifyScheduledBooking(result.id!,'invite','provider').catch(()=>{})});
   return reply(result,201);
  }
  if(input.action==='respond_proposal'){
   const result=await supabasePrivate<{ok?:boolean;error?:string;status?:string}>(
    'rpc/jitap_customer_respond_calendar_proposal',{
     method:'POST',body:JSON.stringify({p_customer:session.userId,p_booking:input.bookingId,p_accept:input.accept})
    });
   if(!result.ok)return reply({error:result.error||'Proposal unavailable'},409);
   if(input.accept)after(async()=>{await notifyScheduledBooking(input.bookingId,'accepted','provider').catch(()=>{})});
   return reply(result);
  }
  const record=await ownedRequest(session.userId,session.phone,input.requestId);
  if(!record)return reply({error:'Request not found'},404);
  const submit=input.action==='invite';
  if(submit&&!input.providerId)return reply({error:'Choose a matching provider'},422);
  const start=new Date(input.startsAt),end=new Date(input.endsAt);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||
   start.getTime()<Date.now()+20*60000||
   start.getTime()>Date.now()+180*86400000||
   end.getTime()<=start.getTime()||end.getTime()-start.getTime()>12*3600000)
   return reply({error:'Choose a future booking of up to 12 hours'},422);
  const result=await supabasePrivate<{ok?:boolean;error?:string;status?:string;id?:string}>(
   'rpc/jitap_customer_save_calendar_booking',{
    method:'POST',body:JSON.stringify({
     p_customer:session.userId,p_request:input.requestId,
     p_provider:submit?input.providerId:null,p_start:input.startsAt,p_end:input.endsAt,
     p_note:input.note,p_submit:submit
    })
   });
  if(!result.ok||!result.id)return reply({error:({
    provider_not_eligible:'This provider does not match the service and area.',
    booking_pending:'A booking invitation is already awaiting a response.',
    provider_has_conflict:'This provider already has a booking at that time.',
    request_already_booked:'This request already has a confirmed provider.',
    invalid_schedule:'Choose a valid future date and time.'
   } as Record<string,string>)[result.error||'']||'Unable to save this calendar booking.'},409);
  if(submit)after(async()=>{await notifyScheduledBooking(result.id!,'invite','provider').catch(()=>{})});
  const response=reply(result,201);
  if(session.rotated)setAuthCookies(response,session.rotated.access,session.rotated.refresh,session.rotated.expires);
  return response;
 }catch{return reply({error:'Calendar booking temporarily unavailable'},503)}
}
