import {NextRequest} from 'next/server';
import {z} from 'zod';
import {reply,requireCoordinator,supabasePrivate,validOrigin} from '@/lib/coordinator-server';
import {sendWasilianaSms,wasilianaSettings} from '@/lib/wasiliana';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const schema=z.discriminatedUnion('recipientKind',[
 z.object({caseId:z.string().uuid(),recipientKind:z.literal('customer'),updateId:z.string().uuid(),confirm:z.literal(true)}),
 z.object({caseId:z.string().uuid(),recipientKind:z.literal('provider'),assignmentId:z.string().uuid(),confirm:z.literal(true)})
]);
type Claim={attemptId:string;recipient:string;message:string};
export async function GET(req:NextRequest){
 try{
  const staff=await requireCoordinator(req);
  if(!staff)return reply({error:'Sign in required'},401);
  const settings=wasilianaSettings();
  return reply({ok:settings.configured&&settings.senderConfigured,provider:'Wasiliana',
   keyConfigured:settings.configured,senderConfigured:settings.senderConfigured,
   senderId:settings.senderLabel,enabled:process.env.JITAP_COORDINATOR_SMS_ENABLED==='true',
   error:!settings.configured?'Wasiliana API key missing':!settings.senderConfigured?'Set the Wasiliana-approved Sender ID / ShortCode in WASILIANA_SENDER_ID on Vercel.':'',
   balanceKes:null, balanceNote:'Wasiliana balance API has not been verified. Check balance in Wasiliana dashboard.'});
 }catch{return reply({ok:false,error:'Wasiliana settings unavailable'},503)}
}
export async function POST(req:NextRequest){
 if(!validOrigin(req))return reply({error:'Invalid origin'},403);
 let staff;
 try{staff=await requireCoordinator(req)}catch{return reply({error:'Coordinator sign-in service unavailable'},503)}
 if(!staff)return reply({error:'Sign in required'},401);
 if(process.env.JITAP_COORDINATOR_SMS_ENABLED!=='true')return reply({error:'Manual SMS testing is not enabled for this JiTap environment.'},409);
 const settings=wasilianaSettings();
 if(!settings.configured)return reply({error:'Wasiliana API key is not configured.'},503);
 if(!settings.senderConfigured)return reply({error:'Wasiliana Sender ID or ShortCode is not configured. Add WASILIANA_SENDER_ID in Vercel for a sender assigned to your account.'},409);
 let input:z.infer<typeof schema>;
 try{
  const parsed=schema.safeParse(await req.json());
  if(!parsed.success)return reply({error:'Please confirm a valid SMS recipient and saved draft.'},400);
  input=parsed.data;
 }catch{return reply({error:'Invalid request'},400)}
 let claim:Claim;
 try{
  claim=await supabasePrivate<Claim>('rpc/coordinator_claim_sms',{method:'POST',body:JSON.stringify({
   p_case_id:input.caseId,p_actor_email:staff.email,p_recipient_kind:input.recipientKind,
   p_update_id:input.recipientKind==='customer'?input.updateId:null,
   p_assignment_id:input.recipientKind==='provider'?input.assignmentId:null
  })});
 }catch{return reply({error:'SMS blocked: confirm customer notification consent, an opted-in provider, and that this message was not already attempted.'},409)}
 // Record the exact gateway before calling it, preserving SMSLeopard history.
 try{
  await supabasePrivate<null>('coordinator_sms_attempts?id=eq.'+encodeURIComponent(claim.attemptId),{
   method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({gateway:'wasiliana'})
  });
 }catch{return reply({error:'Unable to audit SMS gateway selection; message not sent. Contact JiTap operations before trying again.'},503)}
 let result:{accepted:boolean;httpStatus?:number;providerMessageId?:string;errorCode?:string;providerReason?:string}={accepted:false};
 let state:'submitted'|'rejected'|'unknown'='unknown';
 try{
  result=await sendWasilianaSms(claim.recipient,claim.message);
  state=result.accepted?'submitted':'rejected';
 }catch{
  // A network timeout can occur AFTER upstream acceptance. Never auto-retry.
  state='unknown';
 }
 try{
  await supabasePrivate<boolean>('rpc/coordinator_finish_sms',{method:'POST',body:JSON.stringify({
   p_attempt_id:claim.attemptId,p_actor_email:staff.email,p_state:state,
   p_http_status:result.httpStatus||null,
   p_provider_message_id:result.providerMessageId||null,p_error_code:[result.errorCode,result.providerReason].filter(Boolean).join(': ').slice(0,100)||null
  })});
 }catch{
  return reply({ok:false,attemptId:claim.attemptId,error:'SMS result could not be recorded. Do not retry; ask JiTap operations to reconcile the attempt.'},503);
 }
 if(state!=='submitted'){
  const error=state==='unknown'?'Wasiliana submission status is uncertain. Do not retry this draft until reconciled.':
   'Wasiliana SMS not accepted (HTTP '+(result.httpStatus||'unknown')+'). '+(result.providerReason||'Check the Sender ID, account permissions, and Wasiliana dashboard.');
  return reply({ok:false,attemptId:claim.attemptId,status:state,
   httpStatus:result.httpStatus||null,errorCode:result.errorCode||null,error},502);
 }
 return reply({ok:true,attemptId:claim.attemptId,status:'submitted',message:'Wasiliana accepted the submission. Handset delivery is not yet verified.'});
}
