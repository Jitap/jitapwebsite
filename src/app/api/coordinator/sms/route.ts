import {NextRequest} from 'next/server';
import {z} from 'zod';
import {reply,requireCoordinator,supabasePrivate,validOrigin} from '@/lib/coordinator-server';
import {sendJiTapSms,smsLeopardConfiguration,getJiTapSmsBalance} from '@/lib/smsleopard';

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
  if(!smsLeopardConfiguration().smsReady)return reply({ok:false,error:'SMSLeopard credentials or sender are missing'},503);
  const result=await getJiTapSmsBalance();
  return reply({ok:result.ok,httpStatus:result.httpStatus,balanceKes:result.balanceKes,currency:result.currency,errorCode:result.errorCode,
   senderId:(process.env.JITAP_COORDINATOR_SMS_SENDER_ID||process.env.SMSLEOPARD_SENDER_ID||'').trim(),
   enabled:process.env.JITAP_COORDINATOR_SMS_ENABLED==='true'});
 }catch{return reply({ok:false,error:'SMSLeopard account diagnostics temporarily unavailable'},503)}
}

export async function POST(req:NextRequest){
 if(!validOrigin(req))return reply({error:'Invalid origin'},403);
 let staff;
 try{staff=await requireCoordinator(req)}catch{return reply({error:'Coordinator sign-in service unavailable'},503)}
 if(!staff)return reply({error:'Sign in required'},401);
 if(process.env.JITAP_COORDINATOR_SMS_ENABLED!=='true')return reply({error:'Manual SMS testing is not enabled for this JiTap environment.'},409);
 if(!smsLeopardConfiguration().smsReady)return reply({error:'SMSLeopard SMS credentials are not configured.'},503);
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
 let result:{accepted:boolean;httpStatus?:number;providerMessageId?:string;errorCode?:string;providerReason?:string}={accepted:false};
 let state:'submitted'|'rejected'|'unknown'='unknown';
 try{
  result=await sendJiTapSms(claim.recipient,claim.message,'coordinator');
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
  const error=state==='unknown'
   ?'SMS submission status is uncertain. Do not retry until the provider logs are checked.'
   :result.errorCode==='sender_id_not_assigned'||result.errorCode==='missing_sender_id'
    ?'SMSLeopard rejected the Sender ID. Verify that the shared test sender is available to your account.'
    :result.errorCode==='insufficient_balance'
     ?'SMSLeopard says your account balance is insufficient. Add production SMS credits before retrying.'
    :result.errorCode==='invalid_recipient'
     ?'SMSLeopard rejected the mobile number. Verify the Kenyan recipient number.'
    :result.errorCode==='invalid_message'
     ?'SMSLeopard rejected the message content. Check its length and characters.'
    :result.errorCode==='invalid_credentials'
     ?'SMSLeopard rejected the API credentials. Verify the production key and secret.'
    :result.errorCode==='restricted_send_time'
     ?'SMSLeopard says sending is restricted at this time.'
    :'SMSLeopard returned HTTP '+(result.httpStatus||'unknown')+'. Run the read-only SMS diagnostics to check account balance and credentials.';
  return reply({ok:false,attemptId:claim.attemptId,status:state,httpStatus:result.httpStatus||null,errorCode:result.errorCode||null,providerReason:result.providerReason||null,error},502);
 }
 return reply({ok:true,attemptId:claim.attemptId,status:'submitted',message:'SMSLeopard accepted the submission. Handset delivery is not yet verified.'});
}
