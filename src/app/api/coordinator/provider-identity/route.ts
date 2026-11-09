import {NextRequest,NextResponse} from 'next/server';
import {requireCoordinator,supabasePrivate} from '@/lib/coordinator-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const responseHeaders={
 'Cache-Control':'private, no-store, no-cache, must-revalidate',
 'Pragma':'no-cache','X-Robots-Tag':'noindex, nofollow',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'
};
function respond(body:unknown,status=200){
 return NextResponse.json(body,{status,headers:responseHeaders});
}
type IdentitySession={
 provider_user_id:string;didit_session_id:string|null;environment:string;status:string;workflow_id:string
};
type Item=Record<string,unknown>;
type DiditDecision={
 session_id?:unknown;status?:unknown;workflow_id?:unknown;vendor_data?:unknown;
 id_verifications?:unknown;liveness_checks?:unknown;face_matches?:unknown
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const first=(value:unknown):Item=>
 Array.isArray(value)&&value.length&&value[0]&&typeof value[0]==='object'&&!Array.isArray(value[0])
 ?value[0] as Item:{};
function field(record:Item,...names:string[]):string|null{
 for(const name of names){
  const value=record[name];
  if(typeof value==='string'&&value.trim()&&value.length<=250)return value.trim();
 }
 return null;
}
function mediaUrl(value:unknown):string|null{
 if(typeof value==='string'&&value.length<4096)return value;
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  const object=value as Item;
  for(const key of ['url','image_url','file_url','media_url']){
   if(typeof object[key]==='string')return mediaUrl(object[key]);
  }
 }
 return null;
}
function trustedMediaUrl(value:unknown):string|null{
 const input=mediaUrl(value);if(!input)return null;
 try{
  const u=new URL(input);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return null;
  const h=u.hostname.toLowerCase();
  const permitted=['didit.me','amazonaws.com','cloudfront.net','storage.googleapis.com',
   'googleapis.com','r2.dev','cloudflarestorage.com'];
  if(!permitted.some(domain=>h===domain||h.endsWith('.'+domain)))return null;
  return u.toString();
 }catch{return null}
}
async function retrieve(session:IdentitySession):Promise<DiditDecision|null>{
 // Production can use an explicitly scoped, read-only sandbox evidence key;
 // verification creation remains disabled in Production.
 const key=session.environment==='sandbox'
  ?process.env.DIDIT_IDENTITY_SANDBOX_READ_KEY||
    (process.env.DIDIT_ENVIRONMENT==='sandbox'?process.env.DIDIT_API_KEY:undefined)
  :process.env.DIDIT_IDENTITY_LIVE_READ_KEY||
    (process.env.DIDIT_ENVIRONMENT==='live'?process.env.DIDIT_API_KEY:undefined);
 if(!key||!session.didit_session_id)return null;
 const result=await fetch('https://verification.didit.me/v3/session/'+
  encodeURIComponent(session.didit_session_id)+'/decision/',{
  method:'GET',headers:{'x-api-key':key,'Accept':'application/json'},
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)
 });
 if(!result.ok)return null;
 const data=await result.json() as DiditDecision;
 // Never allow evidence from a different Didit session/workflow to appear.
 if(data.session_id!==session.didit_session_id||
   (data.workflow_id&&data.workflow_id!==session.workflow_id)||
   data.status!=='Approved')return null;
 return data;
}
export async function GET(req:NextRequest){
 const staff=await requireCoordinator(req).catch(()=>null);
 if(!staff)return respond({error:'Staff authentication required'},401);
 if(staff.role!=='admin')return respond({error:'Administrator access required'},403);
 const userId=req.nextUrl.searchParams.get('userId')||'';
 const media=req.nextUrl.searchParams.get('media');
 if(!uuid.test(userId)||(media!==null&&media!=='selfie'))
  return respond({error:'Invalid identity record'},400);
 try{
  const rows=await supabasePrivate<IdentitySession[]>(
   'jitap_provider_kyc_sessions?provider_user_id=eq.'+encodeURIComponent(userId)+
   '&status=eq.Approved&select=provider_user_id,didit_session_id,environment,status,workflow_id'+
   '&order=created_at.desc&limit=1'
  );
  const session=rows[0];
  if(!session?.didit_session_id||!uuid.test(session.didit_session_id))
   return respond({error:'No approved Didit identity record available'},404);
  const decision=await retrieve(session);
  if(!decision)return respond({
   error:'Identity evidence is not available. Check the Didit read-only API key and Sessions Read permission for '+session.environment+'.'
  },503);
  const doc=first(decision.id_verifications);
  const liv=first(decision.liveness_checks);
  const selfie=trustedMediaUrl(liv.reference_image||liv.selfie_image||liv.selfie);
  const action=media==='selfie'?'view_selfie':'view_identity';
  // Audit every sensitive access. Fail closed if auditing cannot be written.
  await supabasePrivate('jitap_provider_identity_access_audit',{
   method:'POST',body:JSON.stringify({provider_user_id:userId,staff_email:staff.email,action})
  });
  if(media==='selfie'){
   if(!selfie)return respond({error:'Didit did not return an accessible selfie'},404);
   const image=await fetch(selfie,{
    cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)
   });
   if(!image.ok)return respond({error:'Selfie is temporarily unavailable'},502);
   const contentType=image.headers.get('content-type')||'';
   if(!/^image\/(jpeg|png|webp)$/i.test(contentType.split(';')[0].trim()))
    return respond({error:'Unsupported selfie format'},415);
   const length=Number(image.headers.get('content-length')||0);
   if(length>5_000_000)return respond({error:'Selfie exceeds size limit'},413);
   const bytes=await image.arrayBuffer();
   if(bytes.byteLength>5_000_000)return respond({error:'Selfie exceeds size limit'},413);
   return new NextResponse(bytes,{status:200,headers:{
    ...responseHeaders,'Content-Type':contentType,'Content-Disposition':'inline; filename="identity-selfie"'
   }});
  }
  const idNumber=field(doc,'document_number','identification_number','personal_number');
  const dateOfBirth=field(doc,'date_of_birth','birth_date','dob');
  return respond({
   status:'Approved',environment:session.environment,
   documentType:field(doc,'document_type')||'National ID',
   idNumber,dateOfBirth,selfieAvailable:!!selfie,
   notice:session.environment==='sandbox'?'Simulated sandbox identity: not valid for live provider approval.':null
  });
 }catch{
  return respond({error:'Unable to access restricted identity evidence'},503);
 }
}
