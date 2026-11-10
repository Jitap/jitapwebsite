'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ChevronRight,Clock3} from 'lucide-react';
import type {CustomerTicket} from '@/components/CustomerTicketCard';
import {CustomerRequestStack} from '@/components/CustomerRequestStack';
import {SERVICE_OPTIONS} from '@/lib/provider-options';

const serviceIcons:Record<string,string>={
 plumbing:'🚰',electrical:'⚡',cleaning:'🧹',moving:'🚚',carpentry:'🪚',
 'general-repairs':'🛠️',painting:'🎨',masonry:'🧱',tiling:'🧩',
 'solar-security':'📹','appliance-repair':'🔧',
 'computer-phone-repair':'💻',roofing:'🏠','pest-control':'🐜',
 welding:'⚙️','other-services':'✨'
};
const services=SERVICE_OPTIONS.map(s=>({name:s.label,slug:s.value,icon:serviceIcons[s.value]||'🛠️'}));
type Props={
 activeRequests:CustomerTicket[];
 loading:boolean;
 error:string;
 reviewer:boolean;
 onRetry:()=>void;
 onOpenRequests:()=>void;
};

export function CustomerHomePanels({activeRequests,loading,error,reviewer,onRetry,onOpenRequests}:Props){
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
 const current=activeRequests[0]||null;
 const activeCount=activeRequests.length;
 return <>
  {loading?<section className="jt-glass-current" aria-label="Loading request summary">
   <div className="jt-glass-section-head jt-glass-current-heading"><h2><Clock3 size={25}/> My Current Request</h2></div>
   <div className="jt-glass-request-card jt-home-request-skeleton" role="status" aria-live="polite">
    <span className="jt-home-skeleton-line is-wide"/><span className="jt-home-skeleton-line"/>
    <span className="jt-home-skeleton-line is-short"/><span className="jt-home-skeleton-button"/>
   </div>
  </section>:error&&!current?<section className="jt-glass-current" aria-label="Request status unavailable">
   <div className="jt-glass-section-head jt-glass-current-heading"><h2><Clock3 size={25}/> My Current Request</h2></div>
   <div className="jt-glass-request-card jt-home-request-error" role="alert">
    <p>We couldn't refresh your requests. Your existing bookings haven't been changed.</p>
    <button type="button" onClick={onRetry}>Try again</button>
   </div>
  </section>:current?<section className="jt-glass-current" aria-labelledby="jt-glass-current-title">
   <div className="jt-glass-section-head jt-glass-current-heading">
    <h2 id="jt-glass-current-title"><Clock3 size={22}/><span>My Current Request</span>{activeCount>1&&<span className="jt-home-count" aria-label={activeCount+' active requests'}>{activeCount}</span>}</h2>
   </div>
   {error&&<div className="jt-home-stale-banner" role="status">Showing your last known request status. <button type="button" onClick={onRetry}>Refresh again</button></div>}
   <CustomerRequestStack tickets={activeRequests} onOpenRequests={onOpenRequests}/>
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
