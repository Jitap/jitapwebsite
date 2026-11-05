import {NextRequest} from 'next/server';
import {z} from 'zod';
import {reply,requireCoordinator,supabasePrivate,validOrigin} from '@/lib/coordinator-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const schema=z.object({
 providerId:z.string().trim().min(1).max(120),
 phone:z.string().trim().min(10).max(25),
 consentConfirmed:z.literal(true),
 consentSource:z.string().trim().min(5).max(300)
});
export async function POST(req:NextRequest){
 if(!validOrigin(req))return reply({error:'Invalid origin'},403);
 try{
  const staff=await requireCoordinator(req);
  if(!staff)return reply({error:'Sign in required'},401);
  if(staff.role!=='admin')return reply({error:'Administrator permission required'},403);
  const parsed=schema.safeParse(await req.json());
  if(!parsed.success)return reply({error:'Provider phone and a documented consent source are required.'},400);
  const data=parsed.data;
  await supabasePrivate<boolean>('rpc/coordinator_save_provider_sms_contact',{method:'POST',body:JSON.stringify({
   p_actor_email:staff.email,p_provider_id:data.providerId,
   p_phone:data.phone,p_consent_confirmed:true,p_consent_source:data.consentSource
  })});
  return reply({ok:true,message:'Provider contact saved privately with SMS consent.'});
 }catch{return reply({error:'Could not save verified provider SMS contact.'},422)}
}
