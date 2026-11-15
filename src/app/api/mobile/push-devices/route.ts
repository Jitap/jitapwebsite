import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {supabasePrivate} from '@/lib/coordinator-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const tokenPattern=/^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]{8,192}\]$/;
const requestSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('register'),deviceId:z.string().uuid(),platform:z.enum(['android','ios']),expoPushToken:z.string().max(220).regex(tokenPattern)}).strict(),
 z.object({action:z.literal('revoke'),deviceId:z.string().uuid()}).strict()
]);
async function nativeProvider(req:NextRequest){
 // Native apps use a Supabase access JWT, never browser cookies or service keys.
 const header=req.headers.get('authorization')||'';
 if(!header.startsWith('Bearer '))return null;
 const jwt=header.slice(7);
 if(jwt.length<30||jwt.length>5000)return null;
 const base=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const anon=process.env.SUPABASE_ANON_KEY;
 if(!base||!anon)return null;
 const response=await fetch(base+'/auth/v1/user',{
  headers:{apikey:anon,Authorization:'Bearer '+jwt},cache:'no-store',signal:AbortSignal.timeout(8000)
 });
 if(!response.ok)return null;
 const user=await response.json() as {id?:string};
 if(!user.id||!z.string().uuid().safeParse(user.id).success)return null;
 const accounts=await supabasePrivate<{account_type:string}[]>(
  'jitap_accounts?select=account_type&user_id=eq.'+user.id+'&limit=1');
 if(accounts[0]?.account_type!=='provider')return null;
 const verified=await supabasePrivate<{status:string}[]>(
  'jitap_provider_reviews?select=status&user_id=eq.'+user.id+'&limit=1');
 if(verified[0]?.status!=='approved')return null;
 return user.id;
}
export async function POST(req:NextRequest){
 if(Number(req.headers.get('content-length')||0)>1500)return reply({error:'Payload too large'},413);
 const userId=await nativeProvider(req).catch(()=>null);
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
