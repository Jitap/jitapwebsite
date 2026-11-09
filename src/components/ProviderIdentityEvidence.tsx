'use client';
import {useEffect,useState} from 'react';
import {LockKeyhole,ShieldCheck,Eye,EyeOff} from 'lucide-react';

type Evidence={
 status:string;environment:string;documentType:string;
 idNumber:string|null;dateOfBirth:string|null;selfieAvailable:boolean;notice:string|null
};
export function ProviderIdentityEvidence({userId,identityEnvironment}:{
 userId:string;identityEnvironment:string|null
}){
 const [open,setOpen]=useState(false);
 const [loading,setLoading]=useState(false);
 const [revealed,setRevealed]=useState(false);
 const [evidence,setEvidence]=useState<Evidence|null>(null);
 const [error,setError]=useState('');
 // Never keep sensitive identity data in memory after closing/unmounting.
 useEffect(()=>()=>{setEvidence(null)},[userId]);
 async function unlock(){
  if(open){setOpen(false);setEvidence(null);setRevealed(false);setError('');return}
  setLoading(true);setError('');
  try{
   const res=await fetch('/api/coordinator/provider-identity?userId='+encodeURIComponent(userId),{
    cache:'no-store',credentials:'same-origin'
   });
   const body=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(body.error||'Unable to retrieve identity details');
   setEvidence(body as Evidence);setOpen(true);setRevealed(false);
  }catch(e){setError(e instanceof Error?e.message:'Identity data unavailable')}
  finally{setLoading(false)}
 }
 const obscured=evidence?.idNumber?evidence.idNumber.replace(/.(?=.{4})/g,'•'):'Unavailable';
 return <section className="jt-soc-identity-lock" aria-label="Restricted provider identity details">
  <div className="jt-soc-identity-lock-heading">
   <div><LockKeyhole size={19} aria-hidden="true"/><strong>Restricted identity details</strong></div>
   <button type="button" onClick={()=>void unlock()} disabled={loading}>
    {loading?'Retrieving…':open?'Lock details':'Unlock'}
   </button>
  </div>
  <p>Private JiTap administration record. ID details and selfie are fetched securely from Didit on access and are not public profile data. Access is audited.</p>
  {!open&&identityEnvironment==='sandbox'&&<small>Sandbox evidence contains simulated identity fields.</small>}
  {error&&<p className="jt-soc-identity-error" role="alert">{error}</p>}
  {open&&evidence&&<div className="jt-soc-identity-private">
   {evidence.notice&&<p className="jt-soc-identity-sandbox">{evidence.notice}</p>}
   <dl>
    <dt>Document type</dt><dd>{evidence.documentType}</dd>
    <dt>National ID number</dt><dd className="jt-soc-secret-line"><span>{revealed?evidence.idNumber||'Unavailable':obscured}</span>
     {evidence.idNumber&&<button type="button" onClick={()=>setRevealed(v=>!v)} aria-label={revealed?'Hide ID number':'Show ID number'}>
      {revealed?<EyeOff size={15}/>:<Eye size={15}/>} {revealed?'Hide':'Show'}</button>}</dd>
    <dt>Date of birth</dt><dd>{evidence.dateOfBirth||'Not supplied by Didit'}</dd>
   </dl>
   <div className="jt-soc-identity-selfie">
    <strong>Verification selfie</strong>
    {evidence.selfieAvailable?
     <img src={'/api/coordinator/provider-identity?userId='+encodeURIComponent(userId)+'&media=selfie'} alt="Restricted Didit liveness verification selfie" loading="lazy" referrerPolicy="no-referrer"/>:
     <p>Didit has not returned a selfie image to JiTap. The read-only API key requires Media Read permission.</p>}
   </div>
  </div>}
 </section>
}
