import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {sendWasilianaSms,wasilianaSettings} from '@/lib/wasiliana';
import {supabasePrivate} from '@/lib/coordinator-server';
import {phone254} from '@/lib/provider-alerts';

const referencePattern=/^JT-[0-9A-F]{8}$/;
function signingKey(){
 const secret=process.env.JITAP_TRACKING_INVITE_SECRET||process.env.INTAKE_HASH_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret||secret.length<32)throw Error('tracking_invite_secret_missing');
 return secret;
}
function signature(reference:string,expiry:string){
 return createHmac('sha256',signingKey()).update('jitap:provider-booking-invite:v1:'+reference+':'+expiry).digest('base64url');
}
export function createTrackingInvite(requestId:string){
 const reference='JT-'+requestId.slice(0,8).toUpperCase();
 if(!referencePattern.test(reference))throw Error('invalid_request_reference');
 const expiry=String(Math.floor(Date.now()/1000)+30*86400);
 const invite=expiry+'.'+signature(reference,expiry);
 return {reference,link:'https://www.jitap.app/track?ref='+reference+'&invite='+encodeURIComponent(invite)};
}
export function verifyTrackingInvite(reference:string,invite:string){
 if(!referencePattern.test(reference)||!/^\d{10}\.[a-zA-Z0-9_-]{43}$/.test(invite))return false;
 const [expiry,mac]=invite.split('.');
 if(Number(expiry)<Math.floor(Date.now()/1000)||Number(expiry)>Math.floor(Date.now()/1000)+31*86400)return false;
 const expected=Buffer.from(signature(reference,expiry));
 const actual=Buffer.from(mac);
 return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
type Existing={id:string;state:string};
export async function sendProviderCreatedBookingSms(input:{
 requestId:string;providerUserId:string;customerPhone:string;customerName:string;
 jobTitle:string;count:number;consentConfirmed:boolean
}){
 const phone=phone254(input.customerPhone);
 if(!input.consentConfirmed||!phone)return {status:'skipped' as const};
 const config=wasilianaSettings();
 if(!config.configured||!config.senderConfigured)return {status:'unknown' as const,reason:'sms_gateway_not_configured'};
 const existing=await supabasePrivate<Existing[]>('jitap_provider_booking_sms?select=id,state&request_id=eq.'+input.requestId+'&limit=1');
 if(existing.length)return {status:existing[0].state,reason:'already_attempted'};
 let record:Existing[];
 try{
  record=await supabasePrivate<Existing[]>('jitap_provider_booking_sms',{method:'POST',headers:{Prefer:'return=representation'},
   body:JSON.stringify({request_id:input.requestId,provider_user_id:input.providerUserId,recipient_phone:phone,consent_confirmed:true})});
 }catch{return {status:'unknown' as const,reason:'sms_attempt_already_reserved'}}
 const {reference,link}=createTrackingInvite(input.requestId);
 const title=input.jobTitle.replace(/[\n\r\t]+/g,' ').trim().slice(0,60);
 const first=input.customerName.trim().split(/\s+/)[0]?.replace(/[^\p{L}'-]/gu,'').slice(0,24)||'there';
 const suffix=input.count>1?' ('+input.count+' scheduled visits)':'';
 const text='JiTap: Habari '+first+', your provider has recorded your '+title+' booking'+suffix+'. Ref: '+reference+'. Track your booking: '+link;
 let state:'submitted'|'rejected'|'unknown'='unknown',id:string|null=null,err:string|null=null;
 try{
  const sent=await sendWasilianaSms(phone,text);
  state=sent.accepted?'submitted':'rejected';
  id=sent.providerMessageId||null;err=sent.errorCode||null;
 }catch{err='transport_outcome_uncertain_no_automatic_retry'}
 await supabasePrivate('jitap_provider_booking_sms?id=eq.'+record[0].id,{method:'PATCH',headers:{Prefer:'return=minimal'},
  body:JSON.stringify({state,provider_message_id:id,error_code:err,finished_at:new Date().toISOString()})}).catch(()=>{});
 return {status:state,reason:err||undefined};
}
