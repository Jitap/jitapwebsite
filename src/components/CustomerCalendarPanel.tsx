'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {CalendarDays,ChevronLeft,ChevronRight,Clock3,CheckCircle2,UserRound,Send} from 'lucide-react';
import type {CustomerTicket} from '@/components/CustomerTicketCard';
import './customer-calendar.css';

type Booking={id:string;request_id:string;provider_user_id:string|null;
 starts_at:string;ends_at:string;status:string;note:string;
 proposed_start_at:string|null;proposed_end_at:string|null;response_note:string;};
type Provider={id:string;name:string};
type Options={request?:{category:string;area:string;description:string};canSchedule?:boolean;providers?:Provider[]};
const kenya='Africa/Nairobi';
const dt=(iso:string)=>new Intl.DateTimeFormat('en-KE',{
 timeZone:kenya,dateStyle:'medium',timeStyle:'short'
}).format(new Date(iso))+' EAT';
const localDay=(date:Date)=>date.toLocaleDateString('en-CA',{timeZone:kenya,year:'numeric',month:'2-digit',day:'2-digit'});
const currentDay=()=>localDay(new Date());
function startMonth(day:string){return day.slice(0,7)+'-01'}
function shiftMonth(day:string,n:number){const d=new Date(day.slice(0,7)+'-15T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,7)+'-01'}
function daysForMonth(month:string){
 const first=new Date(month+'T12:00:00Z');
 const off=first.getUTCDay();
 const total=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
 return [...Array(off).fill(''),...Array.from({length:total},(_,i)=>month.slice(0,7)+'-'+String(i+1).padStart(2,'0'))];
}
function eastAfricaIso(day:string,time:string){
 return new Date(day+'T'+time+':00+03:00').toISOString();
}
export function CustomerCalendarPanel({tickets,saved=[],reviewer=false,onRefresh}:{
 tickets:CustomerTicket[];saved?:{id:string;name:string;url:string}[];
 reviewer?:boolean;onRefresh?:()=>void;
}){
 const [day,setDay]=useState(currentDay);
 const [month,setMonth]=useState(()=>startMonth(currentDay()));
 const [requestId,setRequestId]=useState('');
 const [start,setStart]=useState('09:00');
 const [end,setEnd]=useState('10:00');
 const [note,setNote]=useState('');
 const [selectedProvider,setSelectedProvider]=useState('');
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [options,setOptions]=useState<Options>({});
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [showProviderList,setShowProviderList]=useState(false);
 const candidates=tickets.filter(t=>!['completed','cancelled','closed'].includes(t.status)&&
  !['confirmed','on_my_way','arrived','in_progress'].includes(t.status)&&t.providerStatus!=='Booking confirmed');
 useEffect(()=>{if(!requestId&&candidates.length)setRequestId(candidates[0].reference)},[candidates,requestId]);
 const load=useCallback(async(id:string)=>{
  const url='/api/account/calendar'+(id?'?requestId='+encodeURIComponent(id):'');
  const response=await fetch(url,{cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Unable to load your calendar');
  setBookings(Array.isArray(data.bookings)?data.bookings:[]);
  setOptions(id?data:{});
 },[]);
 useEffect(()=>{
  let live=true;setLoading(true);
  load(requestId).catch(e=>{if(live)setError(e instanceof Error?e.message:'Calendar unavailable')})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[requestId,load]);
 const planned=bookings.find(b=>b.request_id===requestId);
 const match=useMemo(()=>{
  const list=options.providers||[];
  return list.map(p=>({...p,saved:saved.some(s=>s.name.trim().toLowerCase()===p.name.trim().toLowerCase())}))
   .sort((a,b)=>Number(b.saved)-Number(a.saved)||a.name.localeCompare(b.name));
 },[options.providers,saved]);
 const dates=daysForMonth(month);
 const marked=new Set(bookings.map(b=>new Intl.DateTimeFormat('en-CA',{
  timeZone:kenya,year:'numeric',month:'2-digit',day:'2-digit'
 }).format(new Date(b.starts_at))));
 const record=async(action:'save'|'invite')=>{
  if(reviewer){setError('Calendar bookings are disabled in design review mode.');return}
  setBusy(true);setError('');setMessage('');
  try{
   if(!requestId)throw Error('Choose a service request first');
   if(action==='invite'&&!selectedProvider)throw Error('Choose a matching provider first');
   const response=await fetch('/api/account/calendar',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,requestId,providerId:action==='invite'?selectedProvider:undefined,
     startsAt:eastAfricaIso(day,start),endsAt:eastAfricaIso(day,end),note})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||'Unable to save booking');
   setMessage(action==='save'?'Saved to your JiTap calendar. No invitation was sent.':
    'Calendar invitation sent in JiTap. Await the provider’s response; SMS/WhatsApp depend on notification permissions.');
   await load(requestId);
   onRefresh?.();
  }catch(e){setError(e instanceof Error?e.message:'Booking could not be saved')}
  finally{setBusy(false)}
 };
 const proposal=async(bookingId:string,accept:boolean)=>{
  setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/account/calendar',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'respond_proposal',bookingId,accept})
   });
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Could not respond');
   setMessage(accept?'New date accepted and booking confirmed.':'New time declined; choose another provider or date.');
   await load(requestId);onRefresh?.();
  }catch(e){setError(e instanceof Error?e.message:'Unable to respond')}
  finally{setBusy(false)}
 };
 return <section className="jt-customer-calendar" aria-label="Your service calendar">
  <header className="jt-calendar-intro"><CalendarDays size={26}/><div><h1>Calendar</h1>
   <p>Plan your service and invite a matching provider. Scheduled bookings do not use Wave BUZZ.</p></div></header>
  {error&&<p className="jt-calendar-error" role="alert">{error}</p>}
  {message&&<p className="jt-calendar-success" role="status">{message}</p>}
  <div className="jt-calendar-month">
   <div className="jt-calendar-month-header">
    <button type="button" aria-label="Previous month" onClick={()=>setMonth(shiftMonth(month,-1))}><ChevronLeft size={21}/></button>
    <strong>{new Intl.DateTimeFormat('en-KE',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'T12:00:00Z'))}</strong>
    <button type="button" aria-label="Next month" onClick={()=>setMonth(shiftMonth(month,1))}><ChevronRight size={21}/></button>
   </div>
   <div className="jt-calendar-grid">
    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span key={d} className="jt-calendar-weekday">{d}</span>)}
    {dates.map((d,i)=>d?<button type="button" key={d} className={(day===d?'selected ':'')+(marked.has(d)?'has-booking':'')}
     aria-pressed={day===d} onClick={()=>setDay(d)}>{Number(d.slice(-2))}</button>:
     <span key={'empty'+i} aria-hidden="true"/>)}
   </div>
  </div>
  <div className="jt-calendar-entry">
   <h2>Schedule a service</h2>
   <label htmlFor="jt-calendar-request">Service request</label>
   <select id="jt-calendar-request" value={requestId} onChange={e=>{setRequestId(e.target.value);setSelectedProvider('');setShowProviderList(false)}}>
    {!candidates.length&&<option value="">No eligible requests</option>}
    {candidates.map(t=><option key={t.reference} value={t.reference}>{t.category.replaceAll('-',' ')} · {t.serviceId}</option>)}
   </select>
   {!candidates.length&&<p className="jt-calendar-help">Start by creating a service request. Your service details help JiTap find eligible fundis. <Link href="/request">Request a service</Link></p>}
   {requestId&&<>
    <div className="jt-calendar-datetime">
     <label>Date<input type="date" value={day} min={currentDay()} onChange={e=>{setDay(e.target.value);setMonth(startMonth(e.target.value))}}/></label>
     <label>Start (EAT)<input type="time" value={start} onChange={e=>setStart(e.target.value)}/></label>
     <label>End (EAT)<input type="time" value={end} onChange={e=>setEnd(e.target.value)}/></label>
    </div>
    <label htmlFor="jt-calendar-note">Instructions (optional)</label>
    <textarea id="jt-calendar-note" value={note} onChange={e=>setNote(e.target.value)}
     placeholder="Anything the provider should know before arriving?" maxLength={500} rows={2}/>
    <div className="jt-calendar-provider-picker">
     <div><strong>Choose a provider</strong><small>{options.request?.category||''} · {options.request?.area||''}</small></div>
     <button type="button" onClick={()=>setShowProviderList(v=>!v)} disabled={loading}>
      {selectedProvider?match.find(p=>p.id===selectedProvider)?.name||'Change provider':'Find matching providers'}
     </button>
    </div>
    {showProviderList&&<div className="jt-calendar-providers" role="radiogroup" aria-label="Matching service providers">
     {!match.length?<p>No approved providers in this trade and area yet. Save your plan and try again later.</p>:
      match.map(p=><label key={p.id} className={selectedProvider===p.id?'selected':''}>
       <input type="radio" name="calendar-provider" value={p.id} checked={selectedProvider===p.id}
        onChange={()=>setSelectedProvider(p.id)}/>
       <span><strong>{p.name}</strong><small>{p.saved?'Saved provider · ':'Matching trade and service area'}JiTap verified</small></span>
      </label>)}
    </div>}
    {planned&&<div className="jt-calendar-status" role="status">
     <strong>{planned.status==='draft'?'Saved plan':planned.status==='pending'?'Awaiting provider response':
      planned.status==='proposed'?'Provider proposed a new time':planned.status==='accepted'?'Booking confirmed':'Provider declined'}</strong>
     <small>{dt(planned.starts_at)}{planned.status==='proposed'&&planned.proposed_start_at?
      ' · Proposed: '+dt(planned.proposed_start_at):''}</small>
     {planned.status==='proposed'&&<div className="jt-calendar-proposal-actions">
      <button type="button" disabled={busy} onClick={()=>void proposal(planned.id,true)}>Accept proposed time</button>
      <button type="button" disabled={busy} onClick={()=>void proposal(planned.id,false)}>Decline proposed time</button>
     </div>}
    </div>}
    <div className="jt-calendar-ctas">
     <button type="button" disabled={busy||loading||!options.canSchedule||
      planned?.status==='pending'||planned?.status==='proposed'||planned?.status==='accepted'}
      className="secondary" onClick={()=>void record('save')}>Save for later</button>
     <button type="button" disabled={busy||loading||!selectedProvider||!options.canSchedule||
      planned?.status==='pending'||planned?.status==='proposed'||planned?.status==='accepted'}
      onClick={()=>void record('invite')}><Send size={17}/> Invite provider</button>
    </div>
   </>}
  </div>
  <div className="jt-calendar-bookings"><h2>My scheduled bookings</h2>
   {loading?<p>Loading calendar…</p>:!bookings.length?<p>No scheduled bookings yet.</p>:
    bookings.map(b=><article key={b.id}>
     <div><CalendarDays size={20}/><strong>{dt(b.starts_at)}</strong></div>
     <p>{tickets.find(t=>t.reference===b.request_id)?.category.replaceAll('-',' ')||'Service'} · JT-{b.request_id.slice(0,8).toUpperCase()}</p>
     <small>{b.status==='pending'?'Awaiting provider':b.status==='proposed'?'New time proposed — your decision needed':
      b.status==='accepted'?'Confirmed':b.status==='declined'?'Declined — choose another provider':'Saved draft'}</small>
     {b.status==='proposed'&&b.proposed_start_at&&<div className="jt-calendar-proposal-actions">
      <span>Suggested {dt(b.proposed_start_at)}</span>
      <button disabled={busy} onClick={()=>void proposal(b.id,true)}>Accept</button>
      <button disabled={busy} onClick={()=>void proposal(b.id,false)}>Decline</button>
     </div>}
     {b.status==='accepted'&&<span className="jt-calendar-confirmed"><CheckCircle2 size={14}/> Confirmed</span>}
    </article>)}
  </div>
 </section>;
}
