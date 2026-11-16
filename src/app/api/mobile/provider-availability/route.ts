import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {nativeVerifiedProvider} from '@/lib/native-provider-session';
import {supabasePrivate} from '@/lib/coordinator-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const bodySchema=z.discriminatedUnion('online',[
 z.object({online:z.literal(true),latitude:z.number().finite().min(-90).max(90),
  longitude:z.number().finite().min(-180).max(180),
  accuracyMeters:z.number().finite().min(0).max(100).optional()}).strict(),
 z.object({online:z.literal(false)}).strict()
]);

export async function POST(req:NextRequest){
 if(Number(req.headers.get('content-length')||0)>1000)return reply({error:'Payload too large'},413);
 const provider=await nativeVerifiedProvider(req).catch(()=>null);
 if(!provider)return reply({error:'Verified provider sign-in required'},401);
 const parsed=bodySchema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return reply({error:'Invalid availability or precise location'},422);
 const body=parsed.data;
 const gpsPath='jitap_wave_provider_locations?provider_user_id=eq.'+provider;
 try{
  if(body.online){
   await supabasePrivate('jitap_wave_provider_locations?on_conflict=provider_user_id',{
    method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify({provider_user_id:provider,latitude:body.latitude,longitude:body.longitude,
     observed_at:new Date().toISOString(),sharing_enabled:true})
   });
  }
  await supabasePrivate('jitap_provider_workspaces?user_id=eq.'+provider,{
   method:'PATCH',headers:{Prefer:'return=minimal'},
   body:JSON.stringify({is_online:body.online})
  });
  if(!body.online)await supabasePrivate(gpsPath,{
   method:'DELETE',headers:{Prefer:'return=minimal'}
  });
  return reply({online:body.online});
 }catch{
  if(body.online)await supabasePrivate(gpsPath,{method:'DELETE',headers:{Prefer:'return=minimal'}}).catch(()=>{});
  return reply({error:'Unable to change provider availability'},503);
 }
}
export async function GET(req:NextRequest){
 const provider=await nativeVerifiedProvider(req).catch(()=>null);
 if(!provider)return reply({error:'Verified provider sign-in required'},401);
 try{
  const rows=await supabasePrivate<{is_online:boolean}[]>(
   'jitap_provider_workspaces?select=is_online&user_id=eq.'+provider+'&limit=1');
  return reply({online:rows[0]?.is_online===true});
 }catch{return reply({error:'Availability temporarily unavailable'},503)}
}
