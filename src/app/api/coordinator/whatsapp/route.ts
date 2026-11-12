import {NextRequest} from 'next/server';
import {z} from 'zod';
import {reply,requireCoordinator,supabasePrivate,validOrigin} from '@/lib/coordinator-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const schema=z.discriminatedUnion('recipientKind',[
 z.object({caseId:z.string().uuid(),recipientKind:z.literal('provider'),assignmentId:z.string().uuid()}),
 z.object({caseId:z.string().uuid(),recipientKind:z.literal('customer'),updateId:z.string().uuid()})
]);
type CaseRow={id:string;source_kind:string;source_id:string};
type Assignment={id:string;provider_id:string;state:string};
type Contact={phone_e164:string;whatsapp_opt_in:boolean;opted_out_at:string|null};
type Intake={payload:Record<string,unknown>};
type Update={id:string;channel:string;state:string;message:string};
function phone(value:string){const n=value.replace(/\D/g,'');const normalized=n.startsWith('0')?'254'+n.slice(1):n;return /^254[17]\d{8}$/.test(normalized)?normalized:null}
export async function POST(req:NextRequest){
 if(!validOrigin(req))return reply({error:'Invalid origin'},403);
 const staff=await requireCoordinator(req).catch(()=>null);
 if(!staff)return reply({error:'Coordinator sign-in required'},401);
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return reply({error:'Invalid notification request'},400);
 const d=parsed.data;
 const cases=await supabasePrivate<CaseRow[]>('coordinator_cases?select=id,source_kind,source_id&id=eq.'+encodeURIComponent(d.caseId)+'&limit=1');
 const c=cases[0];if(!c)return reply({error:'Case not found'},404);
 if(d.recipientKind==='provider'){
  const assignments=await supabasePrivate<Assignment[]>('coordinator_provider_assignments?select=id,provider_id,state&id=eq.'+d.assignmentId+'&case_id=eq.'+d.caseId+'&limit=1');
  const assignment=assignments[0];
  if(!assignment||!['proposed','contacted','needs_clarification','quote_requested'].includes(assignment.state))return reply({error:'Provider assignment is not eligible for an alert'},409);
  const contacts=await supabasePrivate<Contact[]>('provider_notification_contacts?select=phone_e164,whatsapp_opt_in,opted_out_at&provider_id=eq.'+encodeURIComponent(assignment.provider_id)+'&limit=1');
  const contact=contacts[0];
  if(!contact?.whatsapp_opt_in||contact.opted_out_at)return reply({error:'Provider WhatsApp consent is not recorded'},409);
  const drafts=await supabasePrivate<{message:string}[]>('coordinator_provider_sms_drafts?select=message&case_id=eq.'+d.caseId+'&assignment_id=eq.'+d.assignmentId+'&limit=1');
  if(!drafts.length)return reply({error:'Save and review the technical provider BUZZ before sending'},409);
  const to=phone(contact.phone_e164);
  if(!to)return reply({error:'Invalid provider WhatsApp contact'},409);
  return reply({ok:true,url:'https://wa.me/'+to+'?text='+encodeURIComponent(drafts[0].message),mode:'manual'});
 }
 if(c.source_kind!=='website_request')return reply({error:'Customer WhatsApp requires a verified service request'},409);
 const intakes=await supabasePrivate<Intake[]>('website_intake?select=payload&id=eq.'+c.source_id+'&limit=1');
 const payload=intakes[0]?.payload;
 if(!payload||payload.whatsappOptIn!==true)return reply({error:'Customer has not opted in to WhatsApp notifications'},409);
 const updates=await supabasePrivate<Update[]>('coordinator_customer_updates?select=id,channel,state,message&id=eq.'+d.updateId+'&case_id=eq.'+d.caseId+'&limit=1');
 const update=updates[0];if(!update||update.channel!=='whatsapp'||update.state!=='draft')return reply({error:'Save a WhatsApp customer update first'},409);
 const to=phone(String(payload.phone||''));
 if(!to)return reply({error:'Customer WhatsApp contact unavailable'},409);
 return reply({ok:true,url:'https://wa.me/'+to+'?text='+encodeURIComponent(update.message),mode:'manual'});
}
