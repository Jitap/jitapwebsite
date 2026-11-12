import {NextRequest} from 'next/server';
import {z} from 'zod';
import {reply,requireCoordinator,supabasePrivate,validOrigin} from '@/lib/coordinator-server';
import {wasilianaSettings} from '@/lib/wasiliana';
import {dispatchProviderAlerts} from '@/lib/provider-alerts';
import {dispatchKapsoQueue} from '@/lib/kapso-dispatcher';
import {providerWhatsAppReady,customerSocWhatsAppReady} from '@/lib/provider-whatsapp-template';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=z.string().uuid();
const request=z.discriminatedUnion('action',[
 z.object({action:z.literal('assign_provider'),caseId:uuid,providerId:z.string().min(1).max(120),note:z.string().max(1000).optional()}),
 z.object({action:z.literal('provider_sms_draft'),caseId:uuid,assignmentId:uuid,message:z.string().trim().min(10).max(600)}),
 z.object({action:z.literal('provider_response'),caseId:uuid,assignmentId:uuid,state:z.enum(['contacted','accepted','declined','needs_clarification','quote_requested','quote_received','cancelled']),quote:z.number().min(0).max(100000000).nullable().optional(),note:z.string().max(1000).optional()}),
 z.object({action:z.literal('customer_update_draft'),caseId:uuid,kind:z.enum(['request_received','provider_search','provider_found','quote_update','scheduled','progress','completion','clarification']),channel:z.enum(['whatsapp','sms','phone']),message:z.string().trim().min(10).max(1200)}),
 z.object({action:z.literal('customer_update_mark_sent'),caseId:uuid,updateId:uuid}),
]);
type Assignment={id:string;case_id:string;provider_id:string;state:string;quoted_amount_kes:number|null;notes:string|null;assigned_at:string;responded_at:string|null;updated_at:string};
type Provider={id:string;business_name:string;service_categories:string[];service_areas:string[];base_area:string|null};
type ProviderContact={provider_id:string;phone_e164:string;sms_opt_in:boolean;whatsapp_opt_in:boolean;opted_out_at:string|null};
type TechnicalBrief={technical_summary:string;proposed_scope:string;urgency:string;source:string};
type SmsAttempt={id:string;customer_update_id:string|null;assignment_id:string|null;recipient_kind:string;gateway:string;state:string;requested_at:string;http_status:number|null;provider_message_id:string|null};
type ProviderDraft={id:string;assignment_id:string;message:string;created_at:string;updated_at:string};
type CustomerUpdate={id:string;case_id:string;kind:string;channel:string;message:string;state:string;prepared_by:string;sent_by:string|null;sent_at:string|null;created_at:string};
export async function GET(req:NextRequest){
 try{
  const staff=await requireCoordinator(req);
  if(!staff)return reply({error:'Sign in required'},401);
  const caseId=new URL(req.url).searchParams.get('caseId');
  if(caseId&&!uuid.safeParse(caseId).success)return reply({error:'Invalid case ID'},400);
  const providers=await supabasePrivate<Provider[]>('provider_profiles?select=id,business_name,service_categories,service_areas,base_area&is_public=eq.true&verified_at=not.is.null&order=business_name.asc&limit=200');
  if(!caseId)return reply({ok:true,providers});
  const contacts=await supabasePrivate<ProviderContact[]>('provider_notification_contacts?select=provider_id,phone_e164,sms_opt_in,whatsapp_opt_in,opted_out_at&limit=200');
  const providerSmsContacts=contacts.map(c=>({providerId:c.provider_id,enabled:c.sms_opt_in&&!c.opted_out_at,whatsappEnabled:c.whatsapp_opt_in&&!c.opted_out_at,maskedPhone:'••••'+c.phone_e164.slice(-4)}));
  const [assignments,updates,smsAttempts,providerDrafts,providerAlerts,customerWhatsAppAttempts]=await Promise.all([
   supabasePrivate<Assignment[]>('coordinator_provider_assignments?select=id,case_id,provider_id,state,quoted_amount_kes,notes,assigned_at,responded_at,updated_at&case_id=eq.'+caseId+'&order=assigned_at.desc&limit=100'),
   supabasePrivate<CustomerUpdate[]>('coordinator_customer_updates?select=id,case_id,kind,channel,message,state,prepared_by,sent_by,sent_at,created_at&case_id=eq.'+caseId+'&order=created_at.desc&limit=100'),
   supabasePrivate<SmsAttempt[]>('coordinator_sms_attempts?select=id,customer_update_id,assignment_id,recipient_kind,gateway,state,requested_at,http_status,provider_message_id&case_id=eq.'+caseId+'&order=requested_at.desc&limit=100'),
   supabasePrivate<ProviderDraft[]>('coordinator_provider_sms_drafts?select=id,assignment_id,message,created_at,updated_at&case_id=eq.'+caseId+'&limit=100'),
   supabasePrivate<{id:string;assignment_id:string;channel:string;state:string;last_error:string|null;provider_message_id:string|null;attempted_at:string|null}[]>('jitap_provider_alerts?select=id,assignment_id,channel,state,last_error,provider_message_id,attempted_at&case_id=eq.'+caseId+'&order=requested_at.desc&limit=100'),
   supabasePrivate<{id:string;update_id:string;state:string;last_error:string|null;provider_message_id:string|null;attempted_at:string}[]>('jitap_soc_whatsapp_sends?select=id,update_id,state,last_error,provider_message_id,attempted_at&case_id=eq.'+caseId+'&order=attempted_at.desc&limit=100')
  ]);
  // The customer intake transcript stays in the private ticket; provider alerts use the technical brief.
  const source=await supabasePrivate<{source_kind:string;source_id:string}[]>('coordinator_cases?select=source_kind,source_id&id=eq.'+encodeURIComponent(caseId)+'&limit=1');
  const caseSource=source[0];
  const brief=caseSource?.source_kind==='website_request'
   ?(await supabasePrivate<TechnicalBrief[]>('jitap_request_service_briefs?select=technical_summary,proposed_scope,urgency,source&request_id=eq.'+encodeURIComponent(caseSource.source_id)+'&limit=1').catch(()=>[]))[0]||null
   :null;
  return reply({ok:true,providers,assignments,updates,smsAttempts,providerDrafts,providerSmsContacts,providerAlerts,customerWhatsAppAttempts,providerWhatsAppReady:providerWhatsAppReady(),customerWhatsAppReady:customerSocWhatsAppReady(),technicalBrief:brief,staffRole:staff.role,smsReady:wasilianaSettings().configured&&wasilianaSettings().senderConfigured,smsEnabled:process.env.JITAP_COORDINATOR_SMS_ENABLED==='true'});
 }catch{return reply({error:'Unable to load provider workflow'},503)}
}
export async function POST(req:NextRequest){
 if(!validOrigin(req))return reply({error:'Invalid origin'},403);
 try{
  const staff=await requireCoordinator(req);
  if(!staff)return reply({error:'Sign in required'},401);
  const body=await req.json();
  const parsed=request.safeParse(body);
  if(!parsed.success)return reply({error:'Check the action fields'},400);
  const d=parsed.data;
  if(d.action==='provider_sms_draft'){
   try{
    const result=await supabasePrivate<Record<string,unknown>>('rpc/coordinator_save_provider_sms_draft',{method:'POST',body:JSON.stringify({
     p_case_id:d.caseId,p_actor_email:staff.email,p_assignment_id:d.assignmentId,p_message:d.message
    })});
    return reply(result);
   }catch{return reply({error:'Unable to save provider BUZZ draft. Check case status or whether SMS was already attempted.'},422)}
  }
  const params:{p_case_id:string;p_actor_email:string;p_action:string;p_provider_id?:string;p_assignment_id?:string;p_state?:string;p_quote?:number|null;p_note?:string;p_update_kind?:string;p_channel?:string;p_message?:string;p_update_id?:string}={
   p_case_id:d.caseId,p_actor_email:staff.email,p_action:d.action
  };
  switch(d.action){
   case 'assign_provider':params.p_provider_id=d.providerId;params.p_note=d.note;break;
   case 'provider_response':params.p_assignment_id=d.assignmentId;params.p_state=d.state;params.p_quote=d.quote;params.p_note=d.note;break;
   case 'customer_update_draft':params.p_update_kind=d.kind;params.p_channel=d.channel;params.p_message=d.message;break;
   case 'customer_update_mark_sent':params.p_update_id=d.updateId;break;
  }
  const result=await supabasePrivate<Record<string,unknown>>('rpc/coordinator_workflow_action',{method:'POST',body:JSON.stringify(params)});
  if(d.action==='assign_provider'){
   const assignment=(result as {assignment?:{id?:string}}).assignment;
   // Provider assignment enqueues alerts in Supabase; send immediately where possible.
   // Any crash/timeout leaves an auditable queue for the scheduled dispatcher.
   if(assignment?.id){
    const notifications=await dispatchProviderAlerts(2,assignment.id).catch(()=>({error:'Notifications queued; scheduled dispatcher will process them.'}));
    return reply({...result,notifications});
   }
  }
  if(d.action==='provider_response'&&d.state==='accepted'){
   // SOC acceptance creates a genuine booking notification through the DB event
   // trigger. Attempt prompt dispatch; the protected cron reconciles queued work.
   const cases=await supabasePrivate<{source_kind:string;source_id:string}[]>('coordinator_cases?select=source_kind,source_id&id=eq.'+d.caseId+'&limit=1').catch(()=>[]);
   const source=cases[0];
   if(source?.source_kind==='website_request'){
    const notification=await dispatchKapsoQueue(2,source.source_id).catch(()=>({ready:false,reason:'scheduled_retry'}));
    return reply({...result,bookingWhatsApp:notification});
   }
  }
  return reply(result);
 }catch(e){
  if(e instanceof SyntaxError)return reply({error:'Invalid request'},400);
  return reply({error:'Workflow action could not be saved. Check case eligibility and provider state.'},422);
 }
}
