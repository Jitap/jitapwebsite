import {NextRequest,NextResponse,after} from 'next/server';
import {z} from 'zod';
import {getProviderSession} from '@/lib/provider-session-server';
import {sameOrigin} from '@/lib/jitap-auth';
import {supabasePrivate} from '@/lib/coordinator-server';
import {notifyProviderCancelled} from '@/lib/wasiliana-booking-notifications';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
type Appointment={id:string;request_id:string;provider_user_id:string;starts_at:string;ends_at:string;status:string;on_my_way_at:string|null};
type Brief={id:string;payload:Record<string,unknown>;customer_user_id:string|null};
const safeText=(value:unknown)=>typeof value==='string'?value.slice(0,1200):'';
async function myAppointment(userId:string,id:string){
 const rows=await supabasePrivate<Appointment[]>('jitap_provider_appointments?id=eq.'+encodeURIComponent(id)+'&provider_user_id=eq.'+encodeURIComponent(userId)+'&select=*');
 return rows[0]||null;
}
export async function GET(req:NextRequest){
 const session=await getProviderSession(req);
 if(!session)return reply({error:'Sign in as a provider'},401);
 try{
  const appointments=await supabasePrivate<Appointment[]>('jitap_provider_appointments?provider_user_id=eq.'+encodeURIComponent(session.userId)+'&select=*&order=starts_at.asc&limit=250');
  const ids=appointments.map(a=>a.request_id);
  const briefs=ids.length?await supabasePrivate<Brief[]>('website_intake?id=in.('+ids.map(encodeURIComponent).join(',')+')&select=id,payload,customer_user_id'):[];
  const byId=new Map(briefs.map(b=>[b.id,b]));
  const pending=appointments.length?await supabasePrivate<{appointment_id:string;id:string;proposed_start_at:string;proposed_end_at:string;status:string}[]>('jitap_appointment_reschedule_requests?provider_user_id=eq.'+encodeURIComponent(session.userId)+'&status=eq.pending&select=id,appointment_id,proposed_start_at,proposed_end_at,status'):[];
  return reply({appointments:appointments.map(a=>{
   const record=byId.get(a.request_id);
   const p=record?.payload||{};
   return {id:a.id,requestId:a.request_id,startsAt:a.starts_at,endsAt:a.ends_at,status:a.status,
    title:safeText(p.description)||safeText(p.category)||'Scheduled service',
    category:safeText(p.category),area:safeText(p.area),
    location:safeText(p.locationLabel)||safeText(p.area),
    latitude:typeof p.locationLat==='number'?p.locationLat:null,
    longitude:typeof p.locationLng==='number'?p.locationLng:null,
    placeId:safeText(p.locationPlaceId),
    customerName:safeText(p.name)||'Customer',
    customerPhone:safeText(p.phone),
    description:safeText(p.description),
    pendingReschedule:pending.find(x=>x.appointment_id===a.id)||null};
  })});
 }catch{return reply({error:'Calendar is temporarily unavailable'},503)}
}
const action=z.discriminatedUnion('action',[
 z.object({action:z.literal('on_my_way'),appointmentId:z.string().uuid()}).strict(),
 z.object({action:z.literal('cancel'),appointmentId:z.string().uuid(),reason:z.enum(['schedule_conflict','unavailable','too_far','tools_or_skills','scope_changed','personal_emergency','other']),details:z.string().trim().max(500).default('')}).strict(),
 z.object({action:z.literal('reschedule'),appointmentId:z.string().uuid(),start:z.string().datetime({offset:true}),end:z.string().datetime({offset:true}),reason:z.string().trim().max(500).default('')}).strict()
]);
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return reply({error:'Invalid origin'},403);
 if(Number(req.headers.get('content-length')||0)>2500)return reply({error:'Request too large'},413);
 const session=await getProviderSession(req);
 if(!session)return reply({error:'Sign in as a provider'},401);
 const data=action.safeParse(await req.json().catch(()=>null));
 if(!data.success)return reply({error:'Invalid appointment action'},422);
 try{
  const appointment=await myAppointment(session.userId,data.data.appointmentId);
  if(!appointment)return reply({error:'Appointment not found'},404);
  if(data.data.action==='cancel'){
   if(appointment.status!=='confirmed'&&appointment.status!=='on_my_way')return reply({error:'Only an active job can be cancelled'},409);
   const url=process.env.SUPABASE_URL?.replace(/\\/$/,'');
   const key=process.env.SUPABASE_ANON_KEY;
   if(!url||!key)return reply({error:'Cancellation temporarily unavailable'},503);
   const gateway=await fetch(url+'/rest/v1/rpc/jitap_provider_cancel_job',{
    method:'POST',headers:{apikey:key,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},
    body:JSON.stringify({p_appointment_id:appointment.id,p_reason:data.data.reason,p_details:data.data.details}),
    cache:'no-store',signal:AbortSignal.timeout(10000)
   });
   if(!gateway.ok)return reply({error:'Cancellation is no longer available. Refresh your booking.'},409);
   const cancellationId=await gateway.json() as string;
   after(async()=>{try{await notifyProviderCancelled(appointment.request_id,cancellationId)}catch{console.warn('Wasiliana cancellation SMS could not be queued')}});
   return reply({cancelled:true,cancellationId,status:'awaiting_customer',message:'Cancellation recorded. Customer approval is required before rematching.'});
  }
  if(data.data.action==='on_my_way'){
   if(appointment.status==='on_my_way')return reply({status:'on_my_way',alreadyUpdated:true});
   if(appointment.status!=='confirmed')return reply({error:'Only confirmed upcoming appointments can be marked on my way'},409);
   const updated=await supabasePrivate<Appointment[]>('jitap_provider_appointments?id=eq.'+encodeURIComponent(appointment.id)+'&provider_user_id=eq.'+encodeURIComponent(session.userId)+'&status=eq.confirmed',{
    method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'on_my_way',on_my_way_at:new Date().toISOString(),updated_at:new Date().toISOString()})
   });
   if(!updated.length)return reply({error:'Appointment was changed; refresh and try again'},409);
   return reply({status:'on_my_way',recorded:true});
  }
  if(appointment.status!=='confirmed'&&appointment.status!=='on_my_way')return reply({error:'This appointment cannot be rescheduled'},409);
  const start=new Date(data.data.start),end=new Date(data.data.end);
  if(!(end>start)||end.getTime()-start.getTime()>24*3600000||start.getTime()<Date.now()-60000)return reply({error:'Choose a future date and valid end time'},422);
  const pending=await supabasePrivate<{id:string}[]>('jitap_appointment_reschedule_requests?appointment_id=eq.'+encodeURIComponent(appointment.id)+'&status=eq.pending&select=id&limit=1');
  if(pending.length)return reply({error:'A reschedule request is already awaiting confirmation'},409);
  await supabasePrivate('jitap_appointment_reschedule_requests',{
   method:'POST',headers:{Prefer:'return=representation'},
   body:JSON.stringify({appointment_id:appointment.id,provider_user_id:session.userId,proposed_start_at:start.toISOString(),proposed_end_at:end.toISOString(),reason:data.data.reason,status:'pending'})
  });
  return reply({requested:true,confirmed:false,message:'Reschedule submitted to JiTap Service Operations for confirmation.'});
 }catch{return reply({error:'Unable to update appointment. Please try again.'},503)}
}
