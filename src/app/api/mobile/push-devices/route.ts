import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {supabasePrivate} from '@/lib/coordinator-server';
import {nativeVerifiedProvider} from '@/lib/native-provider-session';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const tokenPattern=/^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]{8,192}\]$/;
const requestSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('register'),deviceId:z.string().uuid(),platform:z.enum(['android','ios']),expoPushToken:z.string().max(220).regex(tokenPattern)}).strict(),
 z.object({action:z.literal('revoke'),deviceId:z.string().uuid()}).strict()
]);
export async function POST(req:NextRequest){
 if(Number(req.headers.get('content-length')||0)>1500)return reply({error:'Payload too large'},413);
 const userId=await nativeVerifiedProvider(req).catch(()=>null);
 if(!userId)return reply({error:'Verified provider sign-in required'},401);
 const parsed=requestSchema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return reply({error:'Invalid device registration'},422);
 const body=parsed.data;
 try{
  if(body.action==='revoke'){
   await supabasePrivate('jitap_push_devices?provider_user_id=eq.'+userId+'&device_id=eq.'+body.deviceId,{
    method:'DELETE',headers:{Prefer:'return=minimal'}
   });
   return reply({ok:true,revoked:true});
  }
  const devices=await supabasePrivate<{device_id:string}[]>(
   'jitap_push_devices?select=device_id&provider_user_id=eq.'+userId+'&limit=8');
  if(devices.length>=5&&!devices.some(d=>d.device_id===body.deviceId))
   return reply({error:'Too many registered devices. Revoke an old device first.'},409);
  await supabasePrivate('jitap_push_devices?on_conflict=provider_user_id,device_id',{
   method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
   body:JSON.stringify({
    provider_user_id:userId,device_id:body.deviceId,platform:body.platform,
    expo_push_token:body.expoPushToken,enabled:true,last_seen_at:new Date().toISOString()
   })
  });
  return reply({ok:true,registered:true});
 }catch{return reply({error:'Device registration unavailable'},503)}
}
export async function GET(){return reply({error:'Method not allowed'},405)}
