'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,CalendarDays,ChevronLeft,ChevronRight,CheckCircle2,Send,X,Eye,Clock3,Phone,MapPin,SlidersHorizontal,UserRound} from 'lucide-react';
import type {CustomerTicket} from '@/components/CustomerTicketCard';
import {SERVICE_OPTIONS,KENYAN_SERVICE_AREAS} from '@/lib/provider-options';
import './customer-calendar.css';

type Provider={id:string;name:string};
type Booking={id:string;request_id:string;provider_user_id:string|null;providerName?:string|null;
 starts_at:string;ends_at:string;status:string;note:string;providerPhone?:string|null;
 providerRating?:number|null;providerRatingCount?:number;providerCompletedJobs?:number|null;service?:{category:string;area:string;description:string;location?:string};
 proposed_start_at:string|null;proposed_end_at:string|null;response_note:string};
const kenya='Africa/Nairobi';
const dt=(iso:string)=>new Intl.DateTimeFormat('en-KE',{timeZone:kenya,dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))+' EAT';
const dateInEAT=(d:Date)=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:kenya}).format(d);
const today=()=>dateInEAT(new Date());
const tomorrow=()=>dateInEAT(new Date(Date.now()+86400000));
const monthStart=(d:string)=>d.slice(0,7)+'-01';
const dayAt=(d:string)=>new Date(d+'T12:00:00Z');
function addDays(d:string,n:number){const v=dayAt(d);v.setUTCDate(v.getUTCDate()+n);return v.toISOString().slice(0,10)}
const weekStart=(d:string)=>addDays(d,-dayAt(d).getUTCDay());
const timeLabel=(d:string)=>new Intl.DateTimeFormat('en-KE',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:kenya}).format(new Date(d));
const clockHour=(d:string)=>{const parts=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:kenya}).format(new Date(d)).split(':');return Number(parts[0])+Number(parts[1])/60};
const serviceName=(category?:string)=>SERVICE_OPTIONS.find(s=>s.value===category)?.label||category?.replaceAll('-',' ')||'Service';
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
 const [month,setMonth]=useState(()=>monthStart(today()));
 const [selectedDay,setSelectedDay]=useState(today);
 const [monthView,setMonthView]=useState(false);
 const [filterOpen,setFilterOpen]=useState(false);
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
 const selectedJobs=bookings.filter(b=>b.status!=='cancelled'&&dateInEAT(new Date(b.starts_at))===selectedDay)
  .sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
 const week=Array.from({length:7},(_,i)=>addDays(weekStart(selectedDay),i));
 const calendarDays=monthView?monthDays(month):week;
 const move=(n:number)=>{
  const next=monthView?monthChange(month,n):monthStart(addDays(selectedDay,n*7));
  const nextDay=monthView?next.slice(0,7)+'-'+String(Math.min(Number(selectedDay.slice(-2)),28)).padStart(2,'0'):
   addDays(selectedDay,n*7);
  setSelectedDay(nextDay);setMonth(monthStart(nextDay));
 };
 const reveal=(b:Booking)=>{open(b);window.scrollTo({top:0,behavior:'smooth'})};
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
 return <section className={'jt-customer-calendar'+(selected&&!editor?' is-detail':editor?' is-editor':'')} aria-label="Customer service Calendar">
  <header className="jt-calendar-intro">
   <div><h1>Calendar</h1><p>{new Intl.DateTimeFormat('en-KE',{month:'long',year:'numeric',timeZone:'UTC'}).format(dayAt(selectedDay))}</p></div>
   <div className="jt-calendar-top-actions">
    <button type="button" className="jt-calendar-filter-button" aria-label="Change calendar view" aria-expanded={filterOpen}
     onClick={()=>setFilterOpen(v=>!v)}><SlidersHorizontal size={22}/></button>
    <button type="button" className="jt-calendar-plus" aria-label="Schedule a new service" title="Schedule a service"
     onClick={()=>{reset();setViewId(null);setEditor(true);window.scrollTo({top:0,behavior:'smooth'})}}>
     <span aria-hidden="true" className="jt-calendar-plus-mark">+</span>
    </button>
   </div>
  </header>
  {filterOpen&&<div className="jt-calendar-filter" role="group" aria-label="Calendar display">
   <button type="button" aria-pressed={!monthView} onClick={()=>{setMonthView(false);setFilterOpen(false)}}>Week view</button>
   <button type="button" aria-pressed={monthView} onClick={()=>{setMonthView(true);setFilterOpen(false)}}>Month view</button>
  </div>}
  {error&&<p className="jt-calendar-error" role="alert">{error}</p>}
  {message&&<p className="jt-calendar-success" role="status">{message}</p>}
  {reference&&<p className="jt-calendar-success">Reference: <strong>{reference}</strong></p>}
  <div className="jt-calendar-month">
   <div className="jt-calendar-month-header">
    <button type="button" aria-label="Previous dates" onClick={()=>move(-1)}><ChevronLeft size={21}/></button>
    <strong>{new Intl.DateTimeFormat('en-KE',{month:'long',year:'numeric',timeZone:'UTC'}).format(dayAt(selectedDay))}</strong>
    <button type="button" aria-label="Next dates" onClick={()=>move(1)}><ChevronRight size={21}/></button>
   </div>
   <div className="jt-calendar-grid">
    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span key={d} className="jt-calendar-weekday">{d}</span>)}
    {calendarDays.map((d,i)=>d?<button type="button" key={d}
     className={(selectedDay===d?'selected ':'')+(marked.has(d)?'has-booking ':'')+(d.slice(0,7)!==selectedDay.slice(0,7)?'is-other-month':'')}
     onClick={()=>{setSelectedDay(d);setMonth(monthStart(d))}} aria-pressed={selectedDay===d}>
     {Number(d.slice(-2))}</button>:<span key={'space-'+i} aria-hidden="true"/>)}
   </div>
   <button type="button" className="jt-calendar-expand" aria-label={monthView?'Collapse to week':'Expand to month'}
    onClick={()=>setMonthView(v=>!v)}><span/></button>
  </div>
  {!editor&&!selected&&<section className="jt-calendar-agenda" aria-label={'Appointments '+selectedDay}>
   <div className="jt-calendar-agenda-heading">
    <div><h2>{selectedDay===today()?'Today':new Intl.DateTimeFormat('en-KE',{weekday:'long',day:'numeric',month:'short',timeZone:'UTC'}).format(dayAt(selectedDay))}</h2>
     <p>{selectedJobs.length===0?'No bookings for this day':selectedJobs.length+' scheduled '+(selectedJobs.length===1?'booking':'bookings')}</p></div>
    {selectedJobs.length>0&&<span className="jt-calendar-agenda-count">{selectedJobs.length}</span>}
   </div>
   {selectedJobs.length>0?<div className="jt-calendar-timeline">
    {Array.from({length:14},(_,i)=>i+7).map(h=><div className="jt-calendar-hour" key={h}>
     <span>{h%12||12} {h<12?'AM':'PM'}</span><i/></div>)}
    <div className="jt-calendar-events">
     {selectedJobs.map((b,i)=>{
      const top=Math.max(0,(clockHour(b.starts_at)-7)*58);
      const duration=Math.max(1,clockHour(b.ends_at)-clockHour(b.starts_at));
      return <button type="button" key={b.id} className={'jt-calendar-event jt-calendar-event-'+(i%3)}
       style={{top:top+'px',height:Math.max(66,duration*58-6)+'px'}}
       onClick={()=>reveal(b)}>
       <span className="jt-calendar-event-indicator"/>
       <span><strong>{serviceName(b.service?.category)}</strong>
        <small>{timeLabel(b.starts_at)} – {timeLabel(b.ends_at)}</small>
        <small>{b.providerName||'Provider not selected'} · {status(b)}</small></span>
      </button>
     })}
    </div>
   </div>:<div className="jt-calendar-empty-day"><CalendarDays size={33}/>
    <p>Nothing scheduled for this day</p><small>Choose another date or tap + to plan a service.</small></div>}
  </section>}
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
   <div className="jt-calendar-list-heading"><h2>My scheduled bookings</h2>
    <small>{bookings.filter(b=>b.status!=='cancelled').length} bookings</small></div>
   {loading?<p>Loading calendar…</p>:bookings.length===0?<div className="jt-calendar-list-empty">
    <CalendarDays size={26}/><p>No bookings yet. Tap + to schedule your first service.</p></div>:
    [...bookings].sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).map(b=>
     <button type="button" className="jt-calendar-booking-row" key={b.id} onClick={()=>reveal(b)}>
      <span className="jt-calendar-booking-icon"><CalendarDays size={20}/></span>
      <span className="jt-calendar-booking-main">
       <strong>{serviceName(b.service?.category)}</strong>
       <small>{dt(b.starts_at)}</small>
       <small className="jt-calendar-booking-provider">{b.providerName||'Provider not selected'} · {ref(b.request_id)}</small>
      </span>
      <span className="jt-calendar-booking-aside"><span className={'jt-calendar-booking-badge status-'+b.status}>{status(b)}</span><ChevronRight size={20}/></span>
     </button>)}
  </div>
  {selected&&<section className="jt-calendar-detail" aria-label="Scheduled booking details">
   <div className="jt-calendar-detail-head"><button type="button" aria-label="Back to calendar" onClick={()=>setViewId(null)}><ArrowLeft size={22}/></button>
    <h2>Scheduled Work</h2></div>
   <h3 className="jt-calendar-service-title">{serviceName(selected.service?.category)}</h3>
   <p className="jt-calendar-detail-subtitle">{selected.service?.category||'service'} · {selected.service?.area||'Service area'}</p>
   <div className="jt-calendar-provider-card">
    <span className="jt-calendar-provider-avatar"><UserRound size={28}/></span>
    <div><strong>{selected.providerName||'Provider not selected'}</strong><small>{status(selected)}</small>
     {selected.provider_user_id&&<span className="jt-calendar-provider-trust">
      <span>{selected.providerRating!==null&&selected.providerRating!==undefined?'★ '+selected.providerRating.toFixed(1)+' ('+(selected.providerRatingCount||0)+' ratings)':'☆ New · No ratings yet'}</span>
      {selected.providerCompletedJobs!==null&&selected.providerCompletedJobs!==undefined&&
       <span>{selected.providerCompletedJobs} completed {selected.providerCompletedJobs===1?'job':'jobs'}</span>}
     </span>}</div>
    {selected.providerPhone&&<a href={'tel:'+selected.providerPhone.replace(/[^+0-9]/g,'')} className="jt-calendar-call">
     <Phone size={18}/> Call Provider</a>}
   </div>
   <p><strong>Reference:</strong> {ref(selected.request_id)}</p>
   <p><strong>Service:</strong> {selected.service?.category?.replaceAll('-',' ')||'Service'}</p>
   <section className="jt-calendar-detail-section"><h3>Service details</h3>
    <p className="jt-calendar-detail-description">{selected.service?.description||'Scheduled service'}</p>
    <small>Ref: {ref(selected.request_id)}</small></section>
   <p><strong>Area:</strong> {selected.service?.area||'To be confirmed'}</p>
   <div className="jt-calendar-location-card">
    <MapPin size={20}/><div><strong>{selected.service?.location||'Location to be confirmed'}</strong>
     <small>{selected.service?.area||''}</small></div>
   </div>
   {selected.service?.location&&<div className="jt-calendar-location-map">
    <iframe title={'Service location map: '+selected.service.location} loading="lazy"
     referrerPolicy="no-referrer-when-downgrade"
     src={'https://maps.google.com/maps?q='+encodeURIComponent(
      selected.service.location+', '+(selected.service.area||'')+', Kenya')+'&z=15&output=embed'}/>
    <a href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(
     selected.service.location+', '+(selected.service.area||'')+', Kenya')}
     target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
   </div>}
   <p><strong>Provider:</strong> {selected.providerName||'Not selected'}</p>
   <section className="jt-calendar-detail-schedule"><h3>Schedule</h3><p>
    <CalendarDays size={20}/>{dt(selected.starts_at)} – {timeLabel(selected.ends_at)} EAT</p></section>
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
   {['change_requested','change_proposed'].includes(selected.status)&&
    <button type="button" className="jt-calendar-view jt-calendar-cancel" disabled={busy}
     onClick={()=>void modify('cancel')}>Cancel booking</button>}
   {['pending','declined'].includes(selected.status)&&selected.status==='pending'&&
    <p className="jt-calendar-help">Awaiting provider response.</p>}
   {['pending','declined','draft'].includes(selected.status)&&
    <button type="button" className="jt-calendar-view jt-calendar-cancel" disabled={busy} onClick={()=>void modify('cancel')}>Cancel</button>}
  </section>}
 </section>;
}
