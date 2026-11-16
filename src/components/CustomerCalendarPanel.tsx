'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,CheckCircle2,Plus,Send,X,Eye,Clock3} from 'lucide-react';
import type {CustomerTicket} from '@/components/CustomerTicketCard';
import {SERVICE_OPTIONS,KENYAN_SERVICE_AREAS} from '@/lib/provider-options';
import './customer-calendar.css';

type Provider={id:string;name:string};
type Booking={id:string;request_id:string;provider_user_id:string|null;providerName?:string|null;
 starts_at:string;ends_at:string;status:string;note:string;service?:{category:string;area:string;description:string};
 proposed_start_at:string|null;proposed_end_at:string|null;response_note:string};
const kenya='Africa/Nairobi';
const dt=(iso:string)=>new Intl.DateTimeFormat('en-KE',{timeZone:kenya,dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))+' EAT';
const dateInEAT=(d:Date)=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:kenya}).format(d);
const today=()=>dateInEAT(new Date());
const tomorrow=()=>dateInEAT(new Date(Date.now()+86400000));
const monthStart=(d:string)=>d.slice(0,7)+'-01';
function monthChange(d:string,n:number){const v=new Date(d.slice(0,7)+'-15T12:00:00Z');v.setUTCMonth(v.getUTCMonth()+n);return v.toISOString().slice(0,7)+'-01'}
function monthDays(month:string){
 const d=new Date(month+'T12:00:00Z'),empty=d.getUTCDay();
 const count=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 return [...Array(empty).fill(''),...Array.from({length:count},(_,i)=>month.slice(0,7)+'-'+String(i+1).padStart(2,'0'))];
}
function toIso(day:string,time:string){return new Date(day+'T'+time+':00+03:00').toISOString()}
function clock(iso:string){return new Intl.DateTimeFormat('en-GB',{timeZone:kenya,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(iso))}
function newKey(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('')}

export function CustomerCalendarPanel({tickets,saved=[],reviewer=false,onRefresh}:{
 tickets:CustomerTicket[];saved?:{id:string;name:string;url:string}[];reviewer?:boolean;onRefresh?:()=>void;
}){
 const [day,setDay]=useState(tomorrow);
 const [month,setMonth]=useState(()=>monthStart(tomorrow()));
 const [editor,setEditor]=useState(false);
 const [viewId,setViewId]=useState<string|null>(null);
 const [category,setCategory]=useState<string>('plumbing');
 const [area,setArea]=useState<string>('Nyali');
 const [location,setLocation]=useState('');
 const [description,setDescription]=useState('');
 const [start,setStart]=useState('09:00');
 const [end,setEnd]=useState('10:00');
 const [note,setNote]=useState('');
 const [providerId,setProviderId]=useState('');
 const [providers,setProviders]=useState<Provider[]>([]);
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [showProviders,setShowProviders]=useState(false);
 const [showReschedule,setShowReschedule]=useState(false);
 const [reference,setReference]=useState('');
 const key=useRef('');
 const selected=bookings.find(b=>b.id===viewId)||null;
 const selectedDraft=selected?.status==='draft';
 const load=useCallback(async()=>{
  const r=await fetch('/api/account/calendar',{cache:'no-store'});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(data.error||'Calendar temporarily unavailable');
  setBookings(Array.isArray(data.bookings)?data.bookings:[]);
 },[]);
 useEffect(()=>{
  let live=true;
  load().catch(e=>{if(live)setError(e instanceof Error?e.message:'Calendar unavailable')})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[load]);
 useEffect(()=>{
  if(!editor&&!selectedDraft)return;
  let active=true;
  const params=new URLSearchParams({category,area});
  fetch('/api/account/calendar?'+params,{cache:'no-store'}).then(r=>r.json())
   .then(data=>{if(active)setProviders(Array.isArray(data.providers)?data.providers:[])})
   .catch(()=>{if(active)setProviders([])});
  return()=>{active=false};
 },[category,area,editor,selectedDraft]);
 const matches=useMemo(()=>providers.map(p=>({
  ...p,saved:saved.some(v=>v.name.trim().toLowerCase()===p.name.trim().toLowerCase())
 })).sort((a,b)=>Number(b.saved)-Number(a.saved)||a.name.localeCompare(b.name)),[providers,saved]);
 const marked=new Set(bookings.filter(b=>b.status!=='cancelled').map(b=>dateInEAT(new Date(b.starts_at))));
 const reset=()=>{
  setCategory('plumbing');setArea('Nyali');setLocation('');setDescription('');
  setDay(tomorrow());setMonth(monthStart(tomorrow()));setStart('09:00');setEnd('10:00');
  setNote('');setProviderId('');setShowProviders(false);setShowReschedule(false);
  setReference('');key.current=newKey();setError('');setMessage('');
 };
 const create=async(action:'create_save'|'create_invite')=>{
  if(reviewer){setError('Bookings are disabled in design review mode');return}
  if(action==='create_invite'&&!providerId){setError('Select a matching provider first');return}
  if(!key.current)key.current=newKey();
  setBusy(true);setError('');setMessage('');
  try{
   const r=await fetch('/api/account/calendar',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,category,area,location,description,providerId:action==='create_invite'?providerId:undefined,
     startsAt:toIso(day,start),endsAt:toIso(day,end),note,idempotencyKey:key.current})});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(data.error||'Could not save this service');
   setReference(data.serviceId||'');
   setMessage(action==='create_save'?'Service saved to Calendar. No invitation sent.':
    'Provider invited. Booking is awaiting their response.');
   setEditor(false);setViewId(data.id||null);await load();onRefresh?.();
  }catch(e){setError(e instanceof Error?e.message:'Unable to create service')}
  finally{setBusy(false)}
 };
 const modify=async(action:'cancel'|'reschedule'|'respond_proposal'|'respond_change'|'invite',accept?:boolean)=>{
  if(!selected||busy||reviewer)return;
  if(action==='cancel'&&!window.confirm('Cancel this scheduled booking?'))return;
  setBusy(true);setError('');setMessage('');
  try{
   const payload:Record<string,unknown>=action==='invite'?
    {action:'invite',requestId:selected.request_id,providerId,startsAt:toIso(day,start),endsAt:toIso(day,end),note}:
    {action,bookingId:selected.id};
   if(action==='reschedule'){payload.startsAt=toIso(day,start);payload.endsAt=toIso(day,end)}
   if(action==='respond_proposal'||action==='respond_change')payload.accept=!!accept;
   const r=await fetch('/api/account/calendar',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)});
   const result=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(result.error||'Could not change booking');
   setMessage(action==='cancel'?'Booking cancelled.':action==='reschedule'?'New date sent to provider for approval.':
    action==='invite'?'Provider invited.':'Your decision has been saved.');
   setShowReschedule(false);setShowProviders(false);await load();onRefresh?.();
  }catch(e){setError(e instanceof Error?e.message:'Unable to update booking')}
  finally{setBusy(false)}
 };
 const open=(b:Booking)=>{
  setViewId(b.id);setEditor(false);setShowReschedule(false);setShowProviders(false);
  setDay(dateInEAT(new Date(b.starts_at)));setMonth(monthStart(dateInEAT(new Date(b.starts_at))));
  setStart(clock(b.starts_at));setEnd(clock(b.ends_at));setNote(b.note);
  setCategory(b.service?.category||'plumbing');setArea(b.service?.area||'Nyali');
  setLocation('');setDescription(b.service?.description||'');
  setProviderId(b.provider_user_id||'');setError('');setMessage('');
 };
 const ref=(id:string)=>'JT-'+id.slice(0,8).toUpperCase();
 const status=(b:Booking)=>({
  draft:'Saved',pending:'Awaiting provider',proposed:'New time proposed',
  accepted:'Confirmed',declined:'Declined',change_requested:'Reschedule pending',
  change_proposed:'Alternative time proposed',cancelled:'Cancelled'
 } as Record<string,string>)[b.status]||b.status;
 const dateInputs=<div className="jt-calendar-datetime">
  <label>Date<input type="date" value={day} min={today()} onChange={e=>{setDay(e.target.value);setMonth(monthStart(e.target.value))}}/></label>
  <label>Start (EAT)<input type="time" value={start} onChange={e=>setStart(e.target.value)}/></label>
  <label>End (EAT)<input type="time" value={end} onChange={e=>setEnd(e.target.value)}/></label>
 </div>;
 return <section className="jt-customer-calendar" aria-label="Customer service Calendar">
  <header className="jt-calendar-intro">
   <CalendarDays size={26}/>
   <div><h1>Calendar</h1><p>Plan a service or view your bookings.</p></div>
   <button type="button" className="jt-calendar-plus" aria-label="Schedule a new service" title="Schedule a service"
    onClick={()=>{reset();setViewId(null);setEditor(true)}}><Plus size={27}/></button>
  </header>
  {error&&<p className="jt-calendar-error" role="alert">{error}</p>}
  {message&&<p className="jt-calendar-success" role="status">{message}</p>}
  {reference&&<p className="jt-calendar-success">Reference: <strong>{reference}</strong></p>}
  <div className="jt-calendar-month">
   <div className="jt-calendar-month-header">
    <button type="button" aria-label="Previous month" onClick={()=>setMonth(monthChange(month,-1))}><ChevronLeft size={21}/></button>
    <strong>{new Intl.DateTimeFormat('en-KE',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'T12:00:00Z'))}</strong>
    <button type="button" aria-label="Next month" onClick={()=>setMonth(monthChange(month,1))}><ChevronRight size={21}/></button>
   </div>
   <div className="jt-calendar-grid">
    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span key={d} className="jt-calendar-weekday">{d}</span>)}
    {monthDays(month).map((d,i)=>d?<button type="button" key={d} className={(day===d?'selected ':'')+(marked.has(d)?'has-booking':'')}
     onClick={()=>setDay(d)} aria-pressed={day===d}>{Number(d.slice(-2))}</button>:
     <span key={'empty'+i}/>)}
   </div>
  </div>
  {editor&&<div className="jt-calendar-entry">
   <div className="jt-calendar-form-head"><h2>Schedule a service</h2>
    <button type="button" aria-label="Close new service form" onClick={()=>setEditor(false)}><X size={19}/></button></div>
   <p className="jt-calendar-help">A JiTap service reference is generated only when you save or invite a provider.</p>
   <label htmlFor="jt-calendar-category">Service</label>
   <select id="jt-calendar-category" value={category} onChange={e=>{setCategory(e.target.value);setProviderId('')}}>
    {SERVICE_OPTIONS.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}
   </select>
   <label htmlFor="jt-calendar-description">What do you need done?</label>
   <textarea id="jt-calendar-description" value={description} maxLength={1200} rows={3}
    onChange={e=>setDescription(e.target.value)} placeholder="e.g. Fix a leaking shower mixer"/>
   <label htmlFor="jt-calendar-area">Service area</label>
   <select id="jt-calendar-area" value={area} onChange={e=>{setArea(e.target.value);setProviderId('')}}>
    {KENYAN_SERVICE_AREAS.map(a=><option key={a}>{a}</option>)}
   </select>
   <label htmlFor="jt-calendar-location">Location / meeting point</label>
   <input id="jt-calendar-location" value={location} maxLength={160}
    onChange={e=>setLocation(e.target.value)} placeholder="e.g. Vescon 1, Nyali"/>
   {dateInputs}
   <label htmlFor="jt-calendar-note">Additional instructions (optional)</label>
   <textarea id="jt-calendar-note" value={note} maxLength={500} rows={2}
    onChange={e=>setNote(e.target.value)}/>
   <div className="jt-calendar-provider-picker"><strong>Choose a provider (optional)</strong>
    <button type="button" onClick={()=>setShowProviders(v=>!v)}>
     {providerId?matches.find(m=>m.id===providerId)?.name||'Change provider':'Find matching providers'}
    </button></div>
   {showProviders&&<div className="jt-calendar-providers" role="radiogroup" aria-label="Matching providers">
    {!matches.length?<p>No approved matching providers in this area yet. You can save and return later.</p>:
     matches.map(m=><label key={m.id} className={providerId===m.id?'selected':''}>
      <input type="radio" name="customer-calendar-provider" checked={providerId===m.id}
       onChange={()=>setProviderId(m.id)}/><span><strong>{m.name}</strong>
       <small>{m.saved?'Saved provider · ':''}Verified JiTap provider</small></span>
     </label>)}
   </div>}
   <div className="jt-calendar-ctas">
    <button type="button" className="secondary" disabled={busy||reviewer} onClick={()=>void create('create_save')}>Save</button>
    <button type="button" disabled={busy||reviewer||!providerId} onClick={()=>void create('create_invite')}>
     <Send size={17}/> Invite provider</button>
   </div>
  </div>}
  <div className="jt-calendar-bookings">
   <h2>My scheduled bookings</h2>
   {loading?<p>Loading calendar…</p>:bookings.length===0?<p>No bookings yet. Tap <strong>+</strong> to schedule a service.</p>:
    bookings.map(b=><article key={b.id}>
     <div><CalendarDays size={20}/><strong>{dt(b.starts_at)}</strong></div>
     <p>{b.service?.description||b.service?.category||'Service'} · {ref(b.request_id)}
      {b.providerName?' · '+b.providerName:''}</p>
     <small>{status(b)}</small>
     <button type="button" className="jt-calendar-view" onClick={()=>open(b)}><Eye size={16}/> View</button>
    </article>)}
  </div>
  {selected&&<section className="jt-calendar-detail" aria-label="Scheduled booking details">
   <div className="jt-calendar-detail-head"><h2>Booking details</h2>
    <button type="button" aria-label="Close booking details" onClick={()=>setViewId(null)}><X size={20}/></button></div>
   <p><strong>Reference:</strong> {ref(selected.request_id)}</p>
   <p><strong>Service:</strong> {selected.service?.category?.replaceAll('-',' ')||'Service'}</p>
   <p><strong>Description:</strong> {selected.service?.description||'Scheduled service'}</p>
   <p><strong>Area:</strong> {selected.service?.area||'To be confirmed'}</p>
   <p><strong>Provider:</strong> {selected.providerName||'Not selected'}</p>
   <p><strong>Date and time:</strong> {dt(selected.starts_at)} – {dt(selected.ends_at)}</p>
   <p><strong>Status:</strong> {status(selected)}</p>
   {selected.note&&<p><strong>Instructions:</strong> {selected.note}</p>}
   {['proposed','change_proposed'].includes(selected.status)&&selected.proposed_start_at&&
    <div className="jt-calendar-status"><strong>Provider proposes {dt(selected.proposed_start_at)}</strong>
     <div className="jt-calendar-ctas">
      <button type="button" disabled={busy} onClick={()=>void modify(
       selected.status==='change_proposed'?'respond_change':'respond_proposal',true)}>Accept time</button>
      <button type="button" className="secondary" disabled={busy} onClick={()=>void modify(
       selected.status==='change_proposed'?'respond_change':'respond_proposal',false)}>Decline time</button>
     </div>
    </div>}
   {selected.status==='draft'&&<>
    <p className="jt-calendar-help">Your plan is saved. Invite a matching provider when ready.</p>
    <div className="jt-calendar-provider-picker"><strong>Provider</strong>
     <button type="button" onClick={()=>setShowProviders(v=>!v)}>Find matching providers</button></div>
    {showProviders&&<div className="jt-calendar-providers">{matches.map(p=>
     <label key={p.id}><input type="radio" checked={providerId===p.id}
      onChange={()=>setProviderId(p.id)}/><span>{p.name}</span></label>)}</div>}
    <button type="button" className="jt-calendar-view" disabled={!providerId||busy} onClick={()=>void modify('invite')}>
     Invite provider</button>
   </>}
   {selected.status==='accepted'&&<>
    {!showReschedule?<div className="jt-calendar-ctas">
     <button type="button" className="secondary" onClick={()=>setShowReschedule(true)}>Reschedule</button>
     <button type="button" className="jt-calendar-cancel" disabled={busy} onClick={()=>void modify('cancel')}>Cancel booking</button>
    </div>:<div className="jt-calendar-reschedule">
     <h3>Request a new date and time</h3>{dateInputs}
     <p className="jt-calendar-help">The existing booking remains confirmed until the provider accepts your new time.</p>
     <div className="jt-calendar-ctas">
      <button type="button" disabled={busy} onClick={()=>void modify('reschedule')}>Send reschedule request</button>
      <button type="button" className="secondary" onClick={()=>setShowReschedule(false)}>Keep existing time</button>
     </div></div>}
   </>}
   {selected.status==='change_requested'&&<p className="jt-calendar-status"><Clock3 size={17}/> Waiting for provider to approve your new time: {selected.proposed_start_at?dt(selected.proposed_start_at):''}. Your existing time remains confirmed.</p>}
   {['pending','declined'].includes(selected.status)&&selected.status==='pending'&&
    <p className="jt-calendar-help">Awaiting provider response.</p>}
   {['pending','declined','draft'].includes(selected.status)&&
    <button type="button" className="jt-calendar-view jt-calendar-cancel" disabled={busy} onClick={()=>void modify('cancel')}>Cancel</button>}
  </section>}
 </section>;
}
