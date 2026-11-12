import 'server-only';
import {createHash,createHmac} from 'node:crypto';
import {supabasePrivate} from '@/lib/coordinator-server';
import {sendWasilianaSms,wasilianaSettings} from '@/lib/wasiliana';
import {sendKapsoProviderBuzz,providerWhatsAppReady} from '@/lib/provider-whatsapp-template';

type Alert={id:string;assignment_id:string;case_id:string;channel:'sms'|'whatsapp';state:string};
type Assignment={id:string;case_id:string;provider_id:string;state:string;assigned_by:string};
type Case={id:string;source_kind:string;source_id:string;status:string};
type Contact={phone_e164:string;sms_opt_in:boolean;whatsapp_opt_in:boolean;opted_out_at:string|null};
type Intake={payload:Record<string,unknown>};
type Link={token_hash:string};
type SmsAttempt={id:string};
export function phone254(value:string){
 const n=value.replace(/\D/g,'');
 const digits=n.startsWith('0')?'254'+n.slice(1):n;
 return /^254[17]\d{8}$/.test(digits)?digits:null;
}
export function shortFault(raw:string){
 const stripped=raw.replace(/(?:\+?254|0)[17]\d{8}/g,'').replace(/https?:\/\/\S+/gi,'').replace(/\s+/g,' ').trim();
 const first=(stripped.split(/\s*(?:Where exactly|How serious|When did|What type|Which type|Is there|Are there|Preferred appointment|Preferred date|Preferred time|What is|Can you|Please select)\s*[:?]|[.;\n]/i)[0]||'').replace(/^(?:my|our|the)\s+/i,'').replace(/^(?:i\s+(?:need|have|am looking for)|we\s+need)\s+/i,'').trim();
 const cleaned=first.slice(0,75).replace(/[.,:;!?\s]+$/,'');
 return cleaned?cleaned[0].toUpperCase()+cleaned.slice(1):'Service assessment requested';
}
export function providerBuzz(ref:string,category:string,description:string){
 return 'JiTap BUZZ | JT-'+ref+'\nService: '+category.replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase())+'\nReported issue: '+shortFault(description);
}
function responseToken(assignmentId:string){
 const secret=process.env.PROVIDER_BUZZ_LINK_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret||secret.length<32)throw Error('provider_link_secret_missing');
 return createHmac('sha256',secret).update('jitap:auto-provider-buzz:v1:'+assignmentId).digest('base64url');
}
async function updateAlert(id:string,state:string,reason:string|null=null,messageId:string|null=null){
 await supabasePrivate('jitap_provider_alerts?id=eq.'+id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({state,last_error:reason?.slice(0,180)||null,provider_message_id:messageId,finished_at:new Date().toISOString()})});
}
async function handleAlert(job:Alert){
 const assignments=await supabasePrivate<Assignment[]>('coordinator_provider_assignments?select=id,case_id,provider_id,state,assigned_by&id=eq.'+job.assignment_id+'&limit=1');
 const a=assignments[0];
 if(!a||!['proposed','contacted','needs_clarification','quote_requested'].includes(a.state)){
  await updateAlert(job.id,'skipped','assignment_not_pending');return 'skipped';
 }
 const cases=await supabasePrivate<Case[]>('coordinator_cases?select=id,source_kind,source_id,status&id=eq.'+job.case_id+'&limit=1');
 const c=cases[0];
 if(!c||c.source_kind!=='website_request'||['closed','completed','cancelled'].includes(c.status)){
  await updateAlert(job.id,'skipped','case_not_eligible');return 'skipped';
 }
 const contacts=await supabasePrivate<Contact[]>('provider_notification_contacts?select=phone_e164,sms_opt_in,whatsapp_opt_in,opted_out_at&provider_id=eq.'+encodeURIComponent(a.provider_id)+'&limit=1');
 const contact=contacts[0],phone=contact&&phone254(contact.phone_e164);
 if(!contact||contact.opted_out_at||!contact[job.channel==='sms'?'sms_opt_in':'whatsapp_opt_in']||!phone){
  await updateAlert(job.id,'blocked','consent_or_phone_unavailable');return 'blocked';
 }
 if(job.channel==='sms'&&!wasilianaSettings().configured){
  await updateAlert(job.id,'blocked','wasiliana_not_configured');return 'blocked';
 }
 if(job.channel==='sms'&&!wasilianaSettings().senderConfigured){
  await updateAlert(job.id,'blocked','sms_sender_not_configured');return 'blocked';
 }
 if(job.channel==='whatsapp'&&!providerWhatsAppReady()){
  await updateAlert(job.id,'blocked','approved_provider_whatsapp_template_not_configured');return 'blocked';
 }
 const intakes=await supabasePrivate<Intake[]>('website_intake?select=payload&id=eq.'+c.source_id+'&kind=eq.request&limit=1');
 const payload=intakes[0]?.payload;
 if(!payload){await updateAlert(job.id,'blocked','request_not_found');return 'blocked'}
 const description=String(payload.description||payload.title||'Service required');
 const category=String(payload.category||'other-services').slice(0,75);
 const ref=c.source_id.slice(0,8).toUpperCase();
 const brief=providerBuzz(ref,category,description);
 const token=responseToken(a.id),tokenHash=createHash('sha256').update(token).digest('hex');
 // A provider has one secure response token shared by SMS and WhatsApp. Never replace an existing manually issued link.
 const links=await supabasePrivate<Link[]>('provider_response_links?select=token_hash&assignment_id=eq.'+a.id+'&limit=1');
 if(links.length&&links[0].token_hash!==tokenHash){
  await updateAlert(job.id,'blocked','existing_provider_link_requires_manual_review');return 'blocked';
 }
 if(!links.length){
  try{await supabasePrivate('provider_response_links?on_conflict=assignment_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({assignment_id:a.id,case_id:c.id,token_hash:tokenHash})})}
  catch{await updateAlert(job.id,'unknown','response_link_creation_failed');return 'unknown'}
  const verified=await supabasePrivate<Link[]>('provider_response_links?select=token_hash&assignment_id=eq.'+a.id+'&limit=1');
  if(verified[0]?.token_hash!==tokenHash){await updateAlert(job.id,'blocked','existing_provider_link_requires_manual_review');return 'blocked'}
 }
 if(job.channel==='sms'){
  const previous=await supabasePrivate<SmsAttempt[]>('coordinator_sms_attempts?select=id&assignment_id=eq.'+a.id+'&limit=1');
  if(previous.length){await updateAlert(job.id,'skipped','sms_already_attempted');return 'skipped'}
  const text=brief+'\nRespond: https://jitap.app/buzz#'+token;
  if(text.length>600){await updateAlert(job.id,'blocked','sms_content_exceeds_limit');return 'blocked'}
  let attempt:SmsAttempt[];
  try{
   attempt=await supabasePrivate<SmsAttempt[]>('coordinator_sms_attempts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({case_id:c.id,assignment_id:a.id,recipient_kind:'provider',recipient_phone:phone,requested_by:a.assigned_by,gateway:'wasiliana'})});
  }catch{await updateAlert(job.id,'blocked','sms_attempt_already_exists');return 'blocked'}
  let state:'submitted'|'rejected'|'unknown'='unknown';
  let id:string|null=null,err:string|null=null,http:number|null=null;
  try{
   const result=await sendWasilianaSms(phone,text);
   state=result.accepted?'submitted':'rejected';id=result.providerMessageId||null;err=result.errorCode||null;http=result.httpStatus;
  }catch{err='sms_transport_uncertain_no_auto_retry'}
  await supabasePrivate('coordinator_sms_attempts?id=eq.'+attempt[0].id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({state,provider_message_id:id,error_code:err,http_status:http,finished_at:new Date().toISOString()})}).catch(()=>{});
  await updateAlert(job.id,state,err,id);return state;
 }
 let state:'submitted'|'rejected'|'unknown'='unknown',id:string|null=null,err:string|null=null;
 try{
  const result=await sendKapsoProviderBuzz({phone,reference:'JT-'+ref,category,issue:shortFault(description),token});
  state=result.accepted?'submitted':'rejected';id=result.messageId||null;err=result.reason||null;
 }catch{err='whatsapp_transport_uncertain_no_auto_retry'}
 await updateAlert(job.id,state,err,id);return state;
}
export async function dispatchProviderAlerts(limit=6,assignmentId?:string,channel?:'whatsapp'){
 const endpoint=channel==='whatsapp'?'rpc/jitap_claim_provider_whatsapp':'rpc/jitap_claim_provider_alerts';
 const payload=channel==='whatsapp'?{p_assignment_id:assignmentId}:{p_limit:limit,p_assignment_id:assignmentId||null};
 const jobs=await supabasePrivate<Alert[]>(endpoint,{method:'POST',body:JSON.stringify(payload)});
 const results:Record<string,number>={claimed:jobs.length,submitted:0,rejected:0,unknown:0,blocked:0,skipped:0};
 for(const job of jobs){
  try{const state=await handleAlert(job);results[state]=(results[state]||0)+1}
  catch{
   // A remote gateway can accept before a timeout. Unknown outcomes must be reconciled manually, never blindly retried.
   await updateAlert(job.id,'unknown','dispatcher_exception_reconcile_before_retry').catch(()=>{});
   results.unknown++;
  }
 }
 return results;
}
