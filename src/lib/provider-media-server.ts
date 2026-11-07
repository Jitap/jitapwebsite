import 'server-only';
import {randomUUID} from 'node:crypto';
import {supabasePrivate} from '@/lib/coordinator-server';

export type MediaKind='profile_photo'|'business_logo'|'id_front'|'id_back';
export const MEDIA_KINDS=['profile_photo','business_logo','id_front','id_back'] as const;
const bucket='jitap-provider-private';
type MediaRecord={user_id:string;kind:MediaKind;object_path:string;content_type:string;uploaded_at:string};
function config(){
 const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Private provider storage is unavailable');
 return {url,key};
}
const headers=(key:string)=>({apikey:key,Authorization:'Bearer '+key});
const pathFor=(path:string)=>path.split('/').map(encodeURIComponent).join('/');
export async function getProviderMedia(userId:string){
 return supabasePrivate<MediaRecord[]>('jitap_provider_media?user_id=eq.'+encodeURIComponent(userId)+'&select=user_id,kind,object_path,content_type,uploaded_at');
}
export async function mediaExists(userId:string){
 const rows=await getProviderMedia(userId);
 return {kinds:rows.map(r=>r.kind),hasBothID:rows.some(r=>r.kind==='id_front')&&rows.some(r=>r.kind==='id_back')};
}
export async function readProviderMedia(userId:string,kind:MediaKind):Promise<{body:ArrayBuffer;contentType:string}|null>{
 const rows=await getProviderMedia(userId);
 const found=rows.find(r=>r.kind===kind);
 if(!found)return null;
 const {url,key}=config();
 const r=await fetch(url+'/storage/v1/object/authenticated/'+bucket+'/'+pathFor(found.object_path),{
  headers:headers(key),cache:'no-store',signal:AbortSignal.timeout(9000)
 });
 if(!r.ok)throw new Error('Provider image not available');
 return {body:await r.arrayBuffer(),contentType:found.content_type};
}
export async function uploadProviderMedia(userId:string,kind:MediaKind,file:File,consented=false){
 const isJpeg=file.type==='image/jpeg',isPng=file.type==='image/png';
 if(!isJpeg&&!isPng)throw new Error('Only JPG and PNG photos are accepted.');
 if(file.size<80||file.size>5*1024*1024)throw new Error('Images must be under 5 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const jpeg=isJpeg&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff&&bytes[bytes.length-2]===0xff&&bytes[bytes.length-1]===0xd9;
 const png=isPng&&bytes.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i]);
 if(!jpeg&&!png)throw new Error('The uploaded image is not a valid JPG or PNG.');
 const {url,key}=config();
 const previous=await getProviderMedia(userId);
 const old=previous.find(r=>r.kind===kind)?.object_path;
 const path=userId+'/'+kind+'/'+randomUUID()+(jpeg?'.jpg':'.png');
 const upload=await fetch(url+'/storage/v1/object/'+bucket+'/'+pathFor(path),{
  method:'POST',headers:{...headers(key),'Content-Type':file.type,'Cache-Control':'no-store'},
  body:bytes,cache:'no-store',signal:AbortSignal.timeout(18000)
 });
 if(!upload.ok)throw new Error('Storage could not save this image. Please retry.');
 try{
  const saved=await supabasePrivate<MediaRecord[]>('jitap_provider_media?on_conflict=user_id,kind',{
   method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},
   body:JSON.stringify({user_id:userId,kind,object_path:path,content_type:file.type,uploaded_at:new Date().toISOString(),consented_at:consented?new Date().toISOString():null})
  });
  if(!saved.length)throw new Error('Photo metadata not saved');
 }catch(e){
  await fetch(url+'/storage/v1/object/'+bucket+'/'+pathFor(path),{method:'DELETE',headers:headers(key)}).catch(()=>{});
  throw e;
 }
 if(old)await fetch(url+'/storage/v1/object/'+bucket+'/'+pathFor(old),{
  method:'DELETE',headers:headers(key),cache:'no-store'
 }).catch(()=>{});
 return {uploaded:true,kind};
}
