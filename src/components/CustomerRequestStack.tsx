'use client';

import {useCallback,useEffect,useMemo,useRef,useState,type PointerEvent,type TouchEvent} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {CalendarDays,Check,MapPin,Phone,UserRound} from 'lucide-react';
import type {CustomerTicket} from '@/components/CustomerTicketCard';
import {customerProgressStage,customerProgressSteps} from '@/lib/customer-progress';
import {SERVICE_OPTIONS} from '@/lib/provider-options';

const categoryIcons:Record<string,string>={
 plumbing:'🚰',electrical:'⚡',cleaning:'🧹',moving:'🚚',carpentry:'🪚',
 'general-repairs':'🛠️',painting:'🎨',masonry:'🧱',tiling:'🧩',
 'solar-security':'📹','appliance-repair':'🔧','computer-phone-repair':'💻',
 roofing:'🏠','pest-control':'🐜',welding:'⚙️','other-services':'✨'
};
const categoryLabels=new Map<string,string>(SERVICE_OPTIONS.map(v=>[v.value,v.label]));
const THRESHOLD=100;
const ANIMATE_MS=270;
type Exit='left'|'right'|null;
type Origin={x:number;y:number;pointerId:number;axis:'pending'|'horizontal'|'vertical';startAt:number};
function timeLabel(t:CustomerTicket){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(t.date))return 'Date to be confirmed';
 const date=new Date(t.date+'T12:00:00Z').toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 return date+(t.time?' · '+t.time+' EAT':'');
}
function detailUrl(t:CustomerTicket){return '/track?ref='+encodeURIComponent(t.serviceId);}
function orderedTickets(all:CustomerTicket[],ids:string[]){
 const byId=new Map(all.map(ticket=>[ticket.reference,ticket]));
 return ids.map(id=>byId.get(id)).filter((ticket):ticket is CustomerTicket=>!!ticket);
}

/** Draggable, non-destructive active-request queue. No mutations are sent to the backend. */
export function CustomerRequestStack({tickets,onOpenRequests}:{
 tickets:CustomerTicket[];onOpenRequests:()=>void;
}){
 const router=useRouter();
 const [order,setOrder]=useState<string[]>(()=>tickets.map(t=>t.reference));
 const [offset,setOffset]=useState(0);
 const [exit,setExit]=useState<Exit>(null);
 const [dragging,setDragging]=useState(false);
 const [animationDisabled,setAnimationDisabled]=useState(false);
 const origin=useRef<Origin|null>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const suppressClick=useRef(false);
 const cardRef=useRef<HTMLElement|null>(null);
 const inFlight=useRef(false);
 const restored=useRef(false);
 const currentRef=useRef<CustomerTicket|null>(tickets[0]||null);

 useEffect(()=>{
  const ids=tickets.map(t=>t.reference);
  setOrder(previous=>{
   let last=previous;
   if(!restored.current){
    restored.current=true;
    try{
     const saved=JSON.parse(sessionStorage.getItem('jitap:active-request-stack')||'[]') as unknown;
     if(Array.isArray(saved)&&saved.every(v=>typeof v==='string'))last=saved;
    }catch{}
   }
   const stillHere=last.filter(id=>ids.includes(id));
   const newcomers=ids.filter(id=>!stillHere.includes(id));
   return [...newcomers,...stillHere];
  });
 },[tickets]);
 const queue=useMemo(()=>orderedTickets(tickets,order),[tickets,order]);
 const current=queue[0]||tickets[0]||null;
 const next=queue.length>1?queue[1]:null;
 currentRef.current=current;
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 const finish=useCallback((direction:'left'|'right')=>{
  if(inFlight.current||!currentRef.current)return;
  inFlight.current=true;
  setDragging(false);
  setExit(direction);
  setOffset(direction==='left'?-Math.max(450,window.innerWidth):Math.max(450,window.innerWidth));
  const chosen=currentRef.current;
  timer.current=setTimeout(()=>{
   if(direction==='right'){
    inFlight.current=false;
    // Preserve order on the return navigation.
    router.push(detailUrl(chosen));
    setExit(null);setOffset(0);
    return;
   }
   setAnimationDisabled(true);
   setOrder(old=>{
    const result=old.length>1?[...old.slice(1),old[0]]:old;
    try{sessionStorage.setItem('jitap:active-request-stack',JSON.stringify(result))}catch{}
    return result;
   });
   setOffset(0);setExit(null);inFlight.current=false;
   timer.current=setTimeout(()=>{
    setAnimationDisabled(false);
    timer.current=null;
   },32);
  },ANIMATE_MS);
 },[router]);
 const startGesture=(x:number,y:number,pointerId:number)=>{
  if(inFlight.current||!currentRef.current)return;
  origin.current={x,y,pointerId,axis:'pending',startAt:Date.now()};
  suppressClick.current=false;
 };
 const moveGesture=(x:number,y:number,pointerId:number)=>{
  const gesture=origin.current;
  if(!gesture||gesture.pointerId!==pointerId||inFlight.current)return false;
  const dx=x-gesture.x;
  const dy=y-gesture.y;
  if(gesture.axis==='pending'){
   if(Math.max(Math.abs(dx),Math.abs(dy))<7)return false;
   if(Math.abs(dy)>Math.abs(dx)*1.05){
    gesture.axis='vertical';
    return false;
   }
   gesture.axis='horizontal';
   setDragging(true);
  }
  if(gesture.axis!=='horizontal')return false;
  suppressClick.current=true;
  setOffset(dx);
  return true;
 };
 const endGesture=(x:number,pointerId:number)=>{
  const gesture=origin.current;
  if(!gesture||gesture.pointerId!==pointerId)return;
  origin.current=null;
  if(gesture.axis!=='horizontal')return;
  setDragging(false);
  const dx=x-gesture.x;
  if(dx<=-THRESHOLD&&queue.length>1){finish('left');return;}
  if(dx>=THRESHOLD){finish('right');return;}
  setOffset(0);
 };
 const onDown=(event:PointerEvent<HTMLElement>)=>{
  // Android touch browsers may cancel pointer events for native page scrolling.
  // Dedicated touch handlers below own touch input; pointer is mouse/pen only.
  if(event.pointerType==='touch'||event.button!==0||!event.isPrimary)return;
  if((event.target as HTMLElement).closest('button,input,select,textarea'))return;
  startGesture(event.clientX,event.clientY,event.pointerId);
 };
 const onMove=(event:PointerEvent<HTMLElement>)=>{
  if(event.pointerType==='touch')return;
  if(moveGesture(event.clientX,event.clientY,event.pointerId)){
   try{if(!event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.setPointerCapture(event.pointerId)}catch{}
  }
 };
 const onUp=(event:PointerEvent<HTMLElement>)=>{
  if(event.pointerType==='touch')return;
  endGesture(event.clientX,event.pointerId);
 };
 const onTouchStart=(event:TouchEvent<HTMLElement>)=>{
  if(event.touches.length!==1)return;
  if((event.target as HTMLElement).closest('button,input,select,textarea'))return;
  const touch=event.touches[0];
  startGesture(touch.clientX,touch.clientY,touch.identifier);
 };
 const onTouchMove=(event:TouchEvent<HTMLElement>)=>{
  const touch=Array.from(event.changedTouches).find(t=>t.identifier===origin.current?.pointerId);
  if(!touch)return;
  // touch-action:pan-y keeps vertical scrolling native while horizontal movement
  // updates the card; never call preventDefault for vertical gestures.
  moveGesture(touch.clientX,touch.clientY,touch.identifier);
 };
 const onTouchEnd=(event:TouchEvent<HTMLElement>)=>{
  const touch=Array.from(event.changedTouches).find(t=>t.identifier===origin.current?.pointerId);
  if(touch)endGesture(touch.clientX,touch.identifier);
 };
 const onCancel=()=>{
  origin.current=null;
  setDragging(false);
  if(!inFlight.current)setOffset(0);
 };
 if(!current)return null;
 const stage=customerProgressStage(current.status);
 const icon=categoryIcons[current.category]||'🛠️';
 const label=categoryLabels.get(current.category)||current.category.replaceAll('-',' ');
 const tilt=Math.max(-8,Math.min(8,offset/24));
 const cue=offset>20?'right':offset< -20?'left':null;
 return <div className="jt-swipe-widget">
  <div className="jt-swipe-stage" aria-label={'Active request '+current.serviceId+'; swipe left for the next request or right to view details'}>
   {next&&<div className="jt-swipe-behind" aria-hidden="true">
    <span>{categoryIcons[next.category]||'🛠️'} {categoryLabels.get(next.category)||next.category.replaceAll('-',' ')}</span>
   </div>}
   <article
    ref={cardRef}
    className={'jt-glass-request-card jt-home-priority-card jt-swipe-card'+(dragging?' is-dragging':'')+(exit?' is-exiting':'')+(animationDisabled?' no-animate':'')+(cue==='right'?' swipe-right':cue==='left'?' swipe-left':'')}
    style={{transform:`translate3d(${offset}px,0,0) rotate(${tilt}deg)`}}
    onPointerDown={onDown}
    onPointerMove={onMove}
    onPointerUp={onUp}
    onPointerCancel={event=>{if(event.pointerType!=='touch')onCancel()}}
    onTouchStart={onTouchStart}
    onTouchMove={onTouchMove}
    onTouchEnd={onTouchEnd}
    onTouchCancel={onCancel}
    onLostPointerCapture={event=>{if(event.pointerType!=='touch'&&origin.current)onCancel()}}
    onClickCapture={event=>{if(suppressClick.current){event.stopPropagation();event.preventDefault();suppressClick.current=false;}}}
   >
    {cue&&<span className={'jt-swipe-cue '+(cue==='right'?'is-details':'is-next')} aria-hidden="true">
     {cue==='right'?'View Details →':'← Next Request'}
    </span>}
    <div className="jt-glass-request-top">
     <span className="jt-glass-request-service-icon" aria-hidden="true">{icon}</span>
     <div className="jt-home-request-identity">
      <h3>{label}</h3>
      <span className="jt-glass-state">{current.statusLabel||'Received'}</span>
     </div>
     <small>{current.serviceId}</small>
    </div>
    <div className="jt-glass-request-details">
     <div><UserRound size={18}/><span>{current.provider||'To be matched'}</span></div>
     <div><CalendarDays size={18}/><span>{timeLabel(current)}</span></div>
     <div><MapPin size={18}/><span>{current.location||current.area||'Location to be confirmed'}</span></div>
    </div>
    <ol className={'jt-glass-progress jt-home-progress is-stage-'+stage} aria-label="Request progress">
     {customerProgressSteps.map((step,index)=><li key={step} className={index<stage?'is-done':index===stage?'is-current':''} aria-current={index===stage?'step':undefined}>
      <span className="jt-glass-step-mark">{index<stage?<Check size={14} strokeWidth={3}/>:index===stage?<span className="jt-glass-step-dot"/>:null}</span>
      <small>{step}</small>
     </li>)}
    </ol>
    {current.rematch&&<div className="jt-glass-request-alert" role="status">
     Your provider has cancelled. Please review your rematch options.
     <button type="button" onClick={onOpenRequests}>Review now</button>
    </div>}
    <div className="jt-home-request-footer">
     <Link className="jt-home-view-request" href={detailUrl(current)}>View Request</Link>
     {!!current.providerPhone&&<a className="jt-home-call-provider" href={'tel:'+current.providerPhone.replace(/[^+\d]/g,'')}>
      <Phone size={17}/> Call Provider
     </a>}
    </div>
   </article>
  </div>
  {queue.length>1&&<div className="jt-swipe-footer">
   <span className="jt-swipe-position" aria-live="polite">{Math.max(1,tickets.findIndex(ticket=>ticket.reference===current.reference)+1)} of {queue.length} active requests</span>
   <button type="button" className="jt-swipe-next" onClick={()=>finish('left')} disabled={inFlight.current}>Next request <span aria-hidden="true">←</span></button>
  </div>}
 </div>;
}
