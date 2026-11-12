import 'server-only';
import {supabasePrivate} from '@/lib/coordinator-server';
import {sendJiTapFollowup,followupTemplateReady,type FollowupTemplateKind} from '@/lib/provider-whatsapp-template';
import {phone254} from '@/lib/provider-alerts';

type Followup={
 id:string;event_key:string;request_id:string;appointment_id:string|null;
 recipient_role:'customer'|'provider';event_type:string;template_kind:FollowupTemplateKind;
 recipient_phone:string|null;template_parameters:string[];status:string;created_at:string
};
type Intake={payload:Record<string,unknown>};
type Contact={phone_e164:string;whatsapp_opt_in:boolean;opted_out_at:string|null};
type Appointment={provider_user_id:string};
type Account={phone:string;whatsapp_updates_opt_in:boolean};
type Assignment={provider_id:string};
async function finish(id:string,state:string,error?:string,messageId?:string){
 await supabasePrivate('jitap_service_followups?id=eq.'+id,{method:'PATCH',
  headers:{Prefer:'return=minimal'},
  body:JSON.stringify({status:state,error_code:error||null,provider_message_id:messageId||null,finished_at:new Date().toISOString()})});
}
async function consentStillValid(job:Followup):Promise<boolean>{
 const phone=phone254(job.recipient_phone||'');
 if(!phone)return false;
 if(job.recipient_role==='customer'){
  const records=await supabasePrivate<Intake[]>('website_intake?select=payload&id=eq.'+job.request_id+'&limit=1');
  const data=records[0]?.payload;
  return data?.whatsappOptIn===true&&phone254(String(data?.phone||''))===phone;
 }
 if(job.appointment_id){
  const appointments=await supabasePrivate<Appointment[]>('jitap_provider_appointments?select=provider_user_id&id=eq.'+job.appointment_id+'&limit=1');
  if(!appointments[0])return false;
  const accounts=await supabasePrivate<Account[]>('jitap_accounts?select=phone,whatsapp_updates_opt_in&user_id=eq.'+appointments[0].provider_user_id+'&limit=1');
  return accounts[0]?.whatsapp_updates_opt_in===true&&phone254(accounts[0].phone)===phone;
 }
 // SOC provider confirmation is mapped to the original assignment.
 const assignmentId=job.event_key.startsWith('sod-provider-accepted:')?job.event_key.slice('sod-provider-accepted:'.length):'';
 if(!/^[a-f0-9-]{36}$/i.test(assignmentId))return false;
 const assignment=await supabasePrivate<Assignment[]>('coordinator_provider_assignments?select=provider_id&id=eq.'+assignmentId+'&limit=1');
 if(!assignment[0])return false;
 const contacts=await supabasePrivate<Contact[]>('provider_notification_contacts?select=phone_e164,whatsapp_opt_in,opted_out_at&provider_id=eq.'+encodeURIComponent(assignment[0].provider_id)+'&limit=1');
 return contacts[0]?.whatsapp_opt_in===true&&!contacts[0]?.opted_out_at&&phone254(contacts[0].phone_e164)===phone;
}
export async function dispatchServiceFollowups(limit=4){
 const jobs=await supabasePrivate<Followup[]>('rpc/jitap_claim_followup_events',{method:'POST',body:JSON.stringify({p_limit:limit})});
 const results={claimed:jobs.length,submitted:0,blocked:0,skipped:0,expired:0,failed:0,unknown:0};
 for(const job of jobs){
  try{
   // A late ETA / travel message is misleading; don't send it hours later.
   const age=Date.now()-Date.parse(job.created_at);
   if(age>(job.event_type==='provider_accepted'?24:2)*3600000){
    await finish(job.id,'expired','notification_outdated');results.expired++;continue;
   }
   if(!await consentStillValid(job)){
    await finish(job.id,'skipped','whatsapp_optin_missing_or_changed');results.skipped++;continue;
   }
   if(!followupTemplateReady(job.template_kind)){
    await finish(job.id,'blocked','approved_'+job.template_kind+'_template_not_configured');
    results.blocked++;continue;
   }
   const sent=await sendJiTapFollowup({phone:phone254(job.recipient_phone||'')!,
    kind:job.template_kind,parameters:job.template_parameters});
   if(sent.accepted){await finish(job.id,'submitted',undefined,sent.messageId);results.submitted++}
   else{await finish(job.id,'failed',sent.reason||'provider_rejected');results.failed++}
  }catch{
   // A gateway timeout may occur after message acceptance: never blind-retry.
   await finish(job.id,'unknown','gateway_outcome_requires_reconciliation').catch(()=>{});
   results.unknown++;
  }
 }
 return results;
}
