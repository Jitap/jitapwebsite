import {NextRequest} from 'next/server';
import {requireCoordinator,reply} from '@/lib/coordinator-server';
import {kapsoConfiguration} from '@/lib/kapso-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const staff=await requireCoordinator(req).catch(()=>null);
 if(!staff)return reply({error:'SOC access required'},401);
 const config=kapsoConfiguration();
 let apiReachable=false;
 let phoneStatus='not_checked';
 if(config.configured){
  try{
   const url='https://api.kapso.ai/meta/whatsapp/v24.0/'+encodeURIComponent(process.env.KAPSO_PHONE_NUMBER_ID!)+
    '?fields=display_phone_number,verified_name';
   const response=await fetch(url,{headers:{'X-API-Key':process.env.KAPSO_API_KEY!,
    Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
   apiReachable=response.ok;
   phoneStatus=response.ok?'connected':'kapso_http_'+response.status;
  }catch{phoneStatus='api_unreachable'}
 }
 return reply({provider:'Kapso',configured:config.configured,enabled:config.enabled,
  signedWebhookConfigured:config.signedWebhooks,apiReachable,phoneStatus,
  templateIdentifiersConfigured:config.templates,
  webhookUrl:'https://www.jitap.app/api/webhooks/kapso',
  dispatchInterval:'5 minutes',
  liveDeliveryReady:config.enabled&&config.configured&&config.signedWebhooks&&
   Object.values(config.templates).every(Boolean)&&apiReachable,
  note:'Approved templates and webhook subscription must be checked in Kapso. Identifier configuration alone does not prove approval.'});
}
