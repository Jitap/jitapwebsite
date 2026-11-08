import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {sendWasilianaSms,wasilianaSettings} from '@/lib/wasiliana';
import {normalizeKenyanPhone} from '@/lib/jitap-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const responseHeaders={'Cache-Control':'no-store'};
type QueueItem={
 id:string;event_type:string;reference_id:string|null;recipient_role:string;
 recipient_phone:string;channel:'sms'|'whatsapp';message_body:string|null;
 template_id:string|null;template_variables:unknown;expires_at:string|null;
 consent_confirmed:boolean;status:string
};
const respond=(body:Record<string,unknown>,status=200)=>NextResponse.json(body,{status,headers:responseHeaders});
function authorized(req:NextRequest){
 const configured=process.env.CRON_SECRET;
 const header=req.headers.get('authorization')||'';
 if(!configured||!header.startsWith('Bearer '))return false;
 const expected=Buffer.from(configured,'utf8'),provided=Buffer.from(header.slice(7),'utf8');
 return expected.length===provided.length&&timingSafeEqual(expected,provided);
}
async function rest(path:string,method:string,body?:unknown){
 const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('private_database_not_configured');
 const result=await fetch(url+'/rest/v1/'+path,{
  method,
  headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...(path.startsWith('rpc/')?{}:{Prefer:'return=minimal'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),
  cache:'no-store',signal:AbortSignal.timeout(12000)
 });
 if(!result.ok)throw new Error('private_database_http_'+result.status);
 if(method==='POST'&&path.startsWith('rpc/'))return result.json();
 return null;
}
export async function POST(req:NextRequest){
 if(!authorized(req))return respond({error:'Unauthorized'},401);
 if(process.env.JITAP_NOTIFICATIONS_ENABLED!=='true')return respond({ok:false,error:'Dispatch is disabled'},409);
 const cfg=wasilianaSettings();
 if(!cfg.configured||!cfg.senderConfigured)return respond({error:'Wasiliana SMS unavailable'},503);
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return respond({error:'Private queue access not configured'},503);
 let rows:QueueItem[];
 try{
  const body=await rest('rpc/claim_jitap_notifications','POST',{p_batch_size:5});
  if(!Array.isArray(body))throw new Error('unexpected_queue_response');
  rows=body;
 }catch{
  return respond({ok:false,error:'Could not read notification queue'},503);
 }
 const counts={claimed:rows.length,submitted:0,failed:0,expired:0};
 for(const job of rows){
  let status:'submitted'|'failed'|'cancelled'='failed';
  let providerMessageId:string|undefined;
  let httpStatus:number|undefined;
  let errorCode='dispatch_failed';
  try{
   if(!job.consent_confirmed)throw new Error('consent_missing');
   if(job.expires_at&&new Date(job.expires_at).getTime()<=Date.now()){
    status='cancelled';errorCode='expired';counts.expired++;
   }else if(job.channel==='whatsapp'){
    // The legacy SMSLeopard WhatsApp queue is retired. New consent-verified
    // WhatsApp events are dispatched solely through jitap_kapso_messages.
    status='cancelled';errorCode='migrated_to_kapso';counts.expired++;
   }else{
    const destination=normalizeKenyanPhone(job.recipient_phone);
    if(!destination)throw Error('invalid_kenyan_mobile');
    if(!job.message_body)throw Error('invalid_sms_message');
    const result=await sendWasilianaSms(destination.replace(/^\+/,'') ,job.message_body);
    status=result.accepted?'submitted':'failed';
    providerMessageId=result.providerMessageId;
    httpStatus=result.httpStatus;
    errorCode=result.errorCode||'';
    if(status==='submitted')counts.submitted++;else counts.failed++;

   }
  }catch(e){
   errorCode=e instanceof Error&&/^(notifications_disabled|invalid_kenyan_mobile|wasiliana_sender_missing|invalid_sms_message|invalid_whatsapp_template)$/.test(e.message)?e.message:'transport_error';
   counts.failed++;
  }
  // No automatic requeue after a transport timeout: the provider may have accepted a message
  // but the API response may have been lost. Operators can reconcile the status before retrying.
  try{
   await rest('notification_outbox?id=eq.'+encodeURIComponent(job.id)+'&status=eq.processing','PATCH',{
    status,provider_message_id:providerMessageId||null,last_error_code:errorCode||null,updated_at:new Date().toISOString()
   });
   if(status!=='cancelled')await rest('notification_delivery_attempts','POST',{
    notification_id:job.id,channel:job.channel,status:status==='submitted'?'submitted':'failed',
    provider_message_id:providerMessageId||null,provider_http_status:httpStatus||null,error_code:errorCode||null
   });
  }catch{
   // Retain 'processing' for reconciliation. Never automatically resend ambiguous attempts.
  }
 }
 return respond({ok:true,...counts});
}
export async function GET(){return respond({error:'Method not allowed'},405)}
