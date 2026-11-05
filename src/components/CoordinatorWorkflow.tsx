'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Copy,ExternalLink,RefreshCw,MessageSquare,UserRoundCheck,AlertCircle} from 'lucide-react';

type Provider={id:string;business_name:string;service_categories:string[];service_areas:string[];base_area:string|null};
type Assignment={id:string;provider_id:string;state:string;quoted_amount_kes:number|null;notes:string|null;assigned_at:string;responded_at:string|null};
type Update={id:string;kind:string;channel:'whatsapp'|'sms'|'phone';message:string;state:'draft'|'sent_manually'|'cancelled';created_at:string;sent_at:string|null};
type Case={id:string;reference:string;category:string;description:string;area:string;phone:string;status:string;canContact:boolean;source_kind:string;name:string;locationLabel:string};
const responseStates=[['contacted','Contacted'],['accepted','Accepted'],['declined','Declined'],['needs_clarification','Needs clarification'],['quote_requested','Quote requested'],['quote_received','Quote received'],['cancelled','Cancelled']] as const;
const updateKinds=[['request_received','Request received'],['provider_search','Searching for provider'],['provider_found','Provider found'],['quote_update','Quotation update'],['scheduled','Scheduled'],['progress','Job progress'],['completion','Completion'],['clarification','Clarification needed']] as const;
function toKenyanWhatsApp(phone:string){
 const n=phone.replace(/\D/g,'');
 const number=n.startsWith('0')?'254'+n.slice(1):n;
 return /^254[17]\d{8}$/.test(number)?number:null;
}
function makeMessage(c:Case,kind:string,providerName?:string){
 const ref='JT-'+c.reference;
 const area=c.locationLabel||c.area||'your area';
 switch(kind){
  case 'request_received':return `JiTap: We have received your request (${ref}) for ${c.category.replaceAll('-',' ')} in ${area}. Our team is coordinating the next steps. We will update you as soon as we have progress.`;
  case 'provider_search':return `JiTap update (${ref}): We are checking for an available service provider for your request in ${area}. We will contact you with an update. No booking has been confirmed yet.`;
  case 'provider_found':return `JiTap update (${ref}): We have identified ${providerName||'a potential provider'} for your request. We are confirming their response and availability. Please wait for confirmation before making arrangements.`;
  case 'quote_update':return `JiTap update (${ref}): We are following up on the quotation for your service request. We will share confirmed details with you once available.`;
  case 'scheduled':return `JiTap update (${ref}): Your request has moved to scheduling. We will confirm the exact date, time and provider with you directly.`;
  case 'progress':return `JiTap update (${ref}): We are following up on the progress of your service request. Please reply if you have further information or concerns.`;
  case 'completion':return `JiTap update (${ref}): Our records indicate that your service request is nearing completion. Please confirm whether the work has been completed satisfactorily.`;
  default:return `JiTap update (${ref}): We need a little more information about your request for ${c.category.replaceAll('-',' ')} in ${area}. Please reply with any missing details so we can assist.`;
 }
}
export function CoordinatorWorkflow({caseItem,onChanged}:{caseItem:Case;onChanged:()=>Promise<void>}){
 const [providers,setProviders]=useState<Provider[]>([]);
 const [assignments,setAssignments]=useState<Assignment[]>([]);
 const [updates,setUpdates]=useState<Update[]>([]);
 const [providerId,setProviderId]=useState('');
 const [providerNote,setProviderNote]=useState('');
 const [responses,setResponses]=useState<Record<string,string>>({});
 const [quote,setQuote]=useState<Record<string,string>>({});
 const [responseNotes,setResponseNotes]=useState<Record<string,string>>({});
 const [kind,setKind]=useState('provider_search');
 const [channel,setChannel]=useState<'whatsapp'|'sms'|'phone'>('whatsapp');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState('');
 const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{
  const res=await fetch('/api/coordinator/workflow?caseId='+encodeURIComponent(caseItem.id),{cache:'no-store'});
  if(!res.ok)throw new Error('Unable to load workflow');
  const data=await res.json();
  setProviders(data.providers||[]);setAssignments(data.assignments||[]);setUpdates(data.updates||[]);
 },[caseItem.id]);
 useEffect(()=>{
  let alive=true;
  setLoading(true);setFeedback('');
  load().catch(()=>{if(alive)setFeedback('Unable to load provider assignments.')}).finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[load]);
 const accepted=assignments.find(x=>x.state==='accepted');
 const acceptedName=providers.find(p=>p.id===accepted?.provider_id)?.business_name;
 const matches=useMemo(()=>providers.filter(p=>{
  const category=caseItem.category.toLowerCase().replaceAll('-',' ');
  const cats=p.service_categories.join(' ').toLowerCase().replaceAll('-',' ');
  return cats.includes(category)||category.includes('moving')&&cats.includes('moving')||cats.includes('relocation')&&category.includes('moving');
 }),[providers,caseItem.category]);
 async function action(payload:Record<string,unknown>,success:string){
  setBusy(true);setFeedback('');
  try{
   const res=await fetch('/api/coordinator/workflow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({caseId:caseItem.id,...payload})});
   const data=await res.json();
   if(!res.ok)throw new Error(data.error||'Could not save');
   await load();await onChanged();setFeedback(success);
  }catch(e){setFeedback(e instanceof Error?e.message:'Operation failed')}
  finally{setBusy(false)}
 }
 async function copyUpdate(body:string){
  try{await navigator.clipboard.writeText(body);setFeedback('Message copied. Send it manually, then confirm it was sent.')}
  catch{setFeedback('Clipboard unavailable. Select the message text and copy it manually.')}
 }
 function openWhatsApp(body:string){
  const to=toKenyanWhatsApp(caseItem.phone);
  if(!to){setFeedback('Confirm the customer phone before opening WhatsApp.');return}
  window.open('https://wa.me/'+to+'?text='+encodeURIComponent(body),'_blank','noopener,noreferrer');
 }
 if(loading)return <section className="coordinator-workflow">Loading provider workflow…</section>;
 return <section className="coordinator-workflow">
  <h3><UserRoundCheck size={18}/> Provider assignment</h3>
  <p className="coordinator-help">Only verified providers already in JiTap's database can be assigned. An assignment is a proposal, not an accepted booking.</p>
  <label>Choose verified provider
   <select value={providerId} onChange={e=>setProviderId(e.target.value)} disabled={busy||caseItem.status==='incomplete'}>
    <option value="">Select a verified provider…</option>
    {providers.map(p=><option key={p.id} value={p.id}>{p.business_name} · {p.base_area||p.service_areas.join(', ')}</option>)}
   </select>
  </label>
  {matches.length===0&&<p className="coordinator-help"><AlertCircle size={15}/> No verified provider category match confirmed. Use <strong>Needs sourcing</strong> for human intervention.</p>}
  <input aria-label="Provider assignment note" maxLength={1000} value={providerNote} onChange={e=>setProviderNote(e.target.value)} placeholder="Private note for sourcing or proposed provider"/>
  <button disabled={busy||!providerId||caseItem.status==='incomplete'||['closed','completed','cancelled'].includes(caseItem.status)} onClick={()=>action({action:'assign_provider',providerId,note:providerNote},'Provider proposal saved')}>Assign selected provider</button>
  {assignments.length? <div className="coordinator-assignment-list">{assignments.map(a=>{
   const p=providers.find(p=>p.id===a.provider_id);
   return <div className="coordinator-assignment" key={a.id}>
    <strong>{p?.business_name||'Provider '+a.provider_id}</strong><span className="coordinator-status">{a.state.replaceAll('_',' ')}</span>
    {a.quoted_amount_kes!==null&&<small>Quoted: KES {Number(a.quoted_amount_kes).toLocaleString('en-KE')}</small>}
    <label>Provider response
     <select disabled={busy||['completed','closed','cancelled'].includes(caseItem.status)} value={responses[a.id]||a.state} onChange={e=>setResponses(s=>({...s,[a.id]:e.target.value}))}>
      <option value="proposed" disabled>Proposed</option>
      {responseStates.map(([v,l])=><option key={v} value={v}>{l}</option>)}
     </select>
    </label>
    {(responses[a.id]||a.state)==='quote_received'&&<label>Quoted amount (KES)<input type="number" min="0" max="100000000" value={quote[a.id]||''} onChange={e=>setQuote(s=>({...s,[a.id]:e.target.value}))} placeholder="Enter provider's quotation"/></label>}
    <input aria-label="Response notes" maxLength={1000} placeholder="Provider reply or clarification (private)" value={responseNotes[a.id]||''} onChange={e=>setResponseNotes(s=>({...s,[a.id]:e.target.value}))}/>
    <button disabled={busy||!responses[a.id]||responses[a.id]===a.state} onClick={()=>action({action:'provider_response',assignmentId:a.id,state:responses[a.id],quote:responses[a.id]==='quote_received'&&quote[a.id]!==''?Number(quote[a.id]):null,note:responseNotes[a.id]||''},'Provider response saved')}>Record provider response</button>
   </div>
  })}</div>:<p className="coordinator-help">No provider proposed yet. Requests without a confirmed provider remain available for manual sourcing.</p>}
  <h3><MessageSquare size={18}/> Customer updates</h3>
  <p className="coordinator-help">Prepare an accurate update here. Messages are never sent automatically from this screen. Send only through an appropriate authorized channel, then mark them as sent.</p>
  {!caseItem.canContact&&<p className="coordinator-help"><AlertCircle size={15}/> Customer phone is missing; confirm contact details before messaging.</p>}
  <label>Update type<select value={kind} onChange={e=>{setKind(e.target.value);setMessage('')}}>{updateKinds.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
  <label>Channel<select value={channel} onChange={e=>setChannel(e.target.value as 'whatsapp'|'sms'|'phone')}><option value="whatsapp">WhatsApp (manual)</option><option value="sms">SMS (manual)</option><option value="phone">Phone call (log only)</option></select></label>
  <button className="coordinator-secondary" onClick={()=>setMessage(makeMessage(caseItem,kind,acceptedName))}>Generate update draft</button>
  <textarea rows={5} maxLength={1200} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write a factual update to the customer. Do not promise availability or a booking unless it is confirmed."/>
  <button disabled={busy||message.trim().length<10||!caseItem.canContact} onClick={()=>action({action:'customer_update_draft',kind,channel,message},'Customer update draft saved')}>Save update draft</button>
  {updates.length>0&&<div className="coordinator-updates">{updates.map(u=><div key={u.id} className="coordinator-update-item">
   <div><strong>{u.kind.replaceAll('_',' ')}</strong><span className="coordinator-status">{u.state.replaceAll('_',' ')}</span></div>
   <p>{u.message}</p><small>{u.channel} · {new Date(u.created_at).toLocaleString('en-KE',{timeZone:'Africa/Nairobi'})}</small>
   {u.state==='draft'&&<div className="coordinator-update-actions">
    <button disabled={busy} onClick={()=>copyUpdate(u.message)}><Copy size={14}/> Copy message</button>
    {u.channel==='whatsapp'&&caseItem.canContact&&<button disabled={busy} onClick={()=>openWhatsApp(u.message)}><ExternalLink size={14}/> Open WhatsApp</button>}
    <button disabled={busy} onClick={()=>{if(window.confirm('Have you actually delivered this update to the customer using '+u.channel+'?'))action({action:'customer_update_mark_sent',updateId:u.id},'Manual customer update recorded')}}>Confirm sent</button>
   </div>}
  </div>)}</div>}
  {feedback&&<p className="coordinator-feedback" role="status">{feedback}</p>}
 </section>;
}
