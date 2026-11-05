/**
 * Wasiliana SMS gateway. Server-side only; account-specific sender must be
 * confirmed before live dispatch is enabled.
 * API: POST https://api.wasiliana.com/api/v1/send/sms, header apiKey.
 */
import type {DeliveryResult} from './smsleopard';
import {normalizeKenyanMobile} from './smsleopard';

export function wasilianaSettings(){
 const key=process.env.WASILIANA_API_KEY?.trim();
 const sender=process.env.WASILIANA_SENDER_ID?.trim();
 return {configured:!!key,senderConfigured:!!sender,senderLabel:sender||'Not configured'};
}
function safeReason(data:Record<string,unknown>):string|undefined {
 const raw=[data.error,data.message].find(x=>typeof x==='string');
 if(typeof raw!=='string')return undefined;
 return raw.replace(/https?:\/\/\S+/gi,'[url]')
  .replace(/[\w.+-]+@[\w.-]+/g,'[email]')
  .replace(/(?:\+?\d[\d\s-]{4,}\d)/g,'[phone]')
  .replace(/[^a-zA-Z\s.,:;!()_\-]/g,'').replace(/\s+/g,' ').trim().slice(0,75)||undefined;
}
export async function sendWasilianaSms(destination:string,message:string):Promise<DeliveryResult>{
 const key=process.env.WASILIANA_API_KEY?.trim();
 const sender=process.env.WASILIANA_SENDER_ID?.trim();
 if(!key)throw new Error('wasiliana_api_key_missing');
 // Wasiliana uses the account-provisioned Sender ID or ShortCode in "from".
 // Do not guess or borrow SMSLeopard's unrelated sender ID.
 if(!sender)throw new Error('wasiliana_sender_id_not_configured');
 if(!message.trim()||message.length>600)throw new Error('invalid_sms_message');
 const body={recipients:[normalizeKenyanMobile(destination)],message,from:sender,is_otp:false};
 const response=await fetch('https://api.wasiliana.com/api/v1/send/sms',{
  method:'POST',
  headers:{apiKey:key,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(10000)
 });
 const raw:unknown=await response.json().catch(()=>null);
 const data=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>;
 const successFlag=data.status==='success'||data.success===true;
 const failedFlag=data.status==='error'||data.status==='failed'||data.success===false||Boolean(data.error);
 const id=[data.message_id,data.messageId,data.correlator,data.id].find(v=>typeof v==='string'&&v.length>0);
 // Do not infer successful dispatch from HTTP 200 alone. Wasiliana responses
 // need a success indicator or upstream reference to be auditable.
 const accepted=response.ok&&!failedFlag&&(successFlag||typeof id==='string');
 return {accepted,httpStatus:response.status,
  providerMessageId:typeof id==='string'?id:undefined,
  errorCode:accepted?undefined:!response.ok?'wasiliana_http_'+response.status:'wasiliana_unconfirmed_response',
  providerReason:accepted?undefined:safeReason(data)};
}
