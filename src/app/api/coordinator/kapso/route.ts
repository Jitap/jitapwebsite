import {NextRequest} from 'next/server';
import {z} from 'zod';
import {requireCoordinator,reply,supabasePrivate,validOrigin} from '@/lib/coordinator-server';
import {kapsoConfiguration} from '@/lib/kapso-server';
import {dispatchKapsoQueue} from '@/lib/kapso-dispatcher';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const uuid=z.string().uuid();
type CaseRow={id:string;source_kind:string;source_id:string};
const kinds=['booking','reminder','cancellation','rematch','reschedule'] as const;
type Lifecycle={id:string;template_kind:string;status:string;due_at:string;submitted_at:string|null;delivered_at:string|null;read_at:string|null;last_error:string|null;event_key:string};
async function getCase(caseId:string){
 const rows=await supabasePrivate<CaseRow[]>('coordinator_cases?select=id,source_kind,source_id&id=eq.'+encodeURIComponent(caseId)+'&limit=1');
 return rows[0]||null;
}
async function eventsFor(requestId:string){
 return supabasePrivate<Lifecycle[]>('jitap_kapso_messages?select=id,template_kind,status,due_at,submitted_at,delivered_at,read_at,last_error,event_key&request_id=eq.'+encodeURIComponent(requestId)+'&order=created_at.desc&limit=80');
}
export async function GET(req:NextRequest){
 const staff=await requireCoordinator(req).catch(()=>null);
 if(!staff)return reply({error:'SOC access required'},401);
 const config=kapsoConfiguration();
 const caseId=new URL(req.url).searchParams.get('caseId');
 if(caseId){
  if(!uuid.safeParse(caseId).success)return reply({error:'Invalid case ID'},400);
  const c=await getCase(caseId);
  if(!c)return reply({error:'Case not found'},404);
  const events=c.source_kind==='website_request'?await eventsFor(c.source_id):[];
  return reply({ok:true,templateKinds:kinds,templateIdentifiersConfigured:config.templates,enabled:config.enabled,
   configured:config.configured,signedWebhookConfigured:config.signedWebhooks,events,
   dueCount:events.filter(e=>e.status==='pending'&&new Date(e.due_at).getTime()<=Date.now()).length,
   note:'Lifecycle WhatsApp templates notify the customer when real booking events occur. Read/Delivered are webhook receipts. Provider BUZZ is separate.'});
 }
 let apiReachable=false;
 let phoneStatus='not_checked';
 if(config.configured){
  try{
   const url='https://api.kapso.ai/meta/whatsapp/v24.0/'+encodeURIComponent(process.env.KAPSO_PHONE_NUMBER_ID!)+'?fields=id';
   const response=await fetch(url,{headers:{'X-API-Key':process.env.KAPSO_API_KEY!,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
   apiReachable=response.ok;
   phoneStatus=response.ok?'connected':'kapso_http_'+response.status;
  }catch{phoneStatus='api_unreachable'}
 }
 return reply({provider:'Kapso',configured:config.configured,enabled:config.enabled,
  signedWebhookConfigured:config.signedWebhooks,apiReachable,phoneStatus,
  templateIdentifiersConfigured:config.templates,webhookUrl:'https://www.jitap.app/api/webhooks/kapso',
  dispatchInterval:'2 minutes (Supabase scheduler)',liveDeliveryReady:config.enabled&&config.configured&&config.signedWebhooks&&Object.values(config.templates).every(Boolean)&&apiReachable,
  note:'All five lifecycle templates have been exercised with signed delivery receipts. Identifier configuration alone does not prove future delivery.'});
}
export async function POST(req:NextRequest){
 if(!validOrigin(req))return reply({error:'Invalid origin'},403);
 const staff=await requireCoordinator(req).catch(()=>null);
 if(!staff)return reply({error:'SOC access required'},401);
 const parsed=z.object({caseId:uuid,action:z.literal('dispatch_due'),confirm:z.literal(true)}).strict().safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return reply({error:'Invalid lifecycle dispatch request'},400);
 const c=await getCase(parsed.data.caseId);
 if(!c||c.source_kind!=='website_request')return reply({error:'Only a verified website service request may be notified'},409);
 const config=kapsoConfiguration();
 if(!config.enabled||!config.configured||!config.signedWebhooks||Object.values(config.templates).some(x=>!x))
  return reply({error:'Kapso approved lifecycle template dispatch is not configured'},503);
 // Scope the claim to this one case. Consent, due time, and attempt count are checked by the database.
 const result=await dispatchKapsoQueue(5,c.source_id).catch(()=>null);
 if(!result)return reply({error:'WhatsApp dispatch unavailable. Reconcile queue status before retrying.'},503);
 return reply({ok:true,result,message:'Processed due, consented lifecycle notifications for this ticket. Gateway acceptance is not delivery confirmation.'});
}
