import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';

export type KapsoKind='booking'|'reminder'|'cancellation'|'rematch'|'reschedule';
export type KapsoMessage={id:string;event_key:string;request_id:string;recipient_phone:string;
 template_kind:KapsoKind;template_parameters:string[];status:string;attempt_count:number;due_at:string;};
const templateKeys:Record<KapsoKind,string>={
 booking:'KAPSO_TEMPLATE_BOOKING',
 reminder:'KAPSO_TEMPLATE_REMINDER',
 cancellation:'KAPSO_TEMPLATE_CANCELLATION',
 rematch:'KAPSO_TEMPLATE_REMATCH',
 reschedule:'KAPSO_TEMPLATE_RESCHEDULE'
};
const allowedBase='https://api.kapso.ai/meta/whatsapp';
export function kapsoConfiguration(){
 const base=process.env.KAPSO_API_BASE_URL?.replace(/\/$/,'')||allowedBase;
 return {enabled:process.env.KAPSO_ENABLED==='true',
  configured:!!process.env.KAPSO_API_KEY&&!!process.env.KAPSO_PHONE_NUMBER_ID&&base===allowedBase,
  signedWebhooks:!!process.env.KAPSO_WEBHOOK_SECRET,
  templates:Object.fromEntries((Object.keys(templateKeys) as KapsoKind[]).map(kind=>[kind,!!process.env[templateKeys[kind]]])) as Record<KapsoKind,boolean>};
}
export async function sendKapsoTemplate(message:KapsoMessage):Promise<{accepted:boolean;messageId?:string;reason?:string}>{
 const settings=kapsoConfiguration();
 if(!settings.enabled||!settings.configured)return {accepted:false,reason:'kapso_not_enabled_or_configured'};
 const name=process.env[templateKeys[message.template_kind]];
 if(!name||!/^[a-z][a-z0-9_]{1,255}$/.test(name))return {accepted:false,reason:'missing_approved_template'};
 if(!/^254[17]\d{8}$/.test(message.recipient_phone))return {accepted:false,reason:'invalid_recipient'};
 const url=allowedBase+'/v24.0/'+encodeURIComponent(process.env.KAPSO_PHONE_NUMBER_ID! )+'/messages';
 // Approved templates use THREE text placeholders in the body and a
 // personalized View Booking URL button, not an untrusted full-URL body field.
 const parameters=message.template_parameters;
 const ticket=String(parameters[1]||'');
 if(!/^JT-[0-9A-F]{8}$/.test(ticket)||parameters.length<3)
  return {accepted:false,reason:'invalid_template_parameters'};
 const body={messaging_product:'whatsapp',recipient_type:'individual',to:message.recipient_phone,
  type:'template',template:{name,language:{code:process.env.KAPSO_TEMPLATE_LANGUAGE||'en_US'},
   components:[
    {type:'body',parameters:parameters.slice(0,3).map(p=>({type:'text',text:String(p).slice(0,300)}))},
    {type:'button',sub_type:'url',index:'0',parameters:[{type:'text',text:ticket}]}
   ]}
 };
 try{
  const result=await fetch(url,{method:'POST',headers:{'X-API-Key':process.env.KAPSO_API_KEY!,
   'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify(body),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
  const data=await result.json().catch(()=>({})) as {messages?:{id?:string}[];error?:{code?:number;message?:string}};
  const id=data.messages?.[0]?.id;
  if(result.ok&&typeof id==='string'&&id.length>=3)return {accepted:true,messageId:id};
  return {accepted:false,reason:data.error?.code?'kapso_'+data.error.code:'kapso_http_'+result.status};
 }catch{return {accepted:false,reason:'kapso_transport_error'}}
}
export function validateKapsoWebhook(raw:string,signature:string|null){
 const secret=process.env.KAPSO_WEBHOOK_SECRET;
 if(!secret||!signature||!/^([a-f0-9]{64})$/i.test(signature))return false;
 const expected=createHmac('sha256',secret).update(raw,'utf8').digest();
 const actual=Buffer.from(signature,'hex');
 return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
