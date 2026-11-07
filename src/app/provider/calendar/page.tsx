'use client';
import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft,CalendarDays,ChevronLeft,ChevronRight,Clock3,MapPin,Navigation,Phone,SlidersHorizontal,UserRound,X,CheckCircle2} from 'lucide-react';
import './calendar.css';

type Appointment={
 id:string;requestId:string;startsAt:string|null;endsAt:string|null;status:string;
 title:string;category:string;area:string;location:string;latitude:number|null;longitude:number|null;
 placeId:string;customerName:string;customerPhone:string;description:string;
 pendingReschedule:{id:string;proposed_start_at:string;proposed_end_at:string}|null
};
const tz='Africa/Nairobi';
const fmt=(d:Date,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('en-KE',{timeZone:tz,...options}).format(d);
function dayKey(iso:string|Date){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(iso));
 const p=(s:string)=>parts.find(x=>x.type===s)?.value||'';
 return p('year')+'-'+p('month')+'-'+p('day');
}
const dayDate=(key:string)=>new Date(key+'T12:00:00Z');
const addDays=(key:string,n:number)=>{const d=dayDate(key);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const startWeek=(key:string)=>addDays(key,-dayDate(key).getUTCDay());
const time=(iso:string)=>fmt(new Date(iso),{hour:'numeric',minute:'2-digit',hour12:true});
const dateTime=(iso:string)=>fmt(new Date(iso),{weekday:'short',day:'numeric',month:'short',year:'numeric'});
const hour=(iso:string)=>Number(fmt(new Date(iso),{hour:'numeric',hourCycle:'h23'}))+Number(fmt(new Date(iso),{minute:'2-digit'}))/60;
const directions=(a:Appointment)=>{
 const destination=a.latitude!==null&&a.longitude!==null?a.latitude+','+a.longitude:a.location;
 const parameter=a.placeId?'&destination_place_id='+encodeURIComponent(a.placeId):'';
 return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(destination)+parameter+'&travelmode=driving';
};
export default function ProviderCalendar(){
 const router=useRouter();
 const [today]=useState(()=>dayKey(new Date()));
 const [selected,setSelected]=useState(()=>dayKey(new Date()));
 const [monthView,setMonthView]=useState(false);
 const [appointments,setAppointments]=useState<Appointment[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [detailId,setDetailId]=useState<string|null>(null);
 const [filterOpen,setFilterOpen]=useState(false);
 const [showReschedule,setShowReschedule]=useState(false);
 const [newDate,setNewDate]=useState('');
 const [newStart,setNewStart]=useState('09:00');
 const [newEnd,setNewEnd]=useState('10:00');
 const [reason,setReason]=useState('');
 const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  const res=await fetch('/api/provider/calendar',{cache:'no-store'});
  if(res.status===401){router.replace('/login?mode=login');return}
  const data=await res.json();
  if(!res.ok)throw Error(data.error||'Unable to load calendar');
  setAppointments(data.appointments||[]);
 },[router]);
 useEffect(()=>{let active=true;load().catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[load]);
 const active=appointments.filter(a=>a.status!=='cancelled');
 const unscheduled=active.filter(a=>!a.startsAt||!a.endsAt);
 const detail=active.find(a=>a.id===detailId);
 const dayJobs=active.filter(a=>a.startsAt&&a.endsAt&&dayKey(a.startsAt)===selected).sort((a,b)=>(a.startsAt||'').localeCompare(b.startsAt||''));
 const start=startWeek(selected);
 const days=useMemo(()=>{
  if(!monthView)return Array.from({length:7},(_,i)=>addDays(start,i));
  const first=selected.slice(0,7)+'-01';
  const base=startWeek(first);
  return Array.from({length:42},(_,i)=>addDays(base,i));
 },[selected,monthView,start]);
 const monthLabel=fmt(dayDate(selected),{month:'long',year:'numeric'});
 useEffect(()=>{if(!appointments.length)return;const job=new URLSearchParams(window.location.search).get('job');if(job){const found=appointments.find(a=>a.requestId===job);if(found)setDetailId(found.id)}},[appointments]);
 async function send(body:Record<string,unknown>){
  setBusy(true);setError('');setMessage('');
  try{
   const res=await fetch('/api/provider/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await res.json();
   if(!res.ok)throw Error(data.error||'Could not save action');
   await load();
   return data;
  }catch(e){setError(e instanceof Error?e.message:'Unable to save');return null}
  finally{setBusy(false)}
 }
 function openReschedule(a:Appointment){
  setNewDate(a.startsAt?dayKey(a.startsAt):today);setNewStart(a.startsAt?fmt(new Date(a.startsAt),{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).replace(/\s/g,''):'09:00');setNewEnd(a.endsAt?fmt(new Date(a.endsAt),{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).replace(/\s/g,''):'10:00');setReason('');setShowReschedule(true);
 }
 async function reschedule(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!detail)return;
  const start=new Date(newDate+'T'+newStart+':00+03:00'),end=new Date(newDate+'T'+newEnd+':00+03:00');
  if(!(end>start)){setError('End time must be after start time');return}
  const result=await send({action:'reschedule',appointmentId:detail.id,start:start.toISOString(),end:end.toISOString(),reason});
  if(result){setShowReschedule(false);setMessage('Reschedule sent for confirmation. Your current appointment remains unchanged.')}
 }
 return <main className="jcal-app"><div className="jcal-phone">
  {detail?<div className="jcal-details">
   <header className="jcal-detail-heading"><button aria-label="Back to calendar" onClick={()=>{setDetailId(null);setError('');setMessage('')}}><ArrowLeft size={22}/></button><strong>Scheduled Work</strong></header>
   <h1>{detail.title}</h1><p className="jcal-subtitle">{detail.category||'Service'} · {detail.area||detail.location}</p>
   <section className="jcal-customer"><div className="jcal-avatar"><UserRound size={27}/></div><div><h2>{detail.customerName}</h2><p><CheckCircle2 size={17}/> Scheduled customer</p></div>{detail.customerPhone&&<a href={'tel:'+detail.customerPhone.replace(/[^+0-9]/g,'')} className="jcal-call"><Phone size={16}/> Call Now</a>}</section>
   <section className="jcal-map" aria-label="Appointment map">
    {detail.location&&(detail.latitude!==null&&detail.longitude!==null?
      <iframe title={'Google Maps: '+detail.location} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={'https://maps.google.com/maps?q='+encodeURIComponent(detail.latitude+','+detail.longitude)+'&z=15&output=embed'}/>:
      <div className="jcal-map-placeholder"><MapPin size={24}/><span>{detail.location}</span></div>)}
    <a href={directions(detail)} target="_blank" rel="noopener noreferrer"><Navigation size={17}/> Directions in Google Maps</a>
   </section>
   <section className="jcal-info"><h2>Schedule</h2><p><CalendarDays size={20}/>{detail.startsAt&&detail.endsAt?dateTime(detail.startsAt)+' · '+time(detail.startsAt)+' – '+time(detail.endsAt):'Confirmed · Date and time to arrange'}</p>{detail.pendingReschedule&&<p className="jcal-pending"><Clock3 size={18}/> Reschedule awaiting JiTap confirmation</p>}</section>
   <section className="jcal-info"><h2>Service details</h2><p>{detail.description||'The confirmed service request is scheduled for this time.'}</p><p className="jcal-ref">Ref: JT-{detail.requestId.slice(0,8).toUpperCase()}</p></section>
   {error&&<p role="alert" className="jcal-error">{error}</p>}{message&&<p role="status" className="jcal-success">{message}</p>}
   <div className="jcal-detail-actions"><button className="jcal-primary" disabled={busy||detail.status!=='confirmed'} onClick={async()=>{const r=await send({action:'on_my_way',appointmentId:detail.id});if(r)setMessage('Your status is now On my way.')}}>{detail.status==='on_my_way'?'✓ On my way':busy?'Updating…':'On my way'}</button><button className="jcal-secondary" disabled={busy||!!detail.pendingReschedule} onClick={()=>openReschedule(detail)}>Reschedule</button></div>
  </div>:<>
   <header className="jcal-header"><div><h1>Calendar</h1><p>{monthLabel}</p></div><button aria-label="Calendar view settings" onClick={()=>setFilterOpen(v=>!v)}><SlidersHorizontal size={22}/></button></header>
   {filterOpen&&<div className="jcal-filter"><button onClick={()=>{setMonthView(false);setFilterOpen(false)}}>Week view</button><button onClick={()=>{setMonthView(true);setFilterOpen(false)}}>Month view</button></div>}
   <section className="jcal-date-panel" aria-label="Choose calendar day">
    <div className="jcal-month-switch"><button onClick={()=>setSelected(addDays(selected,monthView?-28:-7))} aria-label="Previous dates"><ChevronLeft size={20}/></button><span>{monthLabel}</span><button onClick={()=>setSelected(addDays(selected,monthView?28:7))} aria-label="Next dates"><ChevronRight size={20}/></button></div>
    <div className="jcal-days-head">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span key={d}>{d}</span>)}</div>
    <div className={'jcal-days '+(monthView?'is-month':'')}>{days.map(d=><button key={d} aria-pressed={selected===d} onClick={()=>setSelected(d)} className={(selected===d?'selected ':'')+(d.slice(0,7)!==selected.slice(0,7)?'muted':'')}><span>{Number(d.slice(-2))}</span>{active.some(a=>a.startsAt&&dayKey(a.startsAt)===d)&&<i aria-label="Appointments scheduled"/>}</button>)}</div>
    <button className="jcal-expand" onClick={()=>setMonthView(v=>!v)} aria-label={monthView?'Collapse calendar':'Expand calendar'}><span/></button>
   </section>
   {loading?<p className="jcal-state" role="status">Loading appointments…</p>:error?<p className="jcal-error" role="alert">{error}</p>:
    active.length===0?<section className="jcal-empty"><img src="/images/approved/mascot-original.png" alt="JiTap assistant with calendar"/><h2>No appointments yet</h2><p>Once you accept a request, it is confirmed and will appear here.</p></section>:
    dayJobs.length===0&&unscheduled.length===0?<section className="jcal-empty jcal-empty-day"><CalendarDays size={56}/><h2>Nothing scheduled for this day</h2><p>Choose another date to see your confirmed appointments.</p></section>:
    <section className="jcal-timeline" aria-label={'Appointments for '+selected}>
     {Array.from({length:14},(_,i)=>i+7).map(h=><div key={h} className="jcal-hour"><span>{h%12||12} {h<12?'AM':'PM'}</span><i/></div>)}
     <div className="jcal-events">{dayJobs.map((a,i)=>{
      const top=Math.max(0,(hour(a.startsAt!)-7)*58);
      const duration=Math.max(1,hour(a.endsAt!)-hour(a.startsAt!));
      return <button key={a.id} style={{top:top+'px',height:Math.max(65,duration*58-5)+'px'}} className={'jcal-event jcal-event-'+i%3} onClick={()=>setDetailId(a.id)}><span className="jcal-event-dot"/><span><strong>{a.title}</strong><small>{time(a.startsAt!)} – {time(a.endsAt!)}</small><small>{a.location||a.area}</small></span></button>
     })}</div>
    </section>}
   {!loading&&unscheduled.length>0&&<section className="jcal-unscheduled"><h2>Confirmed jobs · Time to arrange</h2>{unscheduled.map(a=><button key={a.id} onClick={()=>setDetailId(a.id)}><strong>{a.title}</strong><span>{a.location||a.area} · Booking confirmed</span><small>View job and tap On my way</small></button>)}</section>}
  </>}
  {showReschedule&&detail&&<div className="jcal-overlay" role="presentation" onClick={()=>setShowReschedule(false)}><section className="jcal-sheet" role="dialog" aria-modal="true" aria-labelledby="jcal-reschedule-title" onClick={e=>e.stopPropagation()}>
   <header><h2 id="jcal-reschedule-title">Reschedule Appointment</h2><button onClick={()=>setShowReschedule(false)} aria-label="Close"><X size={22}/></button></header>
   <form onSubmit={reschedule}><label>Date<input type="date" min={today} required value={newDate} onChange={e=>setNewDate(e.target.value)}/></label><div className="jcal-time-fields"><label>Start time<input type="time" required value={newStart} onChange={e=>setNewStart(e.target.value)}/></label><label>End time<input type="time" required value={newEnd} onChange={e=>setNewEnd(e.target.value)}/></label></div><label>Reason (optional)<input maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. I have another job at this time."/></label><p className="jcal-sheet-note">JiTap will coordinate this request. The existing time remains confirmed until approved.</p><button disabled={busy} className="jcal-primary">{busy?'Submitting…':'Confirm'}</button></form>
  </section></div>}
 </div></main>;
}
