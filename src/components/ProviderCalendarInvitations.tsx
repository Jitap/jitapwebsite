'use client';
import {useCallback,useEffect,useState} from 'react';
import {CalendarCheck2,CalendarClock,CheckCircle2,XCircle} from 'lucide-react';
import './provider-calendar-invitations.css';

type Invite={
 id:string;requestId:string;serviceId:string;category:string;area:string;
 summary:string;startsAt:string;endsAt:string;note:string;
 status:string;proposedStartAt:string|null;proposedEndAt:string|null;responseNote:string;
};
const dt=(s:string)=>new Intl.DateTimeFormat('en-KE',{
 timeZone:'Africa/Nairobi',dateStyle:'medium',timeStyle:'short'
}).format(new Date(s))+' EAT';
const local=(iso:string)=>new Date(Date.parse(iso)+3*3600000).toISOString().slice(0,16);
function toIso(value:string){return new Date(value+':00+03:00').toISOString()}
export function ProviderCalendarInvitations({onUpdated}:{onUpdated?:()=>void}){
 const [invitations,setInvitations]=useState<Invite[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [proposing,setProposing]=useState<string|null>(null);
 const [start,setStart]=useState('');
 const [note,setNote]=useState('');
 const load=useCallback(async()=>{
  const r=await fetch('/api/provider/calendar/invitations',{cache:'no-store'});
  if(!r.ok)return;
  const data=await r.json() as {invitations?:Invite[]};
  setInvitations(data.invitations||[]);
 },[]);
 useEffect(()=>{
  void load();
  const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void load()},20000);
  const onVisible=()=>{if(document.visibilityState==='visible')void load()};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',onVisible)};
 },[load]);
 const pending=invitations.filter(i=>['pending','proposed','change_requested','change_proposed'].includes(i.status));
 const highlighted=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('booking'):null;
 useEffect(()=>{if(!highlighted||!pending.some(i=>i.id===highlighted))return;
  const timer=window.setTimeout(()=>document.getElementById('jt-booking-invite-'+highlighted)?.scrollIntoView({behavior:'smooth',block:'center'}),280);
  return()=>window.clearTimeout(timer);
 },[highlighted,pending.length]);
 async function respond(inv:Invite,action:'accept'|'decline'|'propose'|'accept_change'|'decline_change'|'propose_change'){
  setBusy(true);setError('');setMessage('');
  try{
   const payload:Record<string,unknown>={action,bookingId:inv.id};
   if(action==='propose'||action==='propose_change'){
    if(!start)throw Error('Choose the new arrival date and time.');
    payload.startsAt=toIso(start);payload.endsAt=new Date(Date.parse(toIso(start))+3600000).toISOString();payload.note=note;
   }
   const r=await fetch('/api/provider/calendar/invitations',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
   });
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(data.error||'Unable to respond to invitation');
   setProposing(null);
   setMessage(action==='accept'||action==='accept_change'?'Booking date confirmed.':
    action==='decline'||action==='decline_change'?'Request declined.':
    'New time proposed. Awaiting customer approval.');
   await load();onUpdated?.();
  }catch(e){setError(e instanceof Error?e.message:'Booking response failed')}
  finally{setBusy(false)}
 }
 return <section className="jt-provider-calendar-invites" aria-label="Scheduled service invitations">
  <div className="jt-provider-invites-header"><CalendarCheck2 size={22}/><div>
   <h2>Scheduled booking invitations</h2>
   <p>Respond to customer-scheduled work. These invitations do not use Wave BUZZ.</p>
  </div>{pending.length>0&&<b>{pending.length}</b>}</div>
  {error&&<p role="alert" className="jt-invite-error">{error}</p>}
  {message&&<p role="status" className="jt-invite-success">{message}</p>}
  {!pending.length?<p className="jt-invite-empty">No scheduled invitations awaiting a response.</p>:
   pending.map(inv=><article key={inv.id} id={'jt-booking-invite-'+inv.id} className={highlighted===inv.id?'highlighted':''}>
    <div className="jt-invite-top"><strong>{inv.category.replaceAll('-',' ')}</strong><small>{inv.serviceId}</small></div>
    <p>{inv.summary||'Customer service booking'} · {inv.area}</p>
    <div className="jt-invite-dates"><CalendarClock size={17}/><span>Arrival {dt(inv.startsAt)}</span></div>
    {inv.note&&<p className="jt-invite-note">{inv.note}</p>}
    {inv.status==='proposed'||inv.status==='change_proposed'?<div className="jt-invite-awaiting">
     <CheckCircle2 size={17}/> New time proposed for {inv.proposedStartAt?dt(inv.proposedStartAt):'this appointment'} — awaiting customer response.
    </div>:<>
     {inv.status==='change_requested'&&<p><strong>Customer requested a different time: {inv.proposedStartAt?dt(inv.proposedStartAt):'See updated time'}</strong></p>}
     <div className="jt-invite-actions">
      <button type="button" disabled={busy} onClick={()=>void respond(inv,inv.status==='change_requested'?'accept_change':'accept')}><CheckCircle2 size={17}/> Accept {inv.status==='change_requested'?'new time':'booking'}</button>
      <button type="button" disabled={busy} onClick={()=>void respond(inv,inv.status==='change_requested'?'decline_change':'decline')}><XCircle size={17}/> Decline</button>
      <button type="button" disabled={busy} onClick={()=>{
       setProposing(inv.id);setStart(local(inv.startsAt));setNote('');
      }}><CalendarClock size={17}/> Reschedule</button>
     </div>
     {proposing===inv.id&&<div className="jt-invite-reschedule">
      <strong>Propose a different time</strong>
      <label>Start (EAT)<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label>
      <label>End (EAT)<input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></label>
      <label>Reason (optional)<textarea rows={2} maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label>
      <div><button type="button" disabled={busy} onClick={()=>void respond(inv,inv.status==='change_requested'?'propose_change':'propose')}>Send new time</button>
       <button type="button" onClick={()=>setProposing(null)}>Cancel</button></div>
     </div>}
    </>}
   </article>)}
 </section>;
}
