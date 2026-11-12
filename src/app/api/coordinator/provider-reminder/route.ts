import {NextRequest} from 'next/server';
import {z} from 'zod';
import {reply,requireCoordinator,supabasePrivate,validOrigin} from '@/lib/coordinator-server';
import {phone254} from '@/lib/provider-alerts';
import {sendWasilianaSms,wasilianaSettings} from '@/lib/wasiliana';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const schema=z.object({caseId:z.string().uuid(),assignmentId:z.string().uuid(),confirm:z.literal(true)}).strict();
type Assignment={id:string;provider_id:string;state:string;responded_at:string|null;assigned_at:string};
type Case={id:string;source_kind:string;source_id:string;status:string};
type Contact={phone_e164:string;sms_opt_in:boolean;opted_out_at:string|null};
type Attempt={id:string;state:string};
export async function POST(req:NextRequest){
 if(!validOrigin(req))return reply({error:'Invalid request origin'},403);
 const staff=await requireCoordinator(req).catch(()=>null);
 if(!staff)return reply({error:'SOC sign-in required'},401);
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return reply({error:'Invalid reminder request'},400);
 const d=parsed.data;
 const assignments=await supabasePrivate<Assignment[]>('coordinator_provider_assignments?select=id,provider_id,state,responded_at,assigned_at&id=eq.'+d.assignmentId+'&case_id=eq.'+d.caseId+'&limit=1');
 const a=assignments[0];
 if(!a||!['proposed','contacted'].includes(a.state)||a.responded_at)
  return reply({error:'Provider has already responded or this request is no longer awaiting a response'},409);
 if(Date.now()-Date.parse(a.assigned_at)<5*60000)
  return reply({error:'Allow five minutes after the initial BUZZ before sending an SMS reminder'},409);
 const cases=await supabasePrivate<Case[]>('coordinator_cases?select=id,source_kind,source_id,status&id=eq.'+d.caseId+'&limit=1');
 const c=cases[0];
 if(!c||c.source_kind!=='website_request'||['cancelled','closed','completed'].includes(c.status))
  return reply({error:'The request is not eligible for a reminder'},409);
 const contact=await supabasePrivate<Contact[]>('provider_notification_contacts?select=phone_e164,sms_opt_in,opted_out_at&provider_id=eq.'+encodeURIComponent(a.provider_id)+'&limit=1');
 const recipient=phone254(contact[0]?.phone_e164||'');
 if(!recipient||!contact[0].sms_opt_in||contact[0].opted_out_at)
  return reply({error:'Provider SMS consent is missing'},409);
 const old=await supabasePrivate<Attempt[]>('jitap_soc_provider_reminders?select=id,state&assignment_id=eq.'+a.id+'&limit=1');
 if(old.length)return reply({error:'A follow-up SMS was already attempted. Check its status before any manual intervention.',state:old[0].state},409);
 const dispatched=await supabasePrivate<{id:string;state:string}[]>('coordinator_sms_attempts?select=id,state&assignment_id=eq.'+a.id+'&limit=3');
 const auto=await supabasePrivate<{state:string}[]>('jitap_provider_alerts?select=state&assignment_id=eq.'+a.id+'&channel=eq.sms&limit=1');
 if(!dispatched.some(x=>x.state==='submitted')&&!auto.some(x=>x.state==='submitted'))
  return reply({error:'Initial provider BUZZ is not confirmed submitted. Resolve first-delivery failure before escalating.'},409);
 if(!wasilianaSettings().configured||!wasilianaSettings().senderConfigured)
  return reply({error:'Wasiliana SMS gateway is not configured'},503);
 let reservation:Attempt[];
 try{reservation=await supabasePrivate<Attempt[]>('jitap_soc_provider_reminders',{method:'POST',
  headers:{Prefer:'return=representation'},
  body:JSON.stringify({assignment_id:a.id,case_id:c.id,sent_by:staff.email})})}
 catch{return reply({error:'A reminder has already been attempted'},409)}
 const reference='JT-'+c.source_id.slice(0,8).toUpperCase();
 // The first BUZZ contains a unique secure link. Never create a new token or invalidate it.
 const body='JiTap Reminder | '+reference+'. Please open the secure BUZZ link in our earlier SMS, review customer details and respond to the request.';
 let state:'submitted'|'rejected'|'unknown'='unknown',id:string|null=null,err:string|null=null;
 try{
  const result=await sendWasilianaSms(recipient,body);
  state=result.accepted?'submitted':'rejected';id=result.providerMessageId||null;err=result.errorCode||null;
 }catch{err='transport_outcome_uncertain_no_auto_retry'}
 await supabasePrivate('jitap_soc_provider_reminders?id=eq.'+reservation[0].id,{method:'PATCH',
  headers:{Prefer:'return=minimal'},
  body:JSON.stringify({state,gateway_message_id:id,error_code:err,finished_at:new Date().toISOString()})}).catch(()=>{});
 return reply({ok:state==='submitted',status:state,message:state==='submitted'
  ?'Wasiliana accepted the SOC reminder. Handset delivery is not guaranteed.'
  :'Reminder status is not confirmed; check the gateway before attempting again.'},state==='submitted'?200:502);
}
