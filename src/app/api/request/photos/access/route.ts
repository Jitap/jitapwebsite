import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {getCustomerIdentity} from '@/lib/customer-session-server';
import {supabasePrivate} from '@/lib/coordinator-server';
import {sameOrigin,ownCustomerRequests} from '@/lib/jitap-auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const buzzToken=/^[A-Za-z0-9_-]{43}$/;
const bucket='jitap-request-private';
type Photo={object_path:string;mime_type:string;ai_observation:string|null};
function response(payload:unknown,status=200){return NextResponse.json(payload,{status,headers})}

async function photosForRequest(requestId:string){
 const rows=await supabasePrivate<Photo[]>('jitap_request_photos?select=object_path,mime_type,ai_observation&request_id=eq.'+encodeURIComponent(requestId)+'&order=created_at.asc&limit=4');
 const base=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!key)throw Error('Storage unavailable');
 const images=await Promise.all(rows.map(async(row,i)=>{
  // Do not accept a path supplied by the caller; only use private metadata from this request.
  if(!row.object_path.startsWith(requestId+'/'))throw Error('Invalid stored photo path');
  const result=await fetch(base+'/storage/v1/object/sign/'+bucket+'/'+row.object_path,{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({expiresIn:120}),cache:'no-store',signal:AbortSignal.timeout(8000)
  });
  if(!result.ok)throw Error('Photo access unavailable');
  const signed=await result.json() as {signedURL?:string};
  if(!signed.signedURL||!signed.signedURL.startsWith('/'))throw Error('Invalid signed photo');
  const signedPath=signed.signedURL.startsWith('/storage/v1/')?signed.signedURL:'/storage/v1'+signed.signedURL;
  return {id:i+1,url:base+signedPath,type:row.mime_type,observation:row.ai_observation||null};
 }));
 return response({images});
}

export async function GET(req:NextRequest){
 const requestId=req.nextUrl.searchParams.get('requestId')||'';
 if(!uuid.test(requestId))return response({error:'Invalid request'},400);
 const customer=await getCustomerIdentity(req);
 if(customer.kind!=='customer')return response({error:'Customer sign-in required'},401);
 const owned=await ownCustomerRequests(customer.identity.accessToken,customer.identity.userId);
 if(!owned.ok||!Array.isArray(owned.data)||!owned.data.some((r:{id?:string})=>r.id===requestId))
  return response({error:'Request not found'},404);
 try{return await photosForRequest(requestId)}
 catch{return response({error:'Photos temporarily unavailable'},503)}
}

export async function POST(req:NextRequest){
 if(!sameOrigin(req))return response({error:'Invalid origin'},403);
 try{
  const {token}=await req.json() as {token?:string};
  if(!token||!buzzToken.test(token))return response({error:'Invalid invitation'},403);
  const hash=createHash('sha256').update(token).digest('hex');
  const links=await supabasePrivate<{case_id:string;expires_at:string;used_at:string|null;opened_at:string|null;assignment_id:string}[]>('provider_response_links?select=case_id,expires_at,used_at,opened_at,assignment_id&token_hash=eq.'+hash+'&limit=1');
  const link=links[0];
  if(!link||link.used_at||Date.parse(link.expires_at)<=Date.now()||!link.opened_at||Date.parse(link.opened_at)+59000<=Date.now())return response({error:'Invitation unavailable'},403);
  const assignment=await supabasePrivate<{id:string;state:string}[]>('coordinator_provider_assignments?select=id,state&id=eq.'+link.assignment_id+'&case_id=eq.'+link.case_id+'&limit=1');
  if(!assignment[0]||!['proposed','contacted','needs_clarification','quote_requested'].includes(assignment[0].state))return response({error:'Invitation unavailable'},403);
  const cases=await supabasePrivate<{source_id:string;source_kind:string;status:string}[]>('coordinator_cases?select=source_id,source_kind,status&id=eq.'+link.case_id+'&limit=1');
  const row=cases[0];
  if(!row||row.source_kind!=='website_request'||['cancelled','closed','completed'].includes(row.status))return response({error:'Invitation unavailable'},403);
  return await photosForRequest(row.source_id);
 }catch{return response({error:'Photos temporarily unavailable'},503)}
}
