'use client';
import Link from 'next/link';
import {useState} from 'react';
import {CalendarDays,Clock3,MapPin,UserRoundCheck,ClipboardList,ArrowUpRight} from 'lucide-react';

export type CustomerTicket={
 reference:string;serviceId:string;category:string;date:string;time:string;location:string;area:string;
 provider:string;providerPhone?:string;providerStatus:string;rematch?:{reason:string;details:string}|null;status:string;statusLabel:string;brief:string;scope:string;
 createdAt:string;updatedAt:string;
};
function dateText(value:string){
 if(!value)return 'To be confirmed';
 const [year,month,day]=value.split('-').map(Number);
 if(!year||!month||!day)return 'To be confirmed';
 return new Intl.DateTimeFormat('en-KE',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,day)));
}
function timeText(value:string){return value?value+' EAT':'To be confirmed'}
export function CustomerTicketCard({ticket,detail=false}:{ticket:CustomerTicket;detail?:boolean}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function decideRematch(approve:boolean){setBusy(true);setError('');try{const res=await fetch('/api/account/rematch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:ticket.reference,approve})});const data=await res.json();if(!res.ok)throw Error(data.error||'Unable to save decision');window.location.reload()}catch(e){setError(e instanceof Error?e.message:'Unable to save decision');setBusy(false)}}
 const reasons:Record<string,string>={schedule_conflict:'Scheduling conflict',unavailable:'No longer available',too_far:'Unable to travel to the location',tools_or_skills:'Required equipment or skills unavailable',scope_changed:'Job scope changed',personal_emergency:'Personal emergency',other:'Other reason'};
 return <article className={'jt-ticket-structured'+(detail?' jt-ticket-detail':'')}>
  <div className="jt-ticket-top"><div><span className="jt-ticket-kicker">SERVICE REQUEST</span><h2>{ticket.category.replaceAll('-',' ')}</h2></div><span className="jt-ticket-status">{ticket.statusLabel}</span></div>
  <dl className="jt-ticket-fields">
   <div><dt><ClipboardList size={16}/> Reference</dt><dd>{ticket.serviceId}</dd></div>
   <div><dt><CalendarDays size={16}/> Date</dt><dd>{dateText(ticket.date)}</dd></div>
   <div><dt><Clock3 size={16}/> Time</dt><dd>{timeText(ticket.time)}</dd></div>
   <div><dt><MapPin size={16}/> Location</dt><dd>{ticket.location||'To be confirmed'}</dd></div>
   <div className="jt-ticket-field-wide"><dt><UserRoundCheck size={16}/> Provider</dt><dd>{ticket.provider}<small>{ticket.providerStatus}</small>{ticket.providerPhone&&<a href={'tel:'+ticket.providerPhone.replace(/[^+0-9]/g,'')} style={{display:'inline-block',marginTop:8,color:'#087eec',fontWeight:700}}>Call provider: {ticket.providerPhone}</a>}</dd></div>
  </dl>
  {ticket.rematch&&<section className="jt-ticket-rematch" aria-label="Rematch approval required" style={{margin:'17px 0',padding:16,border:'1px solid #f0c48c',borderRadius:13,background:'#fff9ef'}}>
   <h3 style={{fontSize:18,color:'#163a74',margin:'0 0 8px'}}>Your provider has cancelled</h3>
   <p style={{fontSize:14,color:'#4b6177',margin:'0 0 7px'}}><strong>Reason:</strong> {reasons[ticket.rematch.reason]||'Provider unavailable'}</p>
   {ticket.rematch.details&&<p style={{fontSize:13,color:'#64748b',margin:'0 0 9px'}}>{ticket.rematch.details}</p>}
   <p style={{fontSize:14,color:'#163a74'}}>Would you like JiTap to reopen this same request so another eligible provider can accept it?</p>
   <div style={{display:'grid',gap:9,gridTemplateColumns:'1fr 1fr'}}>
    <button type="button" disabled={busy} onClick={()=>void decideRematch(true)} style={{background:'#00c45b',color:'#fff',border:0,borderRadius:10,padding:'12px 6px',fontWeight:700,cursor:'pointer'}}>Approve rematch</button>
    <button type="button" disabled={busy} onClick={()=>void decideRematch(false)} style={{background:'#fff',color:'#163a74',border:'1px solid #163a74',borderRadius:10,padding:'12px 6px',fontWeight:700,cursor:'pointer'}}>No, close request</button>
   </div>{error&&<p role="alert" style={{color:'#b62632',fontSize:13}}>{error}</p>}
  </section>}
  <div className="jt-ticket-brief"><strong>Service brief</strong><p>{ticket.brief}</p>{ticket.scope&&<p className="jt-ticket-scope"><b>Preliminary scope:</b> {ticket.scope}</p>}</div>
  <div className="jt-ticket-bottom"><small>Last updated {new Date(ticket.updatedAt).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'})}</small>
   {!detail&&<Link href={'/track?ref='+encodeURIComponent(ticket.serviceId)}>Track progress <ArrowUpRight size={16}/></Link>}
  </div>
 </article>;
}
