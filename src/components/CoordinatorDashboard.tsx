'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {CheckCircle2,RefreshCw,LogOut,MapPin,Phone,CalendarClock,Search,AlertTriangle,ClipboardList,Users,Clock3} from 'lucide-react';
import {CoordinatorWorkflow} from '@/components/CoordinatorWorkflow';
type Staff={email:string;role:'admin'|'coordinator'};
type Case={
 id:string;reference:string;source_kind:string;source_id:string;status:string;priority:string;assigned_to:string|null;next_followup_at:string|null;created_at:string;
 category:string;area:string;description:string;name:string;phone:string;preferredDate:string;preferredTime:string;locationLabel:string;destination:string;needsLocation:boolean;needsPhone:boolean;needsSchedule:boolean;canContact:boolean;notifyOptIn:boolean;
};
type Activity={action:string;actor_email:string;note:string|null;old_value:string|null;new_value:string|null;created_at:string};
const statuses=[
 ['new','New'],['incomplete','Incomplete'],['needs_sourcing','Needs sourcing'],['matching','Matching'],['provider_contacted','Provider contacted'],['awaiting_quote','Awaiting quote'],['scheduled','Scheduled'],['in_progress','In progress'],['completed','Completed'],['cancelled','Cancelled'],['closed','Closed']
] as const;
const nameStatus=(value:string)=>statuses.find(s=>s[0]===value)?.[1]||value.replaceAll('_',' ');
function formatDate(date:string){try{return new Date(date).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'})}catch{return date}}
export function CoordinatorDashboard(){
 const [staff,setStaff]=useState<Staff|null>(null);
 const [checking,setChecking]=useState(true);
 const [email,setEmail]=useState('');
 const [code,setCode]=useState('');
 const [sent,setSent]=useState(false);
 const [authMessage,setAuthMessage]=useState('');
 const [logging,setLogging]=useState(false);
 const [cases,setCases]=useState<Case[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [caseTab,setCaseTab]=useState<'workflow'|'details'>('workflow');
 const [activity,setActivity]=useState<Activity[]>([]);
 const [filter,setFilter]=useState('all');
 const [search,setSearch]=useState('');
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState('');
 const [note,setNote]=useState('');
 const [followup,setFollowup]=useState('');
 const load=useCallback(async()=>{
  const res=await fetch('/api/coordinator/cases',{cache:'no-store'});
  if(res.status===401){setStaff(null);setCases([]);return}
  if(!res.ok)throw new Error('Could not load cases');
  const data=await res.json();
  setStaff(data.staff);setCases(data.cases||[]);
 },[]);
 const loadDetail=useCallback(async(id:string)=>{
  const res=await fetch('/api/coordinator/cases?id='+encodeURIComponent(id),{cache:'no-store'});
  if(!res.ok)throw new Error('Could not load case details');
  const data=await res.json();
  setActivity(data.activity||[]);
  setFollowup(data.case?.next_followup_at?new Date(data.case.next_followup_at).toISOString().slice(0,16):'');
 },[]);
 useEffect(()=>{
  let mounted=true;
  (async()=>{
   try{
    // Supabase may use an email magic link instead of a numeric OTP.
    // Remove the access token from the address bar immediately and exchange it
    // for JiTap's secure, HttpOnly staff session cookie.
    const hash=window.location.hash;
    const params=hash.startsWith('#')?new URLSearchParams(hash.slice(1)):null;
    const token=params?.get('access_token');
    if(hash&&(token||params?.has('error'))){
     window.history.replaceState(null,'',window.location.pathname+window.location.search);
    }
    if(token){
     const linked=await fetch('/api/coordinator/auth',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'link',accessToken:token}),
      cache:'no-store'
     });
     const payload=await linked.json();
     if(!mounted)return;
     if(linked.ok){setStaff(payload.staff);await load();return}
     setAuthMessage(payload.error||'This sign-in link could not be verified. Request a new email.');
    }else if(params?.has('error')){
     setAuthMessage('This sign-in link expired or was rejected. Request a new email.');
    }
    const res=await fetch('/api/coordinator/auth',{cache:'no-store'});
    if(!mounted)return;
    if(res.ok){
     const body=await res.json();setStaff(body.staff);
     await load();
    }
   }catch{if(mounted)setFeedback('Unable to connect to the coordinator service.')}
   finally{if(mounted)setChecking(false)}
  })();
  return()=>{mounted=false};
 },[load]);
 useEffect(()=>{if(selected)loadDetail(selected).catch(()=>setFeedback('Could not load activity history'))},[selected,loadDetail]);
 async function authenticate(action:'send'|'verify'){
  setLogging(true);setAuthMessage('');
  try{
   const res=await fetch('/api/coordinator/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,email,token:code})});
   const body=await res.json();
   if(!res.ok){setAuthMessage(body.error||'Sign-in could not be completed');return}
   if(action==='send'){setSent(true);setAuthMessage('If this email is authorized, check your inbox for a JiTap sign-in link or verification code.')}
   else {setStaff(body.staff);setSent(false);setCode('');await load()}
  }catch{setAuthMessage('Could not reach the sign-in service')}
  finally{setLogging(false)}
 }
 async function logout(){
  await fetch('/api/coordinator/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});
  setStaff(null);setCases([]);setSelected(null);setActivity([]);
 }
 async function update(action:string,value?:string|null,extraNote?:string){
  if(!selected)return;
  setBusy(true);setFeedback('');
  try{
   const res=await fetch('/api/coordinator/cases',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected,action,value,note:extraNote})});
   const data=await res.json();
   if(!res.ok)throw new Error(data.error||'Update rejected');
   setNote('');await load();await loadDetail(selected);setFeedback('Case updated');
  }catch(e){setFeedback(e instanceof Error?e.message:'Could not save')}
  finally{setBusy(false)}
 }
 const visible=useMemo(()=>cases.filter(c=>(filter==='all'||c.status===filter)&&[c.category,c.description,c.area,c.name,c.reference].join(' ').toLowerCase().includes(search.toLowerCase())),[cases,filter,search]);
 const active=cases.find(c=>c.id===selected)||null;
 const newCount=cases.filter(c=>c.status==='new').length;
 const incompleteCount=cases.filter(c=>c.status==='incomplete').length;
 const sourcingCount=cases.filter(c=>c.status==='needs_sourcing').length;
 const progressCount=cases.filter(c=>['matching','provider_contacted','awaiting_quote','scheduled','in_progress'].includes(c.status)).length;
 if(checking)return <section className="coordinator-root"><div className="coordinator-auth">Checking authorized staff access…</div></section>;
 if(!staff)return <section className="coordinator-root"><div className="coordinator-auth">
   <div className="coordinator-mark">JiTap · Service Operations</div>
   <h1>Coordinator sign in</h1>
   <p>Private staff workspace. Only approved JiTap team emails can access customer requests.</p>
   <form onSubmit={e=>{e.preventDefault();authenticate(sent?'verify':'send')}}>
    <label>Work email<input type="email" autoComplete="email" required value={email} onChange={e=>{setEmail(e.target.value);setSent(false)}} placeholder="you@jitap.app"/></label>
    {sent&&<label>Email verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={8} required value={code} onChange={e=>setCode(e.target.value)} placeholder="6-digit code"/></label>}
    <button type="submit" disabled={logging}>{logging?'Processing…':sent?'Verify and sign in':'Email me a code'}</button>
    {sent&&<button type="button" className="coordinator-secondary" onClick={()=>authenticate('send')}>Resend code</button>}
   </form>
   {authMessage&&<p role="status">{authMessage}</p>}
   {feedback&&<p role="status">{feedback}</p>}
  </div></section>;
 return <section className="coordinator-root">
  <header className="coordinator-header"><div><span className="coordinator-kicker">JITAP SERVICE OPERATIONS</span><h1>Coordinator queue</h1><p>Follow every request from intake to completion. No provider match? Escalate to human sourcing.</p></div>
  <div className="coordinator-header-actions"><span>{staff.email} · {staff.role}</span><button onClick={()=>load().catch(()=>setFeedback('Refresh failed'))}><RefreshCw size={16}/> Refresh</button><button onClick={logout}><LogOut size={16}/> Sign out</button></div></header>
  <div className="coordinator-stats">
   <div><ClipboardList/><strong>{cases.length}</strong><span>Tracked cases</span></div>
   <div><Clock3/><strong>{newCount}</strong><span>New requests</span></div>
   <div><AlertTriangle/><strong>{incompleteCount}</strong><span>Incomplete leads</span></div>
   <div><Users/><strong>{sourcingCount}</strong><span>Needs sourcing</span></div>
   <div><CheckCircle2/><strong>{progressCount}</strong><span>In workflow</span></div>
  </div>
  <div className="coordinator-layout">
   <div className="coordinator-list">
    <div className="coordinator-controls"><label><Search size={16}/><input aria-label="Search requests" placeholder="Search service, location, reference…" value={search} onChange={e=>setSearch(e.target.value)}/></label><select value={filter} aria-label="Filter case status" onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
    <div className="coordinator-list-count">{visible.length} cases · newest first</div>
    {visible.map(c=><button key={c.id} className={'coordinator-case'+(c.id===selected?' is-selected':'')} onClick={()=>{setSelected(c.id);setCaseTab('workflow');window.setTimeout(()=>document.getElementById('coordinator-detail-panel')?.scrollIntoView({behavior:'smooth',block:'start'}),30)}}>
      <div className="coordinator-case-reference">JT-{c.reference}</div>
      <div className="coordinator-case-line"><strong>{c.category.replaceAll('-',' ')}</strong><span className={'coordinator-status coordinator-status-'+c.status}>{nameStatus(c.status)}</span></div>
      <div className="coordinator-case-desc">{c.description||'Details not yet supplied'}</div>
      <div className="coordinator-case-meta"><span><MapPin size={13}/>{c.locationLabel||c.area||'Location needed'}</span><span>{formatDate(c.created_at)}</span></div>
      {(c.needsLocation||c.needsPhone||c.needsSchedule)&&<div className="coordinator-flags">{c.needsPhone?'Phone missing · ':''}{c.needsLocation?'Exact location missing · ':''}{c.needsSchedule?'Date not selected':''}</div>}
    </button>)}
    {!visible.length&&<div className="coordinator-empty">No cases match this filter.</div>}
   </div>
   <div className="coordinator-detail" id="coordinator-detail-panel">
   {active?<><div className="coordinator-detail-top"><span>Service ID: <strong>JT-{active.reference}</strong></span><strong>{nameStatus(active.status)}</strong></div>
    <div className="coordinator-case-tabs" role="tablist" aria-label="Coordinator case sections">
      <button role="tab" aria-selected={caseTab==='workflow'} className={caseTab==='workflow'?'active':''} onClick={()=>setCaseTab('workflow')} type="button">Provider &amp; Customer Workflow</button>
      <button role="tab" aria-selected={caseTab==='details'} className={caseTab==='details'?'active':''} onClick={()=>setCaseTab('details')} type="button">Case Details</button>
    </div>
    {caseTab==='details'&&<><h2>{active.category.replaceAll('-',' ')}</h2><p className="coordinator-description">{active.description}</p>
    <dl><dt>Service ID</dt><dd className="coordinator-service-id">JT-{active.reference}</dd><dt>Customer</dt><dd>{active.name||'Not provided'}</dd><dt>Phone</dt><dd>{active.phone||'Not provided'}</dd><dt>Service area</dt><dd>{active.area||'Not specified'}</dd><dt>Exact location</dt><dd>{active.locationLabel||'Confirm with customer'}</dd><dt>Preferred appointment</dt><dd>{[active.preferredDate,active.preferredTime].filter(Boolean).join(' at ')||'Confirm with customer'}</dd>{active.destination&&<><dt>Moving destination</dt><dd>{active.destination}</dd></>}<dt>Created</dt><dd>{formatDate(active.created_at)}</dd></dl>
    <h3>Coordinate the request</h3><div className="coordinator-editor"><label>Status<select disabled={busy} value={active.status} onChange={e=>update('status_changed',e.target.value)}>{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Priority<select disabled={busy} value={active.priority} onChange={e=>update('priority_changed',e.target.value)}>{['low','normal','high','urgent'].map(p=><option key={p}>{p}</option>)}</select></label></div>
    <label className="coordinator-followup">Next follow-up (EAT / local)<input type="datetime-local" value={followup} onChange={e=>setFollowup(e.target.value)}/></label><button className="coordinator-secondary" disabled={busy} onClick={()=>update('followup_changed',followup?new Date(followup).toISOString():null)}><CalendarClock size={15}/> Save follow-up</button>
    <div className="coordinator-quick-actions"><button disabled={busy} onClick={()=>update('status_changed','needs_sourcing')}>Needs sourcing</button><button disabled={busy} onClick={()=>update('status_changed','provider_contacted')}>Provider contacted</button><button disabled={busy} onClick={()=>update('status_changed','completed')}>Mark completed</button></div>
    <h3>Coordinator notes</h3><textarea rows={3} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="What did the customer/provider say? What is the next action?"/><button disabled={busy||note.trim().length<2} onClick={()=>update('note_added',null,note)}>Save note</button>
    <h3>Activity history</h3><div className="coordinator-activity">{activity.length?activity.map((a,i)=><div key={i}><strong>{a.action.replaceAll('_',' ')}</strong><small>{formatDate(a.created_at)} · {a.actor_email}</small>{a.note&&<p>{a.note}</p>}{a.new_value&&<p>{a.new_value}</p>}</div>):<p>No activity recorded yet.</p>}</div></>}
    {caseTab==='workflow'&&<><p className="coordinator-case-workflow-lead">Assign a verified provider, record their response, and prepare customer updates. If no provider is available, use the Case Details tab to mark Needs sourcing.</p><CoordinatorWorkflow key={active.id} caseItem={active} onChanged={async()=>{await load();await loadDetail(active.id);}}/></>}
   </>:<div className="coordinator-select">Select a request from the queue to open Provider & Customer Workflow, record provider responses, and prepare customer updates.</div>}
   {feedback&&<p className="coordinator-feedback" role="status">{feedback}</p>}
   </div>
  </div>
 </section>;
}
