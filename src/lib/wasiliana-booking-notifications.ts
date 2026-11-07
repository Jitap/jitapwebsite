import 'server-only';
import {sendWasilianaSms} from '@/lib/wasiliana';
import {normalizeKenyanPhone} from '@/lib/jitap-auth';
import {supabasePrivate} from '@/lib/coordinator-server';

type Intake={id:string;payload:Record<string,unknown>};
type Provider={full_name:string;business_name:string};
type Outbox={id:string};
const safeName=(value:unknown)=>typeof value==='string'?value.replace(/[\r\n]/g,' ').trim().slice(0,65):'';
const origin=()=>{const site=process.env.NEXT_PUBLIC_SITE_URL||'https://www.jitap.app';const url=new URL(site);return url.protocol==='https:'?url.origin:'https://www.jitap.app'};
async function deliver(eventType:string,requestId:string,phone:string,message:string){
 const mobile=normalizeKenyanPhone(phone);
 if(!mobile)return;
 // Unique event key guarantees the provider is never messaged twice for the same event.
 let queued:Outbox[]=[];
 try{
  queued=await supabasePrivate<Outbox[]>('notification_outbox',{
   method:'POST',headers:{Prefer:'return=representation'},
   body:JSON.stringify({reference_id:requestId,event_type:eventType,recipient_role:'customer',
    recipient_phone:mobile,channel:'sms',message_body:message,consent_confirmed:true,status:'processing'})
  });
  if(!queued.length)return;
  const result=await sendWasilianaSms(mobile,message);
  await supabasePrivate('notification_outbox?id=eq.'+queued[0].id,{
   method:'PATCH',body:JSON.stringify({status:result.accepted?'submitted':'failed',
    provider_message_id:result.providerMessageId||null,last_error_code:result.errorCode||null,attempt_count:1,updated_at:new Date().toISOString()})
  });
  await supabasePrivate('notification_delivery_attempts',{
   method:'POST',body:JSON.stringify({notification_id:queued[0].id,channel:'sms',
    status:result.accepted?'submitted':'failed',provider_http_status:result.httpStatus,
    provider_message_id:result.providerMessageId||null,error_code:result.errorCode||null})
  });
 }catch(e){
  if(queued.length){try{await supabasePrivate('notification_outbox?id=eq.'+queued[0].id,{
   method:'PATCH',body:JSON.stringify({status:'failed',attempt_count:1,last_error_code:'wasiliana_transport_error',updated_at:new Date().toISOString()})
  })}catch{}}
  console.warn('JiTap Wasiliana transactional SMS dispatch failed',e instanceof Error?e.name:'unknown');
 }
}
async function requestRecord(requestId:string){
 const rows=await supabasePrivate<Intake[]>('website_intake?id=eq.'+encodeURIComponent(requestId)+'&select=id,payload&limit=1');
 return rows[0]||null;
}
export async function notifyProviderAccepted(requestId:string,providerId:string){
 const [request,providers]=await Promise.all([
  requestRecord(requestId),
  supabasePrivate<Provider[]>('jitap_provider_workspaces?user_id=eq.'+encodeURIComponent(providerId)+'&select=full_name,business_name&limit=1')
 ]);
 if(!request)return;
 const provider=providers[0];
 const name=safeName(provider?.business_name)||safeName(provider?.full_name)||'Your service provider';
 const ref='JT-'+requestId.slice(0,8).toUpperCase();
 const link=origin()+'/track?ref='+encodeURIComponent(ref);
 await deliver('booking_accepted',requestId,String(request.payload.phone||''),
  'JiTap: '+name+' has accepted your request '+ref+'. Your booking is confirmed. View provider details: '+link);
}
export async function notifyProviderCancelled(requestId:string,cancellationId:string){
 const request=await requestRecord(requestId);if(!request)return;
 const ref='JT-'+requestId.slice(0,8).toUpperCase();
 await deliver('provider_cancellation_'+cancellationId,requestId,String(request.payload.phone||''),
  'JiTap: Your provider has cancelled request '+ref+'. Please approve a rematch or decline it here: '+origin()+'/track?ref='+encodeURIComponent(ref));
}
