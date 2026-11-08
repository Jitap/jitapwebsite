'use client';
import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeft,CalendarDays,ChevronLeft,ChevronRight,Clock3,MapPin,Navigation,Phone,SlidersHorizontal,UserRound,X,CheckCircle2,Plus} from 'lucide-react';
import './calendar.css';
import {ProviderJobAction} from '@/components/ProviderJobAction';
import {ProviderTravelEstimate} from '@/components/ProviderTravelEstimate';
import {ProviderNewJob} from '@/components/ProviderNewJob';

type Appointment={
 id:string;requestId:string;startsAt:string|null;endsAt:string|null;status:string;rated:boolean;
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
 const [bucket,setBucket]=useState<'in_progress'|'completed'|null>(null);
 const [expandedDescription,setExpandedDescription]=useState(false);
 const [filterOpen,setFilterOpen]=useState(false);
 const [showReschedule,setShowReschedule]=useState(false);
 const [showCancel,setShowCancel]=useState(false);
 const [newJobOpen,setNewJobOpen]=useState(false);
 const [cancelReason,setCancelReason]=useState('');
 const [cancelDetails,setCancelDetails]=useState('');
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
 const active=appointments.filter(a=>!['cancelled','completed'].includes(a.status));
 const unscheduled=active.filter(a=>!a.startsAt||!a.endsAt);
 const detail=appointments.find(a=>a.id===detailId&&a.status!=='cancelled');
 const filteredJobs=appointments.filter(a=>bucket==='completed'?a.status==='completed':['confirmed','on_my_way','arrived','in_progress'].includes(a.status));
 const dayJobs=active.filter(a=>a.startsAt&&a.endsAt&&dayKey(a.startsAt)===selected).sort((a,b)=>(a.startsAt||'').localeCompare(b.startsAt||''));
 const start=startWeek(selected);
 const days=useMemo(()=>{
  if(!monthView)return Array.from({length:7},(_,i)=>addDays(start,i));
  const first=selected.slice(0,7)+'-01';
  const base=startWeek(first);
  return Array.from({length:42},(_,i)=>addDays(base,i));
 },[selected,monthView,start]);
 const monthLabel=fmt(dayDate(selected),{month:'long',year:'numeric'});
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const selectedBucket=params.get('bucket');
  if(selectedBucket==='completed'||selectedBucket==='in_progress')setBucket(selectedBucket);
 },[]);
 useEffect(()=>{if(!appointments.length)return;const job=new URLSearchParams(window.location.search).get('job');if(job){const found=appointments.find(a=>a.requestId===job&&a.status!=='cancelled');if(found)setDetailId(found.id)}},[appointments]);
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
 async function cancelJob(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!detail||!cancelReason)return;
  const result=await send({action:'cancel',appointmentId:detail.id,reason:cancelReason,details:cancelDetails});
  if(result){setShowCancel(false);setDetailId(null);setMessage('Your cancellation was recorded. The customer must approve a rematch.')}
 }
 const cancellationOptions=[
  {value:'schedule_conflict',label:'Scheduling conflict'},
  {value:'unavailable',label:'I am no longer available'},
  {value:'too_far',label:'Location is too far'},
  {value:'tools_or_skills',label:'Required tools or skills unavailable'},
  {value:'scope_changed',label:'Scope of work has changed'},
  {value:'personal_emergency',label:'Personal emergency'},
  {value:'other',label:'Other reason'}
 ];
 async function reschedule(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!detail)return;
  const start=new Date(newDate+'T'+newStart+':00+03:00'),end=new Date(newDate+'T'+newEnd+':00+03:00');
  if(!(end>start)){setError('End time must be after start time');return}
  const result=await send({action:'reschedule',appointmentId:detail.id,start:start.toISOString(),end:end.toISOString(),reason});
  if(result){setShowReschedule(false);setMessage('Reschedule sent for confirmation. Your current appointment remains unchanged.')}
 }
 return <main className="jcal-app"><div className="jcal-phone">
  {detail?<div className="jcal-details">
   <header className="jcal-detail-heading"><button aria-label="Back to calendar" onClick={()=>{setDetailId(null);setExpandedDescription(false);setError('');setMessage('')}}><ArrowLeft size={22}/></button><strong>Scheduled Work</strong></header>
   <h1>{detail.title}</h1><p className="jcal-subtitle">{detail.category||'Service'} · {detail.area||detail.location}</p>
   <section className="jcal-customer"><div className="jcal-avatar"><UserRound size={27}/></div><div><h2>{detail.customerName}</h2><p><CheckCircle2 size={17}/> Scheduled customer</p></div>{detail.customerPhone&&<a href={'tel:'+detail.customerPhone.replace(/[^+0-9]/g,'')} className="jcal-call"><Phone size={16}/> Call Now</a>}</section>
   <section className="jcal-map" aria-label="Appointment map">
    {detail.location&&(detail.latitude!==null&&detail.longitude!==null?
      <iframe title={'Google Maps: '+detail.location} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={'https://maps.google.com/maps?q='+encodeURIComponent(detail.latitude+','+detail.longitude)+'&z=15&output=embed'}/>:
      <div className="jcal-map-placeholder"><MapPin size={24}/><span>{detail.location}</span></div>)}
    <ProviderTravelEstimate job={detail}/>
   </section>
   <section className="jcal-info"><h2>Schedule</h2><p><CalendarDays size={20}/>{detail.startsAt&&detail.endsAt?dateTime(detail.startsAt)+' · '+time(detail.startsAt)+' – '+time(detail.endsAt):'Confirmed · Date and time to arrange'}</p>{detail.pendingReschedule&&<p className="jcal-pending"><Clock3 size={18}/> Reschedule awaiting JiTap confirmation</p>}</section>
   <section className="jcal-info jcal-service-brief"><h2>Service details</h2><p className={expandedDescription?'jcal-description-expanded':'jcal-description-clamped'}>{detail.description||'The confirmed service request is scheduled for this time.'}</p>{(detail.description||'').length>115&&<button type="button" className="jcal-description-toggle" onClick={()=>setExpandedDescription(x=>!x)}>{expandedDescription?'Show less':'Read full details'}</button>}<p className="jcal-ref">Ref: JT-{detail.requestId.slice(0,8).toUpperCase()}</p></section>
   {error&&<p role="alert" className="jcal-error">{error}</p>}{message&&<p role="status" className="jcal-success">{message}</p>}
   <div className="jcal-detail-actions"><ProviderJobAction key={detail.id} appointmentId={detail.id} status={detail.status} rated={detail.rated} onUpdated={async(nextStatus)=>{
     if(nextStatus&&nextStatus!=='rated')setAppointments(rows=>rows.map(row=>row.id===detail.id?{...row,status:nextStatus}:row));
     if(nextStatus==='rated')setAppointments(rows=>rows.map(row=>row.id===detail.id?{...row,rated:true}:row));
     await load();
    }}/><button type="button" className="jcal-secondary" disabled={busy||!!detail.pendingReschedule||!['confirmed','on_my_way'].includes(detail.status)} onClick={()=>openReschedule(detail)}>Reschedule</button><button type="button" className="jcal-cancel-action" disabled={busy||!['confirmed','on_my_way','arrived','in_progress'].includes(detail.status)} onClick={()=>{setCancelReason('');setCancelDetails('');setError('');setShowCancel(true)}}>Cancel job</button></div>
  </div>:bucket?<section className="jcal-bucket-view">
   <header className="jcal-detail-heading"><button aria-label="Return to provider home" onClick={()=>router.push('/provider')}><ArrowLeft size={22}/></button><strong>{bucket==='completed'?'Completed Jobs':'In Progress'}</strong></header>
   <p className="jcal-bucket-intro">{bucket==='completed'?'Your completed service history and customer ratings.':'Accepted and ongoing work. Choose a task to view its details and next action.'}</p>
   {loading?<p className="jcal-state">Loading jobs…</p>:filteredJobs.length===0?<div className="jcal-bucket-empty"><CalendarDays size={32}/><p>{bucket==='completed'?'No completed jobs yet.':'No active jobs at the moment.'}</p></div>:
    filteredJobs.map(job=><button type="button" className="jcal-bucket-job" key={job.id} onClick={()=>{setExpandedDescription(false);setDetailId(job.id)}}>
     <span className="jcal-bucket-card-top"><strong>{job.title}</strong><ChevronRight size={18}/></span>
     <span>{job.customerName} · {job.location||job.area}</span>
     <small>{job.status==='completed'?(job.rated?'Completed · Customer rated':'Completed · Rate customer'):job.status==='in_progress'?'Work in progress':job.status==='arrived'?'Arrived':job.status==='on_my_way'?'On my way':'Confirmed'}</small>
    </button>)}
  </section>:<>
   <header className="jcal-header"><div><h1>Calendar</h1><p>{monthLabel}</p></div><div className="jcal-header-actions"><button aria-label="Week or month view" title="Week / Month" onClick={()=>setFilterOpen(v=>!v)}><SlidersHorizontal size={22}/></button><button type="button" aria-label="Create new job" title="Create booking" className="jcal-add-button" onClick={()=>setNewJobOpen(true)}><Plus size={22}/></button></div></header>
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
      return <button key={a.id} style={{top:top+'px',height:Math.max(65,duration*58-5)+'px'}} className={'jcal-event jcal-event-'+i%3} onClick={()=>{setExpandedDescription(false);setDetailId(a.id)}}><span className="jcal-event-dot"/><span><strong>{a.title}</strong><small>{time(a.startsAt!)} – {time(a.endsAt!)}</small><small>{a.location||a.area}</small></span></button>
     })}</div>
    </section>}
   {!loading&&unscheduled.length>0&&<section className="jcal-unscheduled"><h2>Confirmed jobs · Time to arrange</h2>{unscheduled.map(a=><button key={a.id} onClick={()=>setDetailId(a.id)}><strong>{a.title}</strong><span>{a.location||a.area} · Booking confirmed</span><small>View job and tap On my way</small></button>)}</section>}
  </>}
  {newJobOpen&&<ProviderNewJob date={selected} onClose={()=>setNewJobOpen(false)} onCreated={async(requestId)=>{await load();setBucket(null);const url=new URL(window.location.href);url.searchParams.set('job',requestId);window.history.replaceState(null,'',url.pathname+url.search);}}/>}
  {showCancel&&detail&&<div className="jcal-overlay" role="presentation" onClick={()=>setShowCancel(false)}><section className="jcal-sheet" role="dialog" aria-modal="true" aria-labelledby="jcal-cancel-title" onClick={e=>e.stopPropagation()}>
   <header><h2 id="jcal-cancel-title">Cancel Scheduled Work</h2><button onClick={()=>setShowCancel(false)} aria-label="Close"><X size={22}/></button></header>
   <p className="jcal-cancel-explanation">Select why you cannot complete this job. The customer will be notified and asked to approve a rematch. The job will not be offered to others until they approve.</p>
   <form onSubmit={cancelJob}><label>Reason for cancellation<select required value={cancelReason} onChange={e=>setCancelReason(e.target.value)}><option value="">Select a reason</option>{cancellationOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label><label>Additional details {cancelReason==='other'?'(required)':'(optional)'}<textarea maxLength={500} rows={3} value={cancelDetails} onChange={e=>setCancelDetails(e.target.value)} placeholder="Briefly explain the cancellation" required={cancelReason==='other'}/></label>{error&&<p role="alert" className="jcal-error">{error}</p>}<button className="jcal-primary" type="submit" disabled={busy||!cancelReason}>{busy?'Submitting…':'Confirm cancellation'}</button><button type="button" className="jcal-secondary" onClick={()=>setShowCancel(false)}>Keep this job</button></form>
  </section></div>}
  {showReschedule&&detail&&<div className="jcal-overlay" role="presentation" onClick={()=>setShowReschedule(false)}><section className="jcal-sheet" role="dialog" aria-modal="true" aria-labelledby="jcal-reschedule-title" onClick={e=>e.stopPropagation()}>
   <header><h2 id="jcal-reschedule-title">Reschedule Appointment</h2><button onClick={()=>setShowReschedule(false)} aria-label="Close"><X size={22}/></button></header>
   <form onSubmit={reschedule}><label>Date<input type="date" min={today} required value={newDate} onChange={e=>setNewDate(e.target.value)}/></label><div className="jcal-time-fields"><label>Start time<input type="time" required value={newStart} onChange={e=>setNewStart(e.target.value)}/></label><label>End time<input type="time" required value={newEnd} onChange={e=>setNewEnd(e.target.value)}/></label></div><label>Reason (optional)<input maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. I have another job at this time."/></label><p className="jcal-sheet-note">JiTap will coordinate this request. The existing time remains confirmed until approved.</p><button disabled={busy} className="jcal-primary">{busy?'Submitting…':'Confirm'}</button></form>
  </section></div>}
 </div></main>;
}
