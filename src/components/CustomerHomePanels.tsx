'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {
 ArrowRight,CalendarDays,Check,ChevronRight,ClipboardList,Clock3,MapPin,Phone,UserRound
} from 'lucide-react';
import type {CustomerTicket} from '@/components/CustomerTicketCard';
import {customerProgressStage,customerProgressSteps} from '@/lib/customer-progress';
import {SERVICE_OPTIONS} from '@/lib/provider-options';

const serviceIcons:Record<string,string>={
 plumbing:'🚰',electrical:'⚡',cleaning:'🧹',moving:'🚚',carpentry:'🪚',
 'general-repairs':'🛠️',painting:'🎨',masonry:'🧱',tiling:'🧩',
 'solar-security':'📹','appliance-repair':'🔧',
 'computer-phone-repair':'💻',roofing:'🏠','pest-control':'🐜',
 welding:'⚙️','other-services':'✨'
};
const services=SERVICE_OPTIONS.map(s=>({name:s.label,slug:s.value,icon:serviceIcons[s.value]||'🛠️'}));
const steps=customerProgressSteps;

function dateLabel(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return 'Date to be confirmed';
 const d=new Date(value+'T12:00:00Z');
 return d.toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
}
function requestTime(ticket:CustomerTicket){
 return ticket.time?dateLabel(ticket.date)+' · '+ticket.time+' EAT':dateLabel(ticket.date);
}

type Props={
 current:CustomerTicket|null;
 activeCount:number;
 loading:boolean;
 error:string;
 reviewer:boolean;
 onRetry:()=>void;
 onOpenRequests:()=>void;
};

export function CustomerHomePanels({current,activeCount,loading,error,reviewer,onRetry,onOpenRequests}:Props){
 const rail=useRef<HTMLDivElement>(null);
 const [back,setBack]=useState(false);
 const [forward,setForward]=useState(true);
 const refresh=useCallback(()=>{
  const element=rail.current;
  if(!element)return;
  setBack(element.scrollLeft>4);
  setForward(element.scrollLeft+element.clientWidth<element.scrollWidth-4);
 },[]);
 useEffect(()=>{
  const onResize=()=>refresh();
  refresh();
  window.addEventListener('resize',onResize);
  return()=>window.removeEventListener('resize',onResize);
 },[refresh,loading]);
 const scroll=(direction:-1|1)=>{
  if(!rail.current)return;
  rail.current.scrollBy({left:direction*Math.max(190,rail.current.clientWidth*.75),behavior:'smooth'});
 };
 const stage=current?customerProgressStage(current.status):0;
 const matching=current?.category?services.find(s=>s.slug===current.category):undefined;
 return <>
  {loading?<section className="jt-glass-current" aria-label="Loading request summary">
   <div className="jt-glass-section-head jt-glass-current-heading"><h2><Clock3 size={25}/> My Current Request</h2></div>
   <div className="jt-glass-request-card jt-home-request-skeleton" role="status" aria-live="polite">
    <span className="jt-home-skeleton-line is-wide"/><span className="jt-home-skeleton-line"/>
    <span className="jt-home-skeleton-line is-short"/><span className="jt-home-skeleton-button"/>
   </div>
  </section>:error?<section className="jt-glass-current" aria-label="Request status unavailable">
   <div className="jt-glass-section-head jt-glass-current-heading"><h2><Clock3 size={25}/> My Current Request</h2></div>
   <div className="jt-glass-request-card jt-home-request-error" role="alert">
    <p>We couldn't refresh your requests. Your existing bookings haven't been changed.</p>
    <button type="button" onClick={onRetry}>Try again</button>
   </div>
  </section>:current?<section className="jt-glass-current" aria-labelledby="jt-glass-current-title">
   <div className="jt-glass-section-head jt-glass-current-heading">
    <h2 id="jt-glass-current-title"><Clock3 size={25}/> {activeCount>1?'My Current Requests ('+activeCount+')':'My Current Request'}</h2>
    {activeCount>1&&<button type="button" className="jt-home-all-requests" onClick={onOpenRequests}>View All Requests <ChevronRight size={17}/></button>}
   </div>
   <article className="jt-glass-request-card jt-home-priority-card">
    <div className="jt-glass-request-top">
     <span className="jt-glass-request-service-icon" aria-hidden="true">{matching?.icon||'🛠️'}</span>
     <div className="jt-home-request-identity">
      <h3>{matching?.name||current.category.replaceAll('-',' ')}</h3>
      <span className="jt-glass-state">{current.statusLabel||'Received'}</span>
     </div>
     <small>{current.serviceId}</small>
    </div>
    <div className="jt-glass-request-details">
     <div><UserRound size={18}/><span>{current.provider||'To be matched'}</span></div>
     <div><CalendarDays size={18}/><span>{requestTime(current)}</span></div>
     <div><MapPin size={18}/><span>{current.location||current.area||'Location to be confirmed'}</span></div>
    </div>
    <ol className={'jt-glass-progress jt-home-progress is-stage-'+stage} aria-label="Request progress">
     {steps.map((label,index)=><li key={label} className={index<stage?'is-done':index===stage?'is-current':''} aria-current={index===stage?'step':undefined}>
      <span className="jt-glass-step-mark">{index<stage?<Check size={14} strokeWidth={3}/>:index===stage?<span className="jt-glass-step-dot"/>:null}</span>
      <small>{label}</small>
     </li>)}
    </ol>
    {current.rematch&&<div className="jt-glass-request-alert" role="status">
     Your provider has cancelled. Please review your rematch options.
     <button type="button" onClick={onOpenRequests}>Review now</button>
    </div>}
    <div className="jt-home-request-footer">
     <Link className="jt-home-view-request" href={'/track?ref='+encodeURIComponent(current.serviceId)}>
      View Request <ChevronRight size={23}/>
     </Link>
     {!!current.providerPhone&&<a className="jt-home-call-provider" href={'tel:'+current.providerPhone.replace(/[^+\d]/g,'')}>
      <Phone size={17}/> Call Provider
     </a>}
    </div>
   </article>
  </section>:null}
  <section className="jt-glass-explore" aria-labelledby="jt-glass-explore-title">
   <div className="jt-glass-section-head">
    <h2 id="jt-glass-explore-title">Explore Services</h2>
    <div className="jt-glass-explore-controls">
     <span className="jt-glass-swipe-hint">Swipe to explore</span>
     <button type="button" className="jt-glass-carousel-arrow" onClick={()=>scroll(-1)} disabled={!back} aria-label="Previous services"><ChevronRight size={19} style={{transform:'rotate(180deg)'}}/></button>
     <button type="button" className="jt-glass-carousel-arrow" onClick={()=>scroll(1)} disabled={!forward} aria-label="Next services"><ChevronRight size={19}/></button>
     <Link href="/services">View All <ChevronRight size={19}/></Link>
    </div>
   </div>
   <div className="jt-glass-services" ref={rail} onScroll={refresh} role="region" aria-label="Service categories, swipe horizontally">
    {services.map(service=><Link key={service.slug} href={reviewer?'/services':'/request?category='+encodeURIComponent(service.slug)} className="jt-glass-service-tile">
     <span className="jt-glass-service-icon" aria-hidden="true">{service.icon}</span>
     <strong>{service.name}</strong>
    </Link>)}
   </div>
  </section>
 </>;
}
