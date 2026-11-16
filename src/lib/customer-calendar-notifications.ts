import 'server-only';
import {supabasePrivate} from '@/lib/coordinator-server';
import {sendWasilianaSms} from '@/lib/wasiliana';
import {normalizeKenyanPhone} from '@/lib/jitap-auth';
import {kapsoConfiguration} from '@/lib/kapso-server';

type Booking={
 id:string;request_id:string;provider_user_id:string|null;customer_user_id:string;
 starts_at:string;ends_at:string;status:string;
};
type Account={user_id:string;phone:string;sms_updates_opt_in:boolean;whatsapp_updates_opt_in:boolean};
type Delivery={id:string};
type Event='invite'|'proposed'|'declined'|'accepted';
const dateLabel=(iso:string)=>new Intl.DateTimeFormat('en-KE',{
 timeZone:'Africa/Nairobi',day:'numeric',month:'short',year:'numeric',
 hour:'2-digit',minute:'2-digit',hour12:false
}).format(new Date(iso))+' EAT';
const ref=(id:string)=>'JT-'+id.slice(0,8).toUpperCase();
const origin='https://jitap.app';
function safePhone(value:string){return normalizeKenyanPhone(value).replace(/^\+/,'')}
async function reserve(bookingId:string,event:Event,role:'provider'|'customer',channel:'sms'|'whatsapp'){
 try{
  const rows=await supabasePrivate<Delivery[]>('jitap_calendar_delivery_attempts',{
   method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({
    booking_id:bookingId,event_type:event,recipient_role:role,channel,status:'reserved'
   })
  });
  return rows[0]?.id||null;
 }catch{return null} // Existing record or unavailable ledger: do not duplicate.
}
async function settle(id:string,status:'submitted'|'failed'|'skipped'|'needs_template',messageId?:string,reason?:string){
 await supabasePrivate('jitap_calendar_delivery_attempts?id=eq.'+id,{
  method:'PATCH',headers:{Prefer:'return=minimal'},
  body:JSON.stringify({status,provider_message_id:messageId||null,
   error_code:reason?.slice(0,90)||null,updated_at:new Date().toISOString()})
 }).catch(()=>{});
}
async function whatsapp(phone:string,booking:Booking,event:Event,role:'provider'|'customer'):Promise<{accepted:boolean;id?:string;reason?:string}>{
 const config=kapsoConfiguration();
 const name=role==='provider'?process.env.KAPSO_TEMPLATE_PROVIDER_CALENDAR:process.env.KAPSO_TEMPLATE_CUSTOMER_CALENDAR;
 if(!config.enabled||!config.configured||!config.signedWebhooks||!name||
  !/^[a-z][a-z0-9_]{1,255}$/.test(name))
  return {accepted:false,reason:'approved_provider_calendar_template_missing'};
 // This is an explicitly approved provider-calendar template with three body
 // variables and a dynamic URL button. Never reuse the customer tracking template.
 // Provider template button: https://jitap.app/provider/calendar?booking={{1}}\n // Customer template button: https://jitap.app/account?tab=calendar&booking={{1}}
 const phoneNumberId=process.env.KAPSO_PHONE_NUMBER_ID;
 const apiKey=process.env.KAPSO_API_KEY;
 if(!phoneNumberId||!apiKey)return {accepted:false,reason:'kapso_credentials_missing'};
 const parameters=[
  ref(booking.request_id),dateLabel(booking.starts_at),
  event==='invite'?'New booking — respond in JiTap':
   event==='proposed'?'New time proposed':event==='declined'?'Booking declined':'Booking confirmed'
 ];
 const body={messaging_product:'whatsapp',recipient_type:'individual',to:phone,
  type:'template',template:{name,language:{code:process.env.KAPSO_TEMPLATE_LANGUAGE||'en_US'},
   components:[
    {type:'body',parameters:parameters.map(text=>({type:'text',text}))},
    {type:'button',sub_type:'url',index:'0',parameters:[{type:'text',text:booking.id}]}
   ]
  }};
 try{
  const response=await fetch('https://api.kapso.ai/meta/whatsapp/v24.0/'+
   encodeURIComponent(phoneNumberId)+'/messages',{
   method:'POST',headers:{'X-API-Key':apiKey,'Content-Type':'application/json'},
   body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(10000)
  });
  const d=await response.json().catch(()=>({})) as {messages?:{id?:string}[]};
  const id=d.messages?.[0]?.id;
  if(response.ok&&id)return {accepted:true,id};
  return {accepted:false,reason:'kapso_http_'+response.status};
 }catch{return {accepted:false,reason:'kapso_delivery_unknown'}}
}
/** Best-effort outbound delivery. The in-app invitation remains authoritative.
 * Transport timeout is NEVER automatically retried (duplicate booking alerts).
 * Provider SMS and WA require separately recorded opt-in.
 */
export async function notifyScheduledBooking(
 bookingId:string,event:Event,role:'provider'|'customer'
){
 const rows=await supabasePrivate<Booking[]>(
  'jitap_customer_calendar_bookings?select=id,request_id,provider_user_id,customer_user_id,starts_at,ends_at,status&id=eq.'+
  encodeURIComponent(bookingId)+'&limit=1');
 const booking=rows[0];
 if(!booking)return {sms:'skipped',whatsapp:'skipped'};
 const recipientId=role==='provider'?booking.provider_user_id:booking.customer_user_id;
 if(!recipientId)return {sms:'skipped',whatsapp:'skipped'};
 const accounts=await supabasePrivate<Account[]>(
  'jitap_accounts?select=user_id,phone,sms_updates_opt_in,whatsapp_updates_opt_in&user_id=eq.'+recipientId+'&limit=1');
 const account=accounts[0],phone=account?.phone?safePhone(account.phone):'';
 if(!/^254[17]\d{8}$/.test(phone))return {sms:'skipped',whatsapp:'skipped'};
 const route=role==='provider'?'/provider/calendar?booking='+encodeURIComponent(booking.id):
  '/account?tab=calendar';
 const message='JiTap '+ref(booking.request_id)+': '+
  (event==='invite'?'New scheduled job invitation for '+dateLabel(booking.starts_at)+'. Please Accept, Decline or propose another time.':
   event==='proposed'?'Provider proposed a new booking time. Please review.':
   event==='accepted'?'Scheduled booking confirmed.':'Scheduled booking declined. Choose another provider.')+
  ' View: '+origin+route;
 let sms='skipped',wa='skipped';
 if(account?.sms_updates_opt_in){
  const ledger=await reserve(booking.id,event,role,'sms');
  if(ledger){
   try{
    const result=await sendWasilianaSms(phone,message);
    sms=result.accepted?'submitted':'failed';
    await settle(ledger,result.accepted?'submitted':'failed',result.providerMessageId,result.errorCode);
   }catch{sms='failed';await settle(ledger,'failed',undefined,'transport_outcome_unknown')}
  }else sms='already_attempted';
 }
 if(account?.whatsapp_updates_opt_in){
  const ledger=await reserve(booking.id,event,role,'whatsapp');
  if(ledger){
   const result=await whatsapp(phone,booking,event,role);
   wa=result.accepted?'submitted':result.reason==='approved_provider_calendar_template_missing'?'needs_template':'failed';
   await settle(ledger,wa==='submitted'?'submitted':wa==='needs_template'?'needs_template':'failed',result.id,result.reason);
  }else wa='already_attempted';
 }
 return {sms,whatsapp:wa};
}
