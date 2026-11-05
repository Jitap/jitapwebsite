/**
 * SMSLeopard server-only transport. No calls are made until the JiTap outbox
 * worker is explicitly enabled and approved provider/customer contacts exist.
 * Never import this module into client components.
 */

export type DeliveryResult={accepted:boolean;httpStatus:number;providerMessageId?:string;errorCode?:string};
export type WhatsAppTemplate={destination:string;templateId:string;phoneNumberId:string;variables:string[]};

export function smsLeopardConfiguration(){
 const key=process.env.SMSLEOPARD_API_KEY?.trim();
 const secret=process.env.SMSLEOPARD_API_SECRET?.trim();
 const sender=process.env.SMSLEOPARD_SENDER_ID?.trim();
 const phoneNumberId=process.env.SMSLEOPARD_WA_PHONE_NUMBER_ID?.trim();
 return {smsReady:!!(key&&secret&&sender),whatsappReady:!!(key&&secret&&phoneNumberId),sendingEnabled:process.env.JITAP_NOTIFICATIONS_ENABLED==='true'};
}
function credentials(){
 const key=process.env.SMSLEOPARD_API_KEY?.trim();
 const secret=process.env.SMSLEOPARD_API_SECRET?.trim();
 if(!key||!secret)throw new Error('smsleopard_credentials_missing');
 return 'Basic '+Buffer.from(key+':'+secret,'utf8').toString('base64');
}
export function normalizeKenyanMobile(phone:string){
 const digits=phone.replace(/[^0-9]/g,'');
 const local=digits.startsWith('0')?'254'+digits.slice(1):digits;
 if(!/^254[17][0-9]{8}$/.test(local))throw new Error('invalid_kenyan_mobile');
 return local;
}
function safeProviderReason(httpStatus:number,result:Record<string,unknown>):string|undefined{
 const msg=[result.message,result.error_message].filter((v):v is string=>typeof v==='string').join(' ').toLowerCase();
 const recipients=Array.isArray(result.recipients)?result.recipients:[];
 const recipientStatus=recipients.map((v:unknown)=>v&&typeof v==='object'&&'status' in v?String((v as {status:unknown}).status):'').join(' ').toLowerCase();
 const reason=msg+' '+recipientStatus;
 if(/insufficient.*balance|not enough.*credit|low.*balance/.test(reason))return 'insufficient_balance';
 if(/unrecognized sender|sender.*not assigned|invalid sender/.test(reason))return 'sender_id_not_assigned';
 if(/source.*not defined|missing.*source/.test(reason))return 'missing_sender_id';
 if(/no valid recipients|invalid.*phone|invalid.*number|invalid_phone/.test(reason))return 'invalid_recipient';
 if(/message validation failed|invalid.*message|message.*required/.test(reason))return 'invalid_message';
 if(/restricted_send_time/.test(reason))return 'restricted_send_time';
 if(/invalid.*credentials|unauthorized/.test(reason))return 'invalid_credentials';
 if(httpStatus===400)return 'provider_bad_request';
 return undefined;
}
function deliveryResult(httpStatus:number,data:unknown):DeliveryResult{
 const result=(data&&typeof data==='object'?data:{}) as Record<string,unknown>;
 const recipients=Array.isArray(result.recipients)?result.recipients:[];
 const first=recipients[0]&&typeof recipients[0]==='object'?recipients[0] as Record<string,unknown>:{};
 const id=typeof first.id==='string'?first.id:typeof result.id==='string'?result.id:undefined;
 const providerFailed=typeof first.status==='string'&&/^(failed|rejected|error|invalid_phone|restricted_send_time)$/i.test(first.status);
 const code=safeProviderReason(httpStatus,result);
 return {accepted:httpStatus>=200&&httpStatus<300&&result.success!==false&&!providerFailed&&!!id,httpStatus,providerMessageId:id,errorCode:code||(providerFailed?'recipient_rejected':httpStatus>=400?'provider_http_'+httpStatus:undefined)};
}
export async function getJiTapSmsBalance():Promise<{ok:boolean;httpStatus:number;balanceKes?:number;currency?:string;errorCode?:string}>{
 const res=await fetch('https://api.smsleopard.com/v1/balance',{
  method:'GET',headers:{Authorization:credentials(),Accept:'application/json'},
  cache:'no-store',signal:AbortSignal.timeout(8000)
 });
 const raw:unknown=await res.json().catch(()=>null);
 const data=(raw&&typeof raw==='object'?raw:{}) as Record<string,unknown>;
 return {ok:res.ok,httpStatus:res.status,
  balanceKes:typeof data.balance==='number'?data.balance:undefined,
  currency:typeof data.currency==='string'?data.currency:undefined,
  errorCode:res.ok?undefined:safeProviderReason(res.status,data)||'provider_http_'+res.status};
}
async function send(url:string,body:unknown):Promise<DeliveryResult>{
 if(process.env.JITAP_NOTIFICATIONS_ENABLED!=='true')throw new Error('notifications_disabled');
 const response=await fetch(url,{method:'POST',headers:{Authorization:credentials(),'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(10000)});
 const data:unknown=await response.json().catch(()=>null);
 return deliveryResult(response.status,data);
}
export async function sendJiTapSms(destination:string,message:string,mode:'automatic'|'coordinator'='automatic'):Promise<DeliveryResult>{
 const source=(mode==='coordinator'?process.env.JITAP_COORDINATOR_SMS_SENDER_ID:undefined)?.trim()||process.env.SMSLEOPARD_SENDER_ID?.trim();
 if(!source)throw new Error('sms_sender_id_missing');
 if(!message.trim()||message.length>600)throw new Error('invalid_sms_message');
 if(mode==='automatic'&&process.env.JITAP_NOTIFICATIONS_ENABLED!=='true')throw new Error('notifications_disabled');
 if(mode==='coordinator'&&process.env.JITAP_COORDINATOR_SMS_ENABLED!=='true')throw new Error('coordinator_sms_disabled');
 // SMSLeopard's documented canonical request is POST with destination objects.
 // Keep credentials and the customer phone out of URL/query strings and application logs.
 const response=await fetch('https://api.smsleopard.com/v1/sms/send',{
  method:'POST',
  headers:{Authorization:credentials(),'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({source,message,destination:[{number:normalizeKenyanMobile(destination)}]}),
  cache:'no-store',signal:AbortSignal.timeout(10000)
 });
 const data:unknown=await response.json().catch(()=>null);
 return deliveryResult(response.status,data);
}
export async function sendJiTapWhatsApp(template:WhatsAppTemplate):Promise<DeliveryResult>{
 if(!template.templateId||!template.phoneNumberId||!template.variables.every(x=>typeof x==='string'))throw new Error('invalid_whatsapp_template');
 return send('https://whatsapp.smsleopard.com/v1/whatsapp/send',{
  destination:normalizeKenyanMobile(template.destination),
  template_id:template.templateId,
  phone_number_id:template.phoneNumberId,
  component_list:{components:[{component_type:'BODY',fields:template.variables.map((value,index)=>({name:String(index+1),value}))}]}
 });
}
