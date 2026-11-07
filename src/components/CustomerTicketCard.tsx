'use client';
import Link from 'next/link';
import {CalendarDays,Clock3,MapPin,UserRoundCheck,ClipboardList,ArrowUpRight} from 'lucide-react';

export type CustomerTicket={
 reference:string;serviceId:string;category:string;date:string;time:string;location:string;area:string;
 provider:string;providerPhone?:string;providerStatus:string;status:string;statusLabel:string;brief:string;scope:string;
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
 return <article className={'jt-ticket-structured'+(detail?' jt-ticket-detail':'')}>
  <div className="jt-ticket-top"><div><span className="jt-ticket-kicker">SERVICE REQUEST</span><h2>{ticket.category.replaceAll('-',' ')}</h2></div><span className="jt-ticket-status">{ticket.statusLabel}</span></div>
  <dl className="jt-ticket-fields">
   <div><dt><ClipboardList size={16}/> Reference</dt><dd>{ticket.serviceId}</dd></div>
   <div><dt><CalendarDays size={16}/> Date</dt><dd>{dateText(ticket.date)}</dd></div>
   <div><dt><Clock3 size={16}/> Time</dt><dd>{timeText(ticket.time)}</dd></div>
   <div><dt><MapPin size={16}/> Location</dt><dd>{ticket.location||'To be confirmed'}</dd></div>
   <div className="jt-ticket-field-wide"><dt><UserRoundCheck size={16}/> Provider</dt><dd>{ticket.provider}<small>{ticket.providerStatus}</small>{ticket.providerPhone&&<a href={'tel:'+ticket.providerPhone.replace(/[^+0-9]/g,'')} style={{display:'inline-block',marginTop:8,color:'#087eec',fontWeight:700}}>Call provider: {ticket.providerPhone}</a>}</dd></div>
  </dl>
  <div className="jt-ticket-brief"><strong>Service brief</strong><p>{ticket.brief}</p>{ticket.scope&&<p className="jt-ticket-scope"><b>Preliminary scope:</b> {ticket.scope}</p>}</div>
  <div className="jt-ticket-bottom"><small>Last updated {new Date(ticket.updatedAt).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'})}</small>
   {!detail&&<Link href={'/track?ref='+encodeURIComponent(ticket.serviceId)}>Track progress <ArrowUpRight size={16}/></Link>}
  </div>
 </article>;
}
