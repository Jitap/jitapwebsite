import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {validatePhotoToken} from '@/lib/request-photo-token';
import {supabasePrivate} from '@/lib/coordinator-server';
import {sameOrigin} from '@/lib/jitap-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
const bucket='jitap-request-private';
const allowed=new Set(['image/jpeg','image/png','image/webp']);
function json(data:unknown,status=200){return NextResponse.json(data,{status,headers})}
function validImage(bytes:Buffer,type:string){
 if(type==='image/jpeg')return bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(type==='image/png')return bytes.length>8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(type==='image/webp')return bytes.length>12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 return false;
}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return json({error:'Invalid origin'},403);
 if(Number(req.headers.get('content-length')||0)>6*1024*1024)return json({error:'Maximum photo size is 5 MB'},413);
 const id=req.headers.get('x-jitap-request-id')||'';
 const token=req.headers.get('x-jitap-photo-token')||'';
 if(!/^[a-f0-9-]{36}$/i.test(id)||!validatePhotoToken(id,token))return json({error:'Photo upload authorization expired. Please reopen your request.'},403);
 try{
  const existing=await supabasePrivate<{id:string}[]>('website_intake?id=eq.'+encodeURIComponent(id)+'&kind=eq.request&select=id&limit=1');
  if(!existing.length)return json({error:'Service request not found'},404);
  const photos=await supabasePrivate<{id:string}[]>('jitap_request_photos?request_id=eq.'+encodeURIComponent(id)+'&select=id&limit=4');
  if(photos.length>=4)return json({error:'Maximum four photos per request'},422);
  const form=await req.formData();const file=form.get('file');
  if(!(file instanceof File)||!allowed.has(file.type)||file.size>5*1024*1024||file.size<32)return json({error:'Select a JPG, PNG or WebP photo under 5 MB'},422);
  const bytes=Buffer.from(await file.arrayBuffer());
  if(!validImage(bytes,file.type))return json({error:'Invalid image file'},422);
  const ext=file.type==='image/jpeg'?'jpg':file.type==='image/png'?'png':'webp';
  const path=id+'/'+randomUUID()+'.'+ext;
  const base=process.env.SUPABASE_URL?.replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!base||!key)return json({error:'Photo storage is unavailable'},503);
  const saved=await fetch(base+'/storage/v1/object/'+bucket+'/'+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':file.type,'x-upsert':'false'},body:bytes,cache:'no-store'});
  if(!saved.ok)return json({error:'Could not save photo'},502);
  try{
   await supabasePrivate('jitap_request_photos',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({request_id:id,object_path:path,mime_type:file.type,size_bytes:file.size})});
  }catch{
   await fetch(base+'/storage/v1/object/'+bucket+'/'+path,{method:'DELETE',headers:{apikey:key,Authorization:'Bearer '+key}}).catch(()=>{});
   return json({error:'Could not link photo to request'},502);
  }
  return json({ok:true,path,requestId:id},201);
 }catch{return json({error:'Photo upload failed. Please retry.'},503)}
}
