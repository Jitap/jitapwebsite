import {NextRequest,NextResponse} from 'next/server';
import {getProviderSession} from '@/lib/provider-session-server';
import {sameOrigin} from '@/lib/jitap-auth';
import {supabasePrivate} from '@/lib/coordinator-server';
import {diditConfig,diditRequestSession,diditRetrieveDecision,type KycSession} from '@/lib/didit-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'};
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers});
type Workspace={user_id:string;submitted_at:string|null};
const latest=(userId:string)=>'jitap_provider_kyc_sessions?provider_user_id=eq.'+
 encodeURIComponent(userId)+'&select=id,provider_user_id,didit_session_id,workflow_id,environment,status,verification_url,consented_at,created_at,updated_at,decided_at&order=created_at.desc&limit=1';
async function readLatest(userId:string):Promise<KycSession|null>{
 const rows=await supabasePrivate<KycSession[]>(latest(userId));
 return rows[0]||null;
}
export async function GET(req:NextRequest){
 const session=await getProviderSession(req);
 if(!session)return reply({error:'Provider sign-in required'},401);
 try{
  const cfg=diditConfig();
  let row=await readLatest(session.userId);
  // Return redirects are not proof of verification. Verify via Didit's API.
  if(req.nextUrl.searchParams.get('refresh')==='1'&&cfg.enabled&&cfg.configured&&row?.didit_session_id&&row.workflow_id===cfg.workflow&&row.environment===cfg.environment){
   const status=await diditRetrieveDecision(row.didit_session_id);
   if(status&&status!==row.status){
    await supabasePrivate('rpc/jitap_didit_apply_event',{method:'POST',
     body:JSON.stringify({p_event_id:crypto.randomUUID(),p_session_id:row.didit_session_id,
      p_status:status,p_workflow_id:row.workflow_id,p_environment:row.environment})});
    row=await readLatest(session.userId);
   }
  }
  return reply({enabled:cfg.enabled,configured:cfg.configured,
   status:row?.status||'not_started',identityVerified:row?.status==='Approved',
   identityUnderReview:row?.status==='In Review',updatedAt:row?.updated_at||null,
   verificationUrl:row&&['Not Started','In Progress','Resubmitted'].includes(row.status)?row.verification_url:null
  });
 }catch{return reply({error:'Unable to load identity verification status'},503)}
}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return reply({error:'Invalid origin'},403);
 if(Number(req.headers.get('content-length')||0)>400)return reply({error:'Request too large'},413);
 const session=await getProviderSession(req);
 if(!session)return reply({error:'Provider sign-in required'},401);
 const body=await req.json().catch(()=>null) as {consent?:unknown}|null;
 if(body?.consent!==true)return reply({error:'Please agree to the identity verification and biometric processing notice.'},422);
 const cfg=diditConfig();
 if(!cfg.enabled||!cfg.configured)return reply({error:'Identity verification is being configured. Please check again later.'},503);
 let rowId:string|null=null;
 try{
  const [workspace]=await supabasePrivate<Workspace[]>('jitap_provider_workspaces?user_id=eq.'+
   encodeURIComponent(session.userId)+'&select=user_id,submitted_at&limit=1');
  if(!workspace?.submitted_at)return reply({error:'Submit your JiTap provider profile before starting identity verification.'},409);
  const [review]=await supabasePrivate<{status:string}[]>('jitap_provider_reviews?user_id=eq.'+
   encodeURIComponent(session.userId)+'&select=status&limit=1');
  if(review?.status==='approved')return reply({status:'Approved',alreadyApproved:true});
  const current=await readLatest(session.userId);
  if(current?.status==='Approved'&&current.environment===cfg.environment&&current.workflow_id===cfg.workflow)return reply({status:'Approved',identityVerified:true});
  if(current&&current.workflow_id===cfg.workflow&&current.environment===cfg.environment&&['Not Started','In Progress','Resubmitted'].includes(current.status)&&current.verification_url)
   return reply({status:current.status,url:current.verification_url});
  if(current&&current.workflow_id===cfg.workflow&&current.environment===cfg.environment&&['creating','In Review'].includes(current.status))
   return reply({error:current.status==='In Review'?'Your identity is under review.':'A verification session is being prepared. Refresh shortly.'},409);
  const created=await supabasePrivate<{id:string}[]>('jitap_provider_kyc_sessions',{
   method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({
    provider_user_id:session.userId,workflow_id:cfg.workflow,environment:cfg.environment,
    status:'creating',consented_at:new Date().toISOString()
   })
  });
  rowId=created[0]?.id||null;if(!rowId)throw Error('unable_to_reserve_session');
  const result=await diditRequestSession(rowId);
  const saved=await supabasePrivate<KycSession[]>('jitap_provider_kyc_sessions?id=eq.'+rowId,{
   method:'PATCH',headers:{Prefer:'return=representation'},
   body:JSON.stringify({didit_session_id:result.sessionId,verification_url:result.url,
    status:result.status,updated_at:new Date().toISOString()})
  });
  if(!saved.length)throw Error('unable_to_store_session');
  return reply({status:result.status,url:result.url});
 }catch(e){
  if(rowId)await supabasePrivate('jitap_provider_kyc_sessions?id=eq.'+rowId,{
   method:'PATCH',body:JSON.stringify({status:'error',last_error:'session_creation_failed',updated_at:new Date().toISOString()})
  }).catch(()=>{});
  const reason=e instanceof Error?e.message:'';
  return reply({error:reason.includes('private_db_409')?'A verification is already starting; refresh shortly.':
   'Could not start verification. Please try again.'},reason.includes('private_db_409')?409:503);
 }
}
