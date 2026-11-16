import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {nativeVerifiedProvider} from '@/lib/native-provider-session';
import {supabasePrivate} from '@/lib/coordinator-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const payload=z.object({
 latitude:z.number().finite().min(-90).max(90),
 longitude:z.number().finite().min(-180).max(180),
 accuracyMeters:z.number().finite().nonnegative().max(10000).optional()
}).strict();
type Workspace={is_online:boolean};
export async function POST(req:NextRequest){
 if(Number(req.headers.get('content-length')||0)>1000)return reply({error:'Payload too large'},413);
 const providerId=await nativeVerifiedProvider(req).catch(()=>null);
 if(!providerId)return reply({error:'Verified provider authentication required'},401);
 const parsed=payload.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return reply({error:'Valid precise GPS coordinates required'},422);
 const {latitude,longitude,accuracyMeters}=parsed.data;
 if(accuracyMeters!==undefined&&accuracyMeters>100)return reply({error:'A more precise GPS fix is required'},422);
 try{
  const rows=await supabasePrivate<Workspace[]>('jitap_provider_workspaces?select=is_online&user_id=eq.'+providerId+'&limit=1');
  if(rows[0]?.is_online!==true)return reply({error:'Provider is Offline. Background updates are disabled.'},409);
  await supabasePrivate('jitap_wave_provider_locations?on_conflict=provider_user_id',{
   method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
   body:JSON.stringify({provider_user_id:providerId,latitude,longitude,
    observed_at:new Date().toISOString(),sharing_enabled:true})
  });
  return reply({ok:true,refreshed:true,expiresInSeconds:900});
 }catch{return reply({error:'Unable to refresh GPS right now'},503)}
}
export async function GET(){return reply({error:'Method not allowed'},405)}
