import {NextRequest} from 'next/server';
import {z} from 'zod';
import {reply,requireCoordinator,supabasePrivate,validOrigin} from '@/lib/coordinator-server';
import {getProviderMedia} from '@/lib/provider-media-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Workspace={user_id:string;full_name:string;business_name:string;categories:string[];service_areas:string[];experience_years:number;skills:string;submitted_at:string|null;is_online:boolean};
type Review={user_id:string;status:string;reviewed_at:string|null};
type Response={request_id:string;provider_user_id:string;decision:string;note:string;created_at:string};
type ProviderMedia={user_id:string;kind:string;uploaded_at:string};
export async function GET(req:NextRequest){
 const staff=await requireCoordinator(req);
 if(!staff)return reply({error:'Staff authentication required'},401);
 try{
  const [profiles,reviews,responses,media]=await Promise.all([
   supabasePrivate<Workspace[]>('jitap_provider_workspaces?submitted_at=not.is.null&select=user_id,full_name,business_name,categories,service_areas,experience_years,skills,submitted_at,is_online&order=submitted_at.desc&limit=80'),
   supabasePrivate<Review[]>('jitap_provider_reviews?select=user_id,status,reviewed_at&limit=300'),
   supabasePrivate<Response[]>('jitap_provider_buzz_responses?select=request_id,provider_user_id,decision,note,created_at&order=created_at.desc&limit=50'),
   supabasePrivate<ProviderMedia[]>('jitap_provider_media?select=user_id,kind,uploaded_at&limit=400')
  ]);
  const map=new Map(reviews.map(r=>[r.user_id,r]));
  const nameMap=new Map(profiles.map(p=>[p.user_id,p.full_name]));
  const providers=profiles.map(p=>{
   const kinds=media.filter(m=>m.user_id===p.user_id).map(m=>m.kind);
   return {...p,review:map.get(p.user_id)?.status||'pending',mediaKinds:kinds,
    readyForApproval:kinds.includes('id_front')&&kinds.includes('id_back')};
  });
  const pendingCount=providers.filter(p=>p.review==='pending').length;
  const readyCount=providers.filter(p=>p.review==='pending'&&p.readyForApproval).length;
  return reply({role:staff.role,pendingCount,readyCount,providers,
   buzzResponses:responses.map(r=>({serviceId:'JT-'+r.request_id.slice(0,8).toUpperCase(),
    provider:nameMap.get(r.provider_user_id)||'JiTap provider',
    decision:r.decision,note:r.note,createdAt:r.created_at}))});
 }catch{return reply({error:'Unable to load provider reviews'},503)}
}
const schema=z.object({
 userId:z.string().uuid(),
 decision:z.enum(['approved','rejected','pending'])
}).strict();
export async function POST(req:NextRequest){
 if(!validOrigin(req))return reply({error:'Invalid origin'},403);
 const staff=await requireCoordinator(req);
 if(!staff)return reply({error:'Staff authentication required'},401);
 if(staff.role!=='admin')return reply({error:'Only JiTap administrators can approve providers.'},403);
 if(Number(req.headers.get('content-length')||0)>1800)return reply({error:'Request too large'},413);
 let value:unknown;try{value=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
 const parsed=schema.safeParse(value);if(!parsed.success)return reply({error:'Invalid review action'},422);
 const {userId,decision}=parsed.data;
 try{
  const [profile]=await supabasePrivate<Workspace[]>('jitap_provider_workspaces?user_id=eq.'+encodeURIComponent(userId)+'&submitted_at=not.is.null&select=user_id,full_name,business_name,categories,service_areas,experience_years,skills,submitted_at,is_online&limit=1');
  if(!profile||!profile.full_name||!profile.categories.length||!profile.service_areas.length)return reply({error:'Provider profile must be submitted and complete'},422);
  if(decision==='approved'){
   const media=await getProviderMedia(userId);
   if(!media.some(m=>m.kind==='id_front')||!media.some(m=>m.kind==='id_back')){
    return reply({error:'Front and back national ID images must be uploaded before approval.'},422);
   }
  }
  const updated=await supabasePrivate<Review[]>('jitap_provider_reviews?user_id=eq.'+encodeURIComponent(userId),{
   method:'PATCH',
   headers:{Prefer:'return=representation'},
   body:JSON.stringify({status:decision,reviewed_at:decision==='pending'?null:new Date().toISOString(),updated_at:new Date().toISOString()})
  });
  if(!updated.length)return reply({error:'Review record not found'},404);
  if(decision!=='approved'){
   await supabasePrivate<Workspace[]>('jitap_provider_workspaces?user_id=eq.'+encodeURIComponent(userId),{
    method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({is_online:false})
   });
  }
  return reply({ok:true,status:decision,provider:userId});
 }catch{return reply({error:'Unable to save provider review'},503)}
}
