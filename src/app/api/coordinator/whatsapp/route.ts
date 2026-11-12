import {NextRequest} from 'next/server';
import {z} from 'zod';
import {reply,requireCoordinator,supabasePrivate,validOrigin} from '@/lib/coordinator-server';
import {dispatchProviderAlerts,phone254} from '@/lib/provider-alerts';
import {customerSocWhatsAppReady,providerWhatsAppReady,sendKapsoSocCustomerUpdate} from '@/lib/provider-whatsapp-template';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const schema=z.discriminatedUnion('recipientKind',[
 z.object({caseId:z.string().uuid(),recipientKind:z.literal('provider'),assignmentId:z.string().uuid(),confirm:z.literal(true)}),
 z.object({caseId:z.string().uuid(),recipientKind:z.literal('customer'),updateId:z.string().uuid(),confirm:z.literal(true)})
]);
type CaseRow={id:string;source_kind:string;source_id:string};
type Assignment={id:string;provider_id:string;state:string};
type Contact={phone_e164:string;whatsapp_opt_in:boolean;opted_out_at:string|null};
type Intake={payload:Record<string,unknown>};
type Update={id:string;channel:string;state:string;kind:string;message:string};

export async function POST(req:NextRequest){
 if(!validOrigin(req))return reply({error:'Invalid origin'},403);
 const staff=await requireCoordinator(req).catch(()=>null);
 if(!staff)return reply({error:'Coordinator sign-in required'},401);
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return reply({error:'Invalid notification request'},400);
 const d=parsed.data;
 const cases=await supabasePrivate<CaseRow[]>('coordinator_cases?select=id,source_kind,source_id&id=eq.'+encodeURIComponent(d.caseId)+'&limit=1');
 const c=cases[0];if(!c)return reply({error:'Case not found'},404);
 if(d.recipientKind==='provider'){
  const assignments=await supabasePrivate<Assignment[]>('coordinator_provider_assignments?select=id,provider_id,state&id=eq.'+d.assignmentId+'&case_id=eq.'+d.caseId+'&limit=1');
  const assignment=assignments[0];
  if(!assignment||!['proposed','contacted','needs_clarification','quote_requested'].includes(assignment.state))return reply({error:'Provider assignment is not eligible for an alert'},409);
  const contacts=await supabasePrivate<Contact[]>('provider_notification_contacts?select=phone_e164,whatsapp_opt_in,opted_out_at&provider_id=eq.'+encodeURIComponent(assignment.provider_id)+'&limit=1');
  const contact=contacts[0];
  if(!contact?.whatsapp_opt_in||contact.opted_out_at||!phone254(contact.phone_e164))return reply({error:'Provider WhatsApp consent or phone is unavailable'},409);
  if(!providerWhatsAppReady())return reply({error:'Approved JiTap provider BUZZ WhatsApp template is not configured in Kapso/Meta.'},409);
  const existing=await supabasePrivate<{id:string;state:string;last_error:string|null}[]>('jitap_provider_alerts?select=id,state,last_error&assignment_id=eq.'+d.assignmentId+'&channel=eq.whatsapp&limit=1');
  if(existing.length&&['submitted','sending','unknown','rejected'].includes(existing[0].state))return reply({error:'A WhatsApp notification was already attempted. Review the delivery status before sending another.',state:existing[0].state},409);
  if(existing.length&&existing[0].state==='skipped')return reply({error:'This assignment no longer requires a WhatsApp notification.'},409);
  if(!existing.length){
   await supabasePrivate('jitap_provider_alerts?on_conflict=assignment_id,channel',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({assignment_id:d.assignmentId,case_id:d.caseId,channel:'whatsapp'})});
  }else if(existing[0].state==='blocked'){
   await supabasePrivate('jitap_provider_alerts?id=eq.'+existing[0].id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({state:'pending',last_error:null})});
  }
  const results=await dispatchProviderAlerts(1,d.assignmentId,'whatsapp');
  return reply({ok:results.submitted>0,status:results.submitted>0?'submitted':results.blocked?'blocked':results.unknown?'unknown':results.rejected?'rejected':'queued',message:'WhatsApp submission status is recorded in SOD. API acceptance does not guarantee handset delivery.',results},results.submitted>0?200:409);
 }
 if(c.source_kind!=='website_request')return reply({error:'Customer WhatsApp requires a verified service request'},409);
 const intakes=await supabasePrivate<Intake[]>('website_intake?select=payload&id=eq.'+c.source_id+'&limit=1');
 const payload=intakes[0]?.payload;
 if(!payload||payload.whatsappOptIn!==true)return reply({error:'Customer has not opted in to WhatsApp notifications'},409);
 const updates=await supabasePrivate<Update[]>('coordinator_customer_updates?select=id,channel,state,kind,message&id=eq.'+d.updateId+'&case_id=eq.'+d.caseId+'&limit=1');
 const update=updates[0];if(!update||update.channel!=='whatsapp'||update.state!=='draft')return reply({error:'Save a WhatsApp customer update first'},409);
 const to=phone254(String(payload.phone||''));
 if(!to)return reply({error:'Customer WhatsApp number is invalid'},409);
 if(!customerSocWhatsAppReady())return reply({error:'Approved JiTap customer-update WhatsApp template is not configured in Kapso/Meta.'},409);
 const previous=await supabasePrivate<{id:string;state:string}[]>('jitap_soc_whatsapp_sends?select=id,state&update_id=eq.'+d.updateId+'&limit=1');
 if(previous.length)return reply({error:'This WhatsApp update was already attempted. Check delivery status before retrying.',state:previous[0].state},409);
 let attempt:{id:string}[];
 try{
  attempt=await supabasePrivate<{id:string}[]>('jitap_soc_whatsapp_sends',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({update_id:d.updateId,case_id:d.caseId,sent_by:staff.email})});
 }catch{return reply({error:'A WhatsApp attempt is already in progress for this update.'},409)}
 const reference='JT-'+c.source_id.slice(0,8).toUpperCase();
 let state:'submitted'|'rejected'|'unknown'='unknown',providerMessageId:string|null=null,lastError:string|null=null;
 try{
  const sent=await sendKapsoSocCustomerUpdate({phone:to,reference,kind:update.kind.replaceAll('_',' '),message:update.message.slice(0,180)});
  state=sent.accepted?'submitted':'rejected';providerMessageId=sent.messageId||null;lastError=sent.reason||null;
 }catch{lastError='whatsapp_transport_uncertain_no_auto_retry'}
 await supabasePrivate('jitap_soc_whatsapp_sends?id=eq.'+attempt[0].id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({state,provider_message_id:providerMessageId,last_error:lastError,finished_at:new Date().toISOString()})}).catch(()=>{});
 return reply({ok:state==='submitted',status:state,attemptId:attempt[0].id,message:state==='submitted'?'Kapso accepted the WhatsApp message; handset delivery is not yet confirmed.':'WhatsApp was not confirmed. Review status before retrying.'},state==='submitted'?200:502);
}