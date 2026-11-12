import {NextRequest} from 'next/server';
import {z} from 'zod';
import {reply,requireCoordinator,supabasePrivate,validOrigin} from '@/lib/coordinator-server';
import {followupTemplateReady,type FollowupTemplateKind} from '@/lib/provider-whatsapp-template';
import {dispatchServiceFollowups} from '@/lib/service-followup-dispatcher';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Event={id:string;request_id:string;status:string;template_kind:FollowupTemplateKind;error_code:string|null};
type Case={source_id:string;source_kind:string};
export async function POST(req:NextRequest){
 if(!validOrigin(req))return reply({error:'Invalid request origin'},403);
 const staff=await requireCoordinator(req).catch(()=>null);
 if(!staff)return reply({error:'SOC authentication required'},401);
 const parsed=z.object({caseId:z.string().uuid(),eventId:z.string().uuid(),confirm:z.literal(true)}).strict().safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return reply({error:'Invalid WhatsApp event'},400);
 const d=parsed.data;
 const cases=await supabasePrivate<Case[]>('coordinator_cases?select=source_id,source_kind&id=eq.'+d.caseId+'&limit=1');
 if(cases[0]?.source_kind!=='website_request')return reply({error:'No eligible service request'},409);
 const events=await supabasePrivate<Event[]>('jitap_service_followups?select=id,request_id,status,template_kind,error_code&id=eq.'+d.eventId+'&request_id=eq.'+cases[0].source_id+'&limit=1');
 const e=events[0];
 if(!e)return reply({error:'Notification event not found for this request'},404);
 if(e.status!=='pending'&&!(e.status==='blocked'&&e.error_code?.startsWith('approved_')&&e.error_code.endsWith('_template_not_configured')))
  return reply({error:'Already sent, attempted, expired or not eligible for another send. Check delivery status.'},409);
 if(!followupTemplateReady(e.template_kind))return reply({error:'The approved '+e.template_kind.replaceAll('_',' ')+' WhatsApp template is not configured in Kapso/Meta.'},409);
 const result=await dispatchServiceFollowups(1,d.eventId).catch(()=>null);
 if(!result)return reply({error:'Kapso submission is uncertain; reconcile the gateway before retrying'},503);
 return reply({ok:result.submitted>0,result,message:result.submitted>0?
  'Kapso accepted the selected WhatsApp message. Delivery receipt may follow.':
  'WhatsApp was not confirmed submitted. Review event status before any retry.'},result.submitted>0?200:409);
}
