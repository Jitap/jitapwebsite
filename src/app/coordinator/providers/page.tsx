'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {CheckCircle2,ShieldCheck,UserRound,XCircle} from 'lucide-react';
import './provider-reviews.css';
type BuzzResponse={serviceId:string;provider:string;decision:string;note:string;createdAt:string};
type Provider={user_id:string;full_name:string;business_name:string;categories:string[];service_areas:string[];experience_years:number;skills:string;submitted_at:string;review:string;is_online:boolean;mediaKinds:string[];readyForApproval:boolean};
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
  <p>Review incoming provider applications, inspect the front and back of each Kenyan national ID, confirm qualifications and approve verified providers. ID images are private and only visible to authorized JiTap staff.</p>
  {loading?<p role="status">Loading profiles…</p>:<>
   {error&&<div role="alert" className="jt-staff-review-error">{error}</div>}
   {notice&&<div role="status" className="jt-staff-review-success">{notice}</div>}
   <div className="jt-soc-approval-metrics"><div><strong>{pendingCount}</strong><span>Pending applications</span></div><div><strong>{readyCount}</strong><span>Ready for ID review</span></div><div><strong>{providers.length}</strong><span>Total submitted providers</span></div></div>
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
    {!p.readyForApproval&&<p className="jt-soc-verify-warning">Awaiting both national ID images before approval can be granted.</p>}
    {role==='admin'&&<div className="jt-staff-review-actions"><button disabled={busy===p.user_id||p.review==='approved'||!p.readyForApproval} onClick={()=>review(p,'approved')}><CheckCircle2 size={17}/> Approve</button><button disabled={busy===p.user_id||p.review==='rejected'} onClick={()=>review(p,'rejected')}><XCircle size={17}/> Reject</button></div>}
   </article>)}
   <h2 style={{marginTop:36}}>BUZZ responses to customer requests</h2>
   <p>Provider responses are expressions of interest. The Service Operations team must still coordinate and confirm appointments.</p>
   {!buzzResponses.length?<div className="jt-staff-review-card">No provider BUZZ responses yet.</div>:
    buzzResponses.map((r,i)=><article key={r.serviceId+'-'+i} className="jt-staff-review-card">
     <div className="jt-staff-review-top"><strong>{r.serviceId}</strong><span className="jt-staff-review-status">{r.decision.replaceAll('_',' ')}</span></div>
     <p><strong>Provider:</strong> {r.provider}</p>
     {r.note&&<p><strong>Question:</strong> {r.note}</p>}
     <small>{new Date(r.createdAt).toLocaleString('en-KE',{timeZone:'Africa/Nairobi'})}</small>
    </article>)}
  </>}
 </div></main>
}