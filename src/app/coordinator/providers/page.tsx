'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {CheckCircle2,ShieldCheck,UserRound,XCircle} from 'lucide-react';
import './provider-reviews.css';
type BuzzResponse={serviceId:string;provider:string;decision:string;note:string;createdAt:string;caseId:string|null;caseStatus:string;priority:string;technicalSummary:string;briefSource:'ai'|'reported'};
type Provider={user_id:string;full_name:string;business_name:string;categories:string[];service_areas:string[];experience_years:number;skills:string;submitted_at:string;review:string;is_online:boolean;mediaKinds:string[];readyForApproval:boolean;identityStatus:string;identityUpdatedAt:string|null};
export default function CoordinatorProviderReviews(){
 const [providers,setProviders]=useState<Provider[]>([]);
 const [buzzResponses,setBuzzResponses]=useState<BuzzResponse[]>([]);
 const [role,setRole]=useState('');
 const [pendingCount,setPendingCount]=useState(0),[readyCount,setReadyCount]=useState(0);
 const [filter,setFilter]=useState<'all'|'pending'|'approved'|'rejected'>('pending');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState('');
 const [notice,setNotice]=useState('');
 const [followupNotes,setFollowupNotes]=useState<Record<string,string>>({});
 async function reload(){
  const r=await fetch('/api/coordinator/provider-reviews',{cache:'no-store'});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.error||'Unable to load provider reviews');
  setProviders(d.providers||[]);setBuzzResponses(d.buzzResponses||[]);setRole(d.role||'');setPendingCount(d.pendingCount||0);setReadyCount(d.readyCount||0);
 }
 useEffect(()=>{
  reload().catch(e=>setError(e instanceof Error?e.message:'Unable to load')).finally(()=>setLoading(false));
  const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void reload().catch(()=>{})},15000);
  return()=>window.clearInterval(interval);
 },[]);
 async function handleBuzz(r:BuzzResponse,action:'note_added'|'status_changed'){
  if(!r.caseId){setError('This response has no linked coordinator ticket. Open the main SOC queue to investigate.');return}
  const note=followupNotes[r.serviceId]?.trim();
  if(action==='note_added'&&(!note||note.length<2)){setError('Add a follow-up note before recording this action.');return}
  setBusy(r.serviceId);setError('');setNotice('');
  try{
   const result=await fetch('/api/coordinator/cases',{
    method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     id:r.caseId,
     action,
     ...(action==='note_added'?{note}:
      {value:'provider_contacted',note:'BUZZ acceptance received from provider; appointment not confirmed'})
    })
   });
   const data=await result.json().catch(()=>({}));
   if(!result.ok)throw Error(data.error||'Could not update the service ticket');
   setNotice(action==='note_added'?'Follow-up note saved to this service ticket.':'Ticket moved to Provider Contacted. Appointment is not confirmed.');
   setFollowupNotes(p=>({...p,[r.serviceId]:''}));
   await reload();
  }catch(e){setError(e instanceof Error?e.message:'Could not update the ticket')}
  finally{setBusy('')}
 }
 async function review(p:Provider,decision:'approved'|'rejected'){
  if(role!=='admin')return;
   if(!window.confirm(decision==='approved'
    ?'Have you independently verified '+p.full_name+' and their service qualifications? Approve this provider?'
    :'Reject '+p.full_name+'?'))return;
  setBusy(p.user_id);setError('');setNotice('');
  try{
   const res=await fetch('/api/coordinator/provider-reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:p.user_id,decision})});
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(data.error||'Unable to save review');
   setNotice('Review saved. Provider availability will follow the approval status.');
   await reload();
  }catch(e){setError(e instanceof Error?e.message:'Unable to save')}
  finally{setBusy('')}
 }
 return <main className="jt-staff-providers"><div className="jt-staff-providers-inner">
  <Link href="/coordinator">← Service Operations</Link>
  <h1><ShieldCheck size={31}/> Provider verification</h1>
  <p>Review provider applications and Didit identity verification results. Didit handles ID OCR, liveness and face matching; JiTap separately checks professional suitability. Existing uploaded documents remain private.</p>
  {loading?<p role="status">Loading profiles…</p>:<>
   {error&&<div role="alert" className="jt-staff-review-error">{error}</div>}
   {notice&&<div role="status" className="jt-staff-review-success">{notice}</div>}
   <div className="jt-soc-approval-metrics"><div><strong>{pendingCount}</strong><span>Pending applications</span></div><div><strong>{readyCount}</strong><span>Didit identity approved</span></div><div><strong>{providers.length}</strong><span>Total submitted providers</span></div></div>
   <h2>Provider management</h2>
   <div className="jt-soc-review-filters">{(['pending','approved','rejected','all'] as const).map(value=><button key={value} className={filter===value?'selected':''} onClick={()=>setFilter(value)}>{value==='all'?'All providers':value==='pending'?'Pending review':value==='approved'?'Approved':'Rejected'}</button>)}</div>
   {!providers.filter(p=>filter==='all'||p.review===filter).length?<div className="jt-staff-review-card">No providers in this status.</div>:providers.filter(p=>filter==='all'||p.review===filter).map(p=><article className="jt-staff-review-card" key={p.user_id}>
    <div className="jt-staff-review-top"><div><UserRound/><strong>{p.full_name}</strong><small>{p.business_name||'Individual provider'}</small></div><span className="jt-staff-review-status">{p.review}</span></div>
    <dl><dt>Services</dt><dd>{p.categories.join(', ')}</dd><dt>Coverage</dt><dd>{p.service_areas.join(', ')}</dd><dt>Experience</dt><dd>{p.experience_years} years</dd><dt>Skills</dt><dd>{p.skills||'Not specified'}</dd><dt>Submitted</dt><dd>{new Date(p.submitted_at).toLocaleString('en-KE',{timeZone:'Africa/Nairobi'})}</dd></dl>
    <div className="jt-soc-media-gallery">
     {(['profile_photo','business_logo','id_front','id_back'] as const).map(kind=><div key={kind} className="jt-soc-media-tile">
      <strong>{kind==='profile_photo'?'Profile photo':kind==='business_logo'?'Business logo':kind==='id_front'?'National ID — front':'National ID — back'}</strong>
      {p.mediaKinds?.includes(kind)?<a href={'/api/coordinator/provider-media?userId='+encodeURIComponent(p.user_id)+'&kind='+kind} target="_blank" rel="noopener noreferrer" title="Open private image in a new tab">
       <img src={'/api/coordinator/provider-media?userId='+encodeURIComponent(p.user_id)+'&kind='+kind} alt={'Uploaded '+kind.replaceAll('_',' ')}/>
       <span>View secure photo</span>
      </a>:<div className="jt-soc-no-photo">Not uploaded</div>}
     </div>)}
    </div>
    <div className="jt-soc-kyc"><strong>Didit identity check</strong><span className={p.readyForApproval?'jt-soc-kyc-approved':'jt-soc-kyc-pending'}>{p.identityStatus==='not_started'?'Not started':p.identityStatus}</span>
    {p.identityUpdatedAt&&<small>Updated {new Date(p.identityUpdatedAt).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'})}</small>}
    </div>
    {!p.readyForApproval&&p.review!=='approved'&&<p className="jt-soc-verify-warning">A live Didit identity approval is required before new provider approval. Existing uploaded ID photos alone are insufficient.</p>}
    {role==='admin'&&<div className="jt-staff-review-actions"><button disabled={busy===p.user_id||p.review==='approved'||!p.readyForApproval} onClick={()=>review(p,'approved')}><CheckCircle2 size={17}/> Approve</button><button disabled={busy===p.user_id||p.review==='rejected'} onClick={()=>review(p,'rejected')}><XCircle size={17}/> Reject</button></div>}
   </article>)}
   <h2 style={{marginTop:36}}>BUZZ responses to customer requests</h2>
   <p>Provider responses are expressions of interest. The Service Operations team must still coordinate and confirm appointments.</p>
   {!buzzResponses.length?<div className="jt-staff-review-card">No provider BUZZ responses yet.</div>:
    buzzResponses.map((r,i)=><article key={r.serviceId+'-'+i} className="jt-staff-review-card">
     <div className="jt-staff-review-top"><strong>{r.serviceId}</strong><span className="jt-staff-review-status">{r.decision.replaceAll('_',' ')}</span></div>
     <p><strong>Provider:</strong> {r.provider}</p>
     {r.note&&<p><strong>Question:</strong> {r.note}</p>}
     <small>{new Date(r.createdAt).toLocaleString('en-KE',{timeZone:'Africa/Nairobi'})} · Ticket: {r.caseStatus.replaceAll('_',' ')}</small>
     <div className="jt-soc-response-summary"><strong>Service brief</strong><p>{r.technicalSummary}</p><small>{r.briefSource==='ai'?'AI-organized from the customer report':'See the complete customer-reported brief inside the ticket'}</small></div>
     {r.caseId?<div className="jt-soc-response-actions">
      <Link href={'/coordinator?case='+encodeURIComponent(r.caseId)} className="jt-soc-open-ticket">Open SOC ticket · {r.serviceId} →</Link>
      <label htmlFor={'note-'+r.serviceId}>Coordinator follow-up note</label>
      <textarea id={'note-'+r.serviceId} rows={2} maxLength={1500} placeholder={r.decision==='needs_clarification'?'Record what to ask the customer or provider':'Record who was contacted and the next step'}
       value={followupNotes[r.serviceId]||''} onChange={e=>setFollowupNotes(v=>({...v,[r.serviceId]:e.target.value}))}/>
      <div><button type="button" disabled={busy===r.serviceId} onClick={()=>handleBuzz(r,'note_added')}>Save note to ticket</button>
       {r.decision==='accepted'&&r.caseStatus!=='provider_contacted'&&<button type="button" disabled={busy===r.serviceId} onClick={()=>handleBuzz(r,'status_changed')}>Mark Provider Contacted</button>}
      </div>
     </div>:<p className="jt-soc-verify-warning">No coordinator ticket is linked to this Service ID. Please investigate in the SOC queue.</p>}
    </article>)}
  </>}
 </div></main>
}