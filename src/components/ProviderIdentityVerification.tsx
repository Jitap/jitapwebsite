'use client';
import {useCallback,useEffect,useState} from 'react';
import {ShieldCheck,ScanFace,RefreshCw,ExternalLink,CheckCircle2,AlertCircle} from 'lucide-react';
type Status={enabled:boolean;configured:boolean;available?:boolean;setupPending?:boolean;status:string;identityVerified:boolean;
 identityUnderReview:boolean;verificationUrl:string|null;updatedAt:string|null};
const statusCopy:Record<string,string>={
 not_started:'Not started',
 setup_pending:'Verification service unavailable',
 creating:'Preparing verification',
 'Not Started':'Ready to verify',
 'In Progress':'Verification in progress',
 Approved:'Identity verified',
 Declined:'Verification unsuccessful',
 'In Review':'Identity under review',
 Resubmitted:'Additional verification required',
 Expired:'Session expired',
 Abandoned:'Session abandoned',
 'Kyc Expired':'Identity verification expired',
 error:'Verification setup failed'
};
export function ProviderIdentityVerification({onStatusChanged}:{onStatusChanged?:()=>void|Promise<void>}){
 const [data,setData]=useState<Status|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [consent,setConsent]=useState(false);
 const [error,setError]=useState('');
 const load=useCallback(async(refresh=false)=>{
  const res=await fetch('/api/provider/identity'+(refresh?'?refresh=1':''),{cache:'no-store'});
  const result=await res.json();
  if(!res.ok)throw Error(result.error||'Unable to check identity verification');
  setData(result);return result as Status;
 },[]);
 useEffect(()=>{
  let active=true;
  const returned=new URLSearchParams(window.location.search).get('identity_return')==='1';
  load(returned).then(()=>{if(active&&returned)void onStatusChanged?.()})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to check verification')})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[load,onStatusChanged]);
 async function refresh(){
  setBusy(true);setError('');
  try{await load(true);await onStatusChanged?.()}
  catch(e){setError(e instanceof Error?e.message:'Could not refresh verification')}
  finally{setBusy(false)}
 }
 async function start(){
  if(!consent)return;
  setBusy(true);setError('');
  try{
   const res=await fetch('/api/provider/identity',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:true})});
   const result=await res.json();
   if(!res.ok)throw Error(result.error||'Unable to start verification');
   if(typeof result.url==='string'){
    const target=new URL(result.url);
    if(target.protocol!=='https:'||target.hostname!=='verify.didit.me')throw Error('Invalid verification address');
    window.location.assign(target.toString());
    return;
   }
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Could not start verification')}
  finally{setBusy(false)}
 }
 return <section className="jt-didit-box" aria-label="Identity verification with Didit">
  <div className="jt-didit-heading"><ShieldCheck size={25}/><div>
   <strong>Verify your identity securely</strong>
   <p>Powered by Didit · Identity document, selfie liveness and face matching</p>
  </div></div>
  {loading?<p role="status">Checking your verification status…</p>:
   <>
    <div className={'jt-didit-status '+(data?.identityVerified?'is-verified':'')}>
     {data?.identityVerified?<CheckCircle2 size={20}/>:<ScanFace size={20}/>}
     <span>{statusCopy[data?.status||'not_started']||'Verification pending'}</span>
    </div>
    {data?.identityVerified?
     <p>Your identity check passed. JiTap Service Operations reviews your service profile separately before approving provider access.</p>:
     data?.status==='In Review'?
     <p>Didit is reviewing your documents. Your JiTap application remains pending until the identity decision is confirmed.</p>:
     data?.status==='Declined'?
     <p>Your verification was not approved. Contact JiTap Service Operations for a review or instructions on a new attempt.</p>:
     data?.enabled&&data?.configured?
     <>
      <p>JiTap securely captures your Kenyan identity document and selfie through Didit. JiTap securely stores the verification decision and reference.</p>
      <label className="jt-didit-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
       <span>I consent to JiTap processing my identity document and selfie for identity verification. I have read JiTap's <a href="/privacy" target="_blank" rel="noopener noreferrer">privacy information</a>.</span>
      </label>
      <button type="button" className="jt-provider-primary jt-didit-start" disabled={busy||(!data.verificationUrl&&!consent)}
       onClick={()=>{if(data.verificationUrl)window.location.assign(data.verificationUrl);else void start()}}>
       <ExternalLink size={17}/> {data.verificationUrl?'Continue identity check':'Start identity verification'}
      </button>
     </>:
     <div className="jt-didit-unavailable" role="status">
      <AlertCircle size={20}/>
      <div><strong>JiTap's live ID verification is not available yet.</strong>
       <p>The connection to Didit is still being configured by JiTap. This is a setup issue—not a problem with your National ID or application. Your provider profile remains saved, and you do not need to upload ID photos to JiTap.</p>
       <p>Once the secure verification service is activated, you can start your ID check here. Provider approval still requires completing verification.</p>
      </div>
     </div>
    }
    {data?.status!=='Approved'&&<button type="button" className="jt-didit-refresh" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={16}/> {busy?'Checking…':data?.setupPending?'Check if verification is available':'Refresh verification status'}</button>}
   </>}
  {error&&<p role="alert" className="jt-provider-error">{error}</p>}
 </section>;
}
