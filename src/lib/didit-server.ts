import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';

export const diditStatuses=['Not Started','In Progress','Approved','Declined','In Review',
 'Awaiting User','Resubmitted','Expired','Abandoned','Kyc Expired'] as const;
export type DiditStatus=(typeof diditStatuses)[number];
export function isDiditStatus(value:unknown):value is DiditStatus{
 return typeof value==='string'&&(diditStatuses as readonly string[]).includes(value);
}
export type KycSession={id:string;provider_user_id:string;didit_session_id:string|null;
 workflow_id:string;environment:string;status:string;verification_url:string|null;
 consented_at:string;created_at:string;updated_at:string;decided_at:string|null};
export function diditConfig(){
 const workflow=process.env.DIDIT_WORKFLOW_ID||'';
 const environment=process.env.DIDIT_ENVIRONMENT==='sandbox'?'sandbox':'live';
 return {enabled:process.env.DIDIT_ENABLED==='true',
  configured:!!process.env.DIDIT_API_KEY&&/^[a-f\d-]{36}$/i.test(workflow)&&!!process.env.DIDIT_WEBHOOK_SECRET,
  workflow,environment};
}
function safeDigest(text:string,secret:string){
 return createHmac('sha256',secret).update(text,'utf8').digest('hex');
}
function sameDigest(a:string|null,b:string){
 if(!a||!/^[a-f0-9]{64}$/i.test(a))return false;
 const x=Buffer.from(a.toLowerCase(),'hex'),y=Buffer.from(b,'hex');
 return x.length===y.length&&timingSafeEqual(x,y);
}
function canonical(value:unknown):unknown{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object'){
  const obj=value as Record<string,unknown>;
  return Object.fromEntries(Object.keys(obj).sort().map(k=>[k,canonical(obj[k])]));
 }
 return value;
}
export function diditVerifyWebhook(raw:string,headers:Headers):boolean{
 const secret=process.env.DIDIT_WEBHOOK_SECRET;
 const timestamp=headers.get('x-timestamp');
 if(!secret||!timestamp||!/^\d{10}$/.test(timestamp)
 ||Math.abs(Date.now()/1000-Number(timestamp))>300)return false;
 // A valid v2 signature covers the *entire* decision payload; no reliance on
 // the envelope-only X-Signature-Simple.
 const signatureV2=headers.get('x-signature-v2');
 if(signatureV2){
  try{if(sameDigest(signatureV2,safeDigest(JSON.stringify(canonical(JSON.parse(raw))),secret)))return true}
  catch{return false}
 }
 return sameDigest(headers.get('x-signature'),safeDigest(raw,secret));
}
export async function diditRequestSession(sessionReference:string):Promise<{
 sessionId:string;url:string;status:string
}>{
 const cfg=diditConfig();
 if(!cfg.enabled||!cfg.configured)throw Error('Didit is not configured');
 const callbackBase=cfg.environment==='sandbox'?process.env.DIDIT_CALLBACK_BASE_URL:'https://www.jitap.app';
 if(!callbackBase)throw Error('didit_sandbox_callback_not_configured');
 const parsedCallback=new URL(callbackBase);
 if(parsedCallback.protocol!=='https:'||parsedCallback.hostname==='www.jitap.app'&&cfg.environment==='sandbox')
  throw Error('didit_invalid_sandbox_callback');
 const callback=new URL('/provider?identity_return=1',parsedCallback.origin).toString();
 const scenario=process.env.DIDIT_SANDBOX_SCENARIO||'approve';
 if(cfg.environment==='sandbox'&&!['approve','decline_document_expired','review_aml_possible_match'].includes(scenario))
  throw Error('didit_invalid_sandbox_scenario');
 const result=await fetch('https://verification.didit.me/v3/session/',{
  method:'POST',headers:{'Content-Type':'application/json','x-api-key':process.env.DIDIT_API_KEY!},
  body:JSON.stringify({workflow_id:cfg.workflow,vendor_data:sessionReference,
   callback,callback_method:'completer',language:'en',
   ...(cfg.environment==='sandbox'?{sandbox_scenario:scenario}:{}),
   metadata:{source:'jitap_provider_onboarding'}}),
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(14000)
 });
 if(!result.ok)throw Error('didit_session_http_'+result.status);
 const data=await result.json() as {session_id?:string;url?:string;status?:string;workflow_id?:string};
 if(!data.session_id||!data.url||(data.workflow_id&&data.workflow_id!==cfg.workflow))throw Error('didit_invalid_session');
 const url=new URL(data.url);
 if(url.protocol!=='https:'||url.hostname!=='verify.didit.me')throw Error('didit_invalid_session_url');
 return {sessionId:data.session_id,url:url.toString(),status:isDiditStatus(data.status)?data.status:'Not Started'};
}
export async function diditRetrieveDecision(sessionId:string):Promise<DiditStatus|null>{
 if(!/^[a-f\d-]{36}$/i.test(sessionId)||!process.env.DIDIT_API_KEY)return null;
 const result=await fetch('https://verification.didit.me/v3/session/'+encodeURIComponent(sessionId)+'/decision/',{
  method:'GET',headers:{'x-api-key':process.env.DIDIT_API_KEY,'Accept':'application/json'},
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(9000)
 });
 if(!result.ok)return null;
 const data=await result.json() as {status?:unknown};
 return isDiditStatus(data.status)?data.status:null;
}
