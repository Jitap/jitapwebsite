'use client';
import {useEffect,useState} from 'react';
import './provider-buzz.css';
import {PrivateRequestPhotos} from '@/components/PrivateRequestPhotos';

type Opportunity={status:string;business?:string;ref?:string;category?:string;description?:string;area?:string;preferredDate?:string;preferredTime?:string;decision?:string;offerExpiresAt?:string};
type Choice='accepted'|'declined'|'needs_clarification';

export default function ProviderBuzzPage(){
 const [token,setToken]=useState('');
 const [opportunity,setOpportunity]=useState<Opportunity|null>(null);
 const [selection,setSelection]=useState<Choice|null>(null);
 const [note,setNote]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [clock,setClock]=useState(Date.now());
 useEffect(()=>{const timer=window.setInterval(()=>setClock(Date.now()),1000);return()=>window.clearInterval(timer)},[]);
 useEffect(()=>{
  const value=window.location.hash.replace(/^#/,'');
  // URL fragments are not sent to the web server; remove immediately
  // to avoid inadvertently sharing the access token.
  if(value)window.history.replaceState(null,'','/buzz');
  if(!/^[A-Za-z0-9_-]{43}$/.test(value)){setOpportunity({status:'invalid'});return}
  setToken(value);
  const controller=new AbortController();
  fetch('/api/provider-buzz',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'preview',token:value}),signal:controller.signal,cache:'no-store'})
   .then(async r=>r.ok?await r.json():{status:'unavailable'})
   .then(data=>setOpportunity(data))
   .catch(()=>{if(!controller.signal.aborted)setOpportunity({status:'unavailable'})});
  return()=>controller.abort();
 },[]);
 async function submit(){
  if(!selection||busy||!opportunity||opportunity.status!=='open'||(opportunity.offerExpiresAt&&Date.parse(opportunity.offerExpiresAt)<=Date.now()))return;
  if(selection==='needs_clarification'&&note.trim().length<3){setError('Please explain what you need clarified.');return}
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/provider-buzz',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'respond',token,decision:selection,note:note.trim()}),cache:'no-store'});
   const result=await r.json();
   if(!r.ok)throw new Error(result.error||'Unable to save your response');
   setOpportunity({status:result.status,decision:result.decision});
  }catch(e){setError(e instanceof Error?e.message:'Unable to save your response')}
  finally{setBusy(false)}
 }
 const remaining=opportunity?.offerExpiresAt?Math.max(0,Math.ceil((Date.parse(opportunity.offerExpiresAt)-clock)/1000)):null;
 const status=opportunity?.status==='open'&&remaining===0?'expired':opportunity?.status;
 return <main className="jt-buzz-page">

  <div className="jt-buzz-panel">
   {!opportunity?<div role="status">Checking your invitation…</div>:
    status==='recorded'||status==='responded'||status==='already_responded'
    ?<div className="jt-buzz-result" role="status"><span className="jt-buzz-symbol">✓</span><h1>Response recorded</h1><p>Your response ({String(opportunity.decision||selection||'received').replaceAll('_',' ')}) is now available to JiTap Service Operations.</p><p>JiTap will coordinate any next steps. No booking is confirmed by this response alone.</p></div>
    :status!=='open'
    ?<div className="jt-buzz-result" role="status"><h1>Invitation unavailable</h1><p>Your individual BUZZ offer may have expired, been handled, or become unavailable. The customer's request remains open for JiTap Service Operations and rematching.</p></div>
    :<>
     <div className="jt-buzz-eyebrow">NEW SERVICE OPPORTUNITY</div>
     {remaining!==null&&<p role="timer" aria-label="Time left to respond" style={{fontWeight:750,color:'#087e46',margin:'9px 0'}}>BUZZ expires in 0:{String(remaining).padStart(2,'0')}secs</p>}
     <h1>Respond to a JiTap BUZZ</h1>
     <p className="jt-buzz-desc">Review the service brief and tell JiTap whether you can take this request.</p>
     <dl className="jt-buzz-facts">
      <dt>Business</dt><dd>{opportunity.business}</dd>
      <dt>Reference</dt><dd>{opportunity.ref}</dd>
      <dt>Service</dt><dd>{opportunity.category||'Local service'}</dd>
      <dt>Request</dt><dd>{opportunity.description||'Service request'}</dd>
      <dt>Location</dt><dd>{opportunity.area||'To be confirmed'}</dd>
      {(opportunity.preferredDate||opportunity.preferredTime)&&<><dt>Preferred time</dt><dd>{[opportunity.preferredDate,opportunity.preferredTime].filter(Boolean).join(' · ')}</dd></>}
     </dl>
     <PrivateRequestPhotos buzzToken={token}/>
     <h2>Your response</h2>
     <div className="jt-buzz-choices" role="group" aria-label="Respond to opportunity">
      <button type="button" className={'jt-buzz-choice-accept'+(selection==='accepted'?' selected':'')} aria-pressed={selection==='accepted'} onClick={()=>setSelection('accepted')}>Accept</button>
      <button type="button" className={'jt-buzz-choice-decline'+(selection==='declined'?' selected':'')} aria-pressed={selection==='declined'} onClick={()=>setSelection('declined')}>Decline</button>
      <button type="button" className={'jt-buzz-choice-question'+(selection==='needs_clarification'?' selected':'')} aria-pressed={selection==='needs_clarification'} onClick={()=>setSelection('needs_clarification')}>Ask a question</button>
     </div>
     {selection==='needs_clarification'&&<label className="jt-buzz-question">What would you like JiTap to clarify?<textarea maxLength={500} rows={4} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. What laptop model is it? Is the customer available tomorrow?"/></label>}
     {error&&<p className="jt-buzz-error" role="alert">{error}</p>}
     <button className="jt-buzz-submit" type="button" disabled={!selection||busy} onClick={submit}>{busy?'Submitting…':'Send response to JiTap'}</button>
     <p className="jt-buzz-hint">This invitation can be opened within 72 hours of issue. Once opened, you have 59 seconds to respond. The customer’s contact number is not shared. Accepting signals interest; JiTap must still confirm the booking.</p>
    </>}
  </div>
 </main>;
}
