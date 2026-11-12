import {NextRequest,NextResponse,after} from 'next/server';
import {dispatchKapsoQueue} from '@/lib/kapso-dispatcher';
import {z} from 'zod';
import {getProviderSession} from '@/lib/provider-session-server';
import {sameOrigin} from '@/lib/jitap-auth';
import {supabasePrivate} from '@/lib/coordinator-server';
import {sendProviderCreatedBookingSms,createTrackingInvite} from '@/lib/provider-booking-acquisition';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private,no-store','X-Robots-Tag':'noindex'};
const send=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const schema=z.object({
 title:z.string().trim().min(3).max(120),
 customerName:z.string().trim().min(2).max(120),
 phone:z.string().trim().min(9).max(24),
 location:z.string().trim().min(3).max(180),
 description:z.string().trim().max(2000).default(''),
 date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
 startTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
 endTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
 repeat:z.enum(['none','daily','weekdays','weekly','monthly','yearly','custom']).default('none'),
 interval:z.number().int().min(1).max(12).default(1),
 unit:z.enum(['days','weeks','months']).default('weeks'),
 count:z.number().int().min(1).max(24).default(1),
 reminderMinutes:z.union([z.literal(0),z.literal(5),z.literal(15),z.literal(30),z.literal(60),z.literal(1440),z.null()]).default(30),
 reminderChannel:z.enum(['in_app','whatsapp_manual']).default('in_app'),
 whatsappOptIn:z.boolean().default(false),
 smsNotificationConsent:z.literal(true)
}).strict();
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return send({error:'Invalid request origin'},403);
 if(Number(req.headers.get('content-length')||0)>6500)return send({error:'Request too large'},413);
 const session=await getProviderSession(req);
 if(!session)return send({error:'Sign in as a provider'},401);
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return send({error:'Check the customer and schedule details.'},422);
 const d=parsed.data;
 if(d.startTime>=d.endTime||d.repeat==='none'&&d.count!==1||d.repeat!=='none'&&d.count<2)
  return send({error:'Choose a valid time range and repetition count.'},422);
 if(d.reminderChannel==='whatsapp_manual'&&!d.whatsappOptIn)
  return send({error:'Confirm customer permission for WhatsApp reminders.'},422);
 if(!/^\+?(?:254|0)[17]\d{8}$/.test(d.phone.replace(/[\s-]/g,'')))
  return send({error:'Enter a valid Kenyan customer mobile number.'},422);
 const url=process.env.SUPABASE_URL?.replace(/[/]$/,'');
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return send({error:'Booking service unavailable'},503);
 try{
  const response=await fetch(url+'/rest/v1/rpc/jitap_provider_create_manual_job',{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({p_provider_id:session.userId,p_title:d.title,p_customer_name:d.customerName,
    p_phone:d.phone,p_location:d.location,p_description:d.description,p_date:d.date,
    p_start:d.startTime,p_end:d.endTime,p_repeat:d.repeat,p_interval:d.interval,
    p_unit:d.unit,p_count:d.count,p_reminder_minutes:d.reminderMinutes,
    p_reminder_channel:d.reminderChannel,p_whatsapp_opt_in:d.whatsappOptIn}),
   cache:'no-store',signal:AbortSignal.timeout(20000)
  });
  if(!response.ok)return send({error:'Could not save this booking. Check your schedule, location and contact details.'},422);
  const created=await response.json() as {requestId?:string;reference?:string;count?:number};
  if(!created.requestId)return send({error:'Booking saved but the tracking reference was not returned. Contact JiTap support before attempting another booking.'},502);
  // Resolve provider identity server-side, never from client-controlled form data.
  const providerProfiles=await supabasePrivate<{business_name:string|null;full_name:string|null}[]>('jitap_provider_workspaces?select=business_name,full_name&user_id=eq.'+encodeURIComponent(session.userId)+'&limit=1').catch(()=>[]);
  const providerName=providerProfiles[0]?.business_name?.trim()||providerProfiles[0]?.full_name?.trim()||session.fullName?.trim()||'JiTap service provider';
  // A series of up to 24 bookings receives one introductory SMS, rather than 24 texts.
  // A reserved database attempt prevents duplicate SMS sends on network retries.
  const sms=await sendProviderCreatedBookingSms({
   requestId:created.requestId,providerUserId:session.userId,customerPhone:d.phone,
   customerName:d.customerName,jobTitle:d.title,providerName,count:created.count||1,
   consentConfirmed:d.smsNotificationConsent
  }).catch(()=>({status:'unknown' as const,reason:'sms_dispatch_unavailable'}));
  after(async()=>{await dispatchKapsoQueue(5).catch(()=>{})});
  return send({ok:true,...created,trackingLink:createTrackingInvite(created.requestId).link,smsStatus:sms.status,smsReason:'reason' in sms?sms.reason:undefined});
 }catch{return send({error:'Booking could not be saved. Please retry.'},503)}
}
