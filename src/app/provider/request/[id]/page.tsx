'use client';
import {useEffect,useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,Clock3,MapPin,ShieldCheck,Wrench} from 'lucide-react';
import {SERVICE_OPTIONS} from '@/lib/provider-options';
import '../request-detail.css';

type Opportunity={request_id:string;category:string;area:string;preferred_date:string;preferred_time:string;technical_summary:string;proposed_scope:string;urgency:string;brief_source:string;requested_timing:string;job_location:string};
type Workspace={opportunities:Opportunity[];recentResponses:{request_id:string;decision:string}[]};
export default function ProviderRequestView(){
 const router=useRouter(),params=useParams<{id:string}>();
 const [opportunity,setOpportunity]=useState<Opportunity|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState('');
 useEffect(()=>{let active=true;
  async function load(){
   try{const response=await fetch('/api/provider/workspace',{cache:'no-store'});if(response.status===401){router.replace('/login?mode=login');return}if(!response.ok)throw Error('Could not load this request');
    const data:Workspace=await response.json();if(active)setOpportunity((data.opportunities||[]).find(o=>o.request_id===params.id)||null);
   }catch(e){if(active)setError(e instanceof Error?e.message:'Unable to load request')}
   finally{if(active)setLoading(false)}
  }
  void load();return()=>{active=false}
 },[params.id,router]);
 async function respond(decision:'accepted'|'declined'|'needs_clarification'){
  if(decision==='needs_clarification'&&note.trim().length<3){setError('Write your question before sending.');return}
  setError('');setBusy(true);
  try{const response=await fetch('/api/provider/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'respond',requestId:params.id,decision,note:decision==='needs_clarification'?note.trim():''})});
   const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Unable to send response');
   if(data.recorded!==true)throw Error('The request is no longer available.');
   setDone('Your response was recorded. JiTap Service Operations will coordinate the next step; this is not a confirmed booking.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to send response')}
  finally{setBusy(false)}
 }
 const title=opportunity?SERVICE_OPTIONS.find(c=>c.value===opportunity.category)?.label||opportunity.category:'Service request';
 return <main className="jt-request-detail-page">
  <header className="jt-request-detail-header"><Link href="/provider?view=requests" aria-label="Back to requests"><ArrowLeft size={23}/></Link><h1>Service Request</h1><span/></header>
  {loading?<div className="jt-provider-loading" role="status" aria-label="Loading service request"><span/><span/><span/><span className="jt-provider-loading-label">Loading request…</span></div>:
   error&&!opportunity?<div className="jt-provider-error" role="alert">{error}</div>:
   !opportunity?<div className="jt-request-detail-empty"><p>This request is no longer available or no longer matches your provider account.</p><Link href="/provider?view=requests">Back to Live Requests</Link></div>:
   <article className="jt-request-detail-content">
    <div className="jt-request-detail-category"><Wrench size={17}/>{title}</div>
    <h2>{title}</h2><p className="jt-request-detail-reference">Service ID: JT-{opportunity.request_id.slice(0,8).toUpperCase()}</p>
    <div className="jt-request-detail-schedule"><div><MapPin size={19}/><span><strong>Job location</strong>{opportunity.job_location||opportunity.area}{opportunity.job_location?'':' · Exact directions shared after confirmation'}</span></div>
     <div><Clock3 size={19}/><span><strong>Requested date</strong>{opportunity.preferred_date||(opportunity.requested_timing==='today'?'Requested urgently (date to confirm)':opportunity.requested_timing==='this-week'?'This week (date to confirm)':'To be agreed')}</span></div>
     <div><Clock3 size={19}/><span><strong>Requested time</strong>{opportunity.preferred_time||'To be agreed'}</span></div>
    </div>
    <section className="jt-request-detail-brief"><h3>Service brief</h3><p>{opportunity.technical_summary||'Customer requested a service assessment.'}</p>
     {opportunity.proposed_scope&&<><h4>Proposed scope</h4><p>{opportunity.proposed_scope}</p></>}
     <small>{opportunity.brief_source==='ai'?'AI-organized from the customer’s description. Fault not independently diagnosed.':'Customer-reported issue. Technical assessment pending.'}</small>
    </section>
    <div className="jt-request-detail-note"><ShieldCheck size={19}/> Customer contact details remain private until JiTap coordinates next steps.</div>
    {error&&<p className="jt-provider-error" role="alert">{error}</p>}
    {done?<p className="jt-provider-success" role="status">{done}</p>:<>
     <div className="jt-request-detail-actions"><button className="jt-detail-accept" disabled={busy} onClick={()=>respond('accepted')}>Accept</button><button className="jt-detail-decline" disabled={busy} onClick={()=>respond('declined')}>Decline</button></div>
     <label className="jt-request-detail-clarify">Need clarification?<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} rows={3} placeholder="Write your question for JiTap Service Operations…"/></label>
     <button className="jt-detail-question" disabled={busy||note.trim().length<3} onClick={()=>respond('needs_clarification')}>Send question to JiTap</button>
    </>}
   </article>}
 </main>;
}
