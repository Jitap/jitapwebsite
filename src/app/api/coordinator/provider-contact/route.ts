import {NextRequest} from 'next/server';
import {z} from 'zod';
import {reply,requireCoordinator,supabasePrivate,validOrigin} from '@/lib/coordinator-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const schema=z.object({
 providerId:z.string().trim().min(1).max(120),
 phone:z.string().trim().min(10).max(25),
 consentConfirmed:z.literal(true),
 consentSource:z.string().trim().min(5).max(300),
 whatsappConsent:z.boolean().default(false)
});
const whatsappSchema=z.object({
 providerId:z.string().trim().min(1).max(120),
 consentConfirmed:z.literal(true),
 consentSource:z.string().trim().min(5).max(300)
});
export async function POST(req:NextRequest){
 if(!validOrigin(req))return reply({error:'Invalid origin'},403);
 try{
  const staff=await requireCoordinator(req);
  if(!staff)return reply({error:'Sign in required'},401);
  if(staff.role!=='admin')return reply({error:'Administrator permission required'},403);
  const body=await req.json();
  if(body?.action==='enable_whatsapp'){
   const opt=whatsappSchema.safeParse(body);
   if(!opt.success)return reply({error:'Documented WhatsApp consent is required'},400);
   const records=await supabasePrivate<{provider_id:string;opted_out_at:string|null}[]>('provider_notification_contacts?select=provider_id,opted_out_at&provider_id=eq.'+encodeURIComponent(opt.data.providerId)+'&limit=1');
   if(!records.length||records[0].opted_out_at)return reply({error:'No active verified provider contact is available'},409);
   await supabasePrivate('provider_notification_contacts?provider_id=eq.'+encodeURIComponent(opt.data.providerId),{
    method:'PATCH',headers:{Prefer:'return=minimal'},
    body:JSON.stringify({whatsapp_opt_in:true,consent_source:opt.data.consentSource,last_confirmed_at:new Date().toISOString(),recorded_by:staff.email})
   });
   return reply({ok:true,message:'Provider WhatsApp opt-in recorded'});
  }
  const parsed=schema.safeParse(body);
  if(!parsed.success)return reply({error:'Provider phone and a documented consent source are required.'},400);
  const data=parsed.data;
  await supabasePrivate<boolean>('rpc/coordinator_save_provider_sms_contact',{method:'POST',body:JSON.stringify({
   p_actor_email:staff.email,p_provider_id:data.providerId,
   p_phone:data.phone,p_consent_confirmed:true,p_consent_source:data.consentSource
  })});
  // WhatsApp is a distinct, affirmative opt-in from SMS.
  if(data.whatsappConsent){
   await supabasePrivate('provider_notification_contacts?provider_id=eq.'+encodeURIComponent(data.providerId),{
    method:'PATCH',headers:{Prefer:'return=minimal'},
    body:JSON.stringify({whatsapp_opt_in:true})
   });
  }
  return reply({ok:true,message:data.whatsappConsent?'Provider contact saved with documented SMS and WhatsApp consent.':'Provider contact saved with SMS consent; WhatsApp remains off.'});
 }catch{return reply({error:'Could not save verified provider SMS contact.'},422)}
}
