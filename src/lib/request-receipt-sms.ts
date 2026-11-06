import {sendWasilianaSms} from '@/lib/wasiliana';
import {normalizeKenyanPhone} from '@/lib/jitap-auth';

type SmsReceiptState='submitted'|'failed'|'unknown'|'skipped';
type Options={reference:string;name:string;phone:string;category:string;linkedToAccount:boolean;token:string;url:string;key:string};
const headers=(key:string)=>({apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'});
async function callRpc(url:string,key:string,fn:string,body:Record<string,unknown>):Promise<unknown>{
 const response=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/'+fn,{
  method:'POST',headers:headers(key),body:JSON.stringify(body),
  cache:'no-store',signal:AbortSignal.timeout(8000)
 });
 if(!response.ok)throw new Error('receipt_rpc_http_'+response.status);
 return response.json();
}
function cleanFirstName(name:string){
 const first=name.trim().split(/\s+/)[0]||'';
 // User-supplied names must not inject line breaks or arbitrary SMS content.
 return /^[\p{L}][\p{L}'-]{0,23}$/u.test(first)?first:'there';
}
export function serviceReference(id:string){return 'JT-'+id.slice(0,8).toUpperCase()}
export function requestReceivedMessage(options:Pick<Options,'reference'|'name'|'category'|'linkedToAccount'>){
 const ref=serviceReference(options.reference);
 const category=options.category.toLowerCase().replace(/[^a-z0-9 -]/g,' ').trim().slice(0,35)||'service';
 const name=cleanFirstName(options.name);
 // No passwords, confirmation of a provider assignment, or false status claims.
 const link=options.linkedToAccount?' Track it at https://jitap.app/account#my-requests.':' Keep this ID for follow-up.';
 return `Habari ${name}, JiTap has received your ${category} request. Service ID: ${ref}.${link} We will update you after reviewing it.`;
}
export async function sendRequestReceiptSms(options:Options):Promise<SmsReceiptState>{
 const number=normalizeKenyanPhone(options.phone);
 if(!number)return 'skipped';
 const {reference,token,url,key}=options;
 let claimed=false;
 try{
  const result=await callRpc(url,key,'claim_website_request_receipt_sms',{p_request_id:reference,p_token:token});
  claimed=result===true;
 }catch{
  console.error('JiTap receipt SMS claim unavailable',{reference});
  return 'skipped';
 }
 if(!claimed)return 'skipped'; // Previous retry already owns the delivery; never double-send.
 let state:SmsReceiptState='unknown';
 let httpStatus:number|null=null;
 let providerId:string|null=null;
 let errorCode:string|null=null;
 try{
  const gateway=await sendWasilianaSms(number,requestReceivedMessage(options));
  httpStatus=gateway.httpStatus||null;
  providerId=gateway.providerMessageId||null;
  errorCode=gateway.errorCode||null;
  state=gateway.accepted?'submitted':'failed';
 }catch{
  // The gateway may have accepted an SMS before a transport failure.
  // Do not automatically retry without reconciling the Wasiliana history.
  errorCode='transport_or_gateway_unavailable';
  state='unknown';
 }
 try{
  await callRpc(url,key,'complete_website_request_receipt_sms',{
   p_request_id:reference,p_token:token,p_state:state,
   p_gateway_http_status:httpStatus,p_provider_message_id:providerId,p_error_code:errorCode
  });
 }catch{console.error('JiTap receipt SMS state not recorded',{reference,state})}
 if(state!=='submitted')console.error('JiTap receipt SMS not accepted',{reference,state});
 return state;
}
