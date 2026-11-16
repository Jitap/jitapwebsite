'use client';

import {useEffect,useRef,useState,type PointerEvent,type TouchEvent} from 'react';
import {useRouter} from 'next/navigation';
import {CheckCircle2,ChevronLeft,ChevronRight,UserRound} from 'lucide-react';
import {SERVICE_OPTIONS} from '@/lib/provider-options';
import {ProviderTravelEstimate} from '@/components/ProviderTravelEstimate';
import {ProviderJobAction} from '@/components/ProviderJobAction';
import './provider-active-job-stack.css';

export type ActiveProviderJob={
 id:string;requestId:string;status:string;customerName:string;customerPhone:string;
 location:string;service:string;latitude:number|null;longitude:number|null;placeId:string;
 rated:boolean;customerRating?:number|null;customerRatingCount?:number;customerRequestedJobs?:number|null;
};
type Props={jobs:ActiveProviderJob[];onUpdated:(job:ActiveProviderJob,nextStatus?:string)=>Promise<void>};
type Gesture={x:number;y:number;pointerId:number;axis:'pending'|'horizontal'|'vertical'};
const SWIPE_THRESHOLD=85;

export function ProviderActiveJobStack({jobs,onUpdated}:Props){
 const router=useRouter();
 const [order,setOrder]=useState<string[]>(()=>jobs.map(job=>job.id));
 const [offset,setOffset]=useState(0);
 const [dragging,setDragging]=useState(false);
 const gesture=useRef<Gesture|null>(null);
 const cardRef=useRef<HTMLElement|null>(null);
 const touchActive=useRef(false);
 useEffect(()=>{
  const ids=jobs.map(job=>job.id);
  setOrder(old=>{
   const remaining=old.filter(id=>ids.includes(id));
   const added=ids.filter(id=>!remaining.includes(id));
   const next=[...added,...remaining];
   return next.length===old.length&&next.every((id,i)=>id===old[i])?old:next;
  });
 },[jobs]);
 const mapped=new Map(jobs.map(job=>[job.id,job]));
 const queue=order.map(id=>mapped.get(id)).filter((job):job is ActiveProviderJob=>!!job);
 const current=queue[0]||jobs[0];
 const next=queue[1];
 const count=queue.length||jobs.length;
 const advance=(direction:'next'|'previous')=>{
  if(count<=1)return;
  setOrder(old=>direction==='next'?[...old.slice(1),old[0]]:[old[old.length-1],...old.slice(0,-1)]);
  setOffset(0);
 };
 const detail=(job:ActiveProviderJob)=>router.push('/provider/calendar?job='+encodeURIComponent(job.requestId));
 const pointerDown=(event:PointerEvent<HTMLElement>)=>{
  if(event.pointerType!=='mouse'||event.button!==0||!event.isPrimary)return;
  if((event.target as HTMLElement).closest('a,button,input,textarea,select'))return;
  gesture.current={x:event.clientX,y:event.clientY,pointerId:event.pointerId,axis:'pending'};

 };
 const pointerMove=(event:PointerEvent<HTMLElement>)=>{
  const g=gesture.current;
  if(!g||g.pointerId!==event.pointerId)return;
  const dx=event.clientX-g.x,dy=event.clientY-g.y;
  if(g.axis==='pending'){
   if(Math.max(Math.abs(dx),Math.abs(dy))<9)return;
   if(Math.abs(dy)>=Math.abs(dx)*1.1){g.axis='vertical';return}
   g.axis='horizontal';
   setDragging(true);
   try{cardRef.current?.setPointerCapture(event.pointerId)}catch{}
  }
  if(g.axis==='horizontal')setOffset(dx)
 };
 const pointerUp=(event:PointerEvent<HTMLElement>)=>{
  const g=gesture.current;
  if(!g||g.pointerId!==event.pointerId)return;
  gesture.current=null;
  setDragging(false);
  const dx=event.clientX-g.x;
  setOffset(0);
  if(g.axis!=='horizontal')return;
  if(dx<=-SWIPE_THRESHOLD)advance('next');
  else if(dx>=SWIPE_THRESHOLD&&current)detail(current);
 };
 const pointerCancel=()=>{gesture.current=null;setDragging(false);setOffset(0)};
 // Follow touch events explicitly, since mobile browsers can cancel pointer moves.
 const touchStart=(event:TouchEvent<HTMLElement>)=>{
  if(event.touches.length!==1)return;
  if((event.target as HTMLElement).closest('a,button,input,textarea,select'))return;
  touchActive.current=true;
  gesture.current={x:event.touches[0].clientX,y:event.touches[0].clientY,pointerId:-1,axis:'pending'};
 };
 const touchMove=(event:TouchEvent<HTMLElement>)=>{
  const g=gesture.current;
  if(!touchActive.current||!g||g.pointerId!==-1||event.touches.length!==1)return;
  const dx=event.touches[0].clientX-g.x,dy=event.touches[0].clientY-g.y;
  if(g.axis==='pending'){
   if(Math.max(Math.abs(dx),Math.abs(dy))<10)return;
   if(Math.abs(dy)>=Math.abs(dx)*1.1){g.axis='vertical';return}
   g.axis='horizontal';
   setDragging(true);
  }
  if(g.axis==='horizontal')setOffset(dx);
 };
 const touchEnd=(event:TouchEvent<HTMLElement>)=>{
  const g=gesture.current;
  if(!touchActive.current||!g||g.pointerId!==-1)return;
  touchActive.current=false;gesture.current=null;setDragging(false);setOffset(0);
  if(g.axis!=='horizontal'||!event.changedTouches.length)return;
  const dx=event.changedTouches[0].clientX-g.x;
  if(dx<=-SWIPE_THRESHOLD)advance('next');
  else if(dx>=SWIPE_THRESHOLD&&current)detail(current);
 };
 const touchCancel=()=>{touchActive.current=false;gesture.current=null;setDragging(false);setOffset(0)};
 if(!current)return null;
 const label=SERVICE_OPTIONS.find(c=>c.value===current.service)?.label||current.service;
 return <section className="jt-confirmed-jobs jt-provider-stack" aria-label="Active jobs">
  <div className="jt-provider-stack-heading">
   <h2><CheckCircle2 size={21}/> Active Jobs <span>{count}</span></h2>
   <span className="jt-provider-stack-position" aria-live="polite">{Math.max(1,jobs.findIndex(j=>j.id===current.id)+1)} of {count}</span>
  </div>
  <div className="jt-provider-stack-stage">
   {next&&<div className="jt-provider-stack-behind" aria-hidden="true"><span>{SERVICE_OPTIONS.find(c=>c.value===next.service)?.label||next.service}</span></div>}
   <article ref={cardRef} className={'jt-confirmed-job jt-provider-stack-front'+(dragging?' is-dragging':'')}
    style={{transform:`translate3d(${offset}px,0,0) rotate(${Math.max(-6,Math.min(6,offset/30))}deg)`}}
    onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
    onPointerCancel={pointerCancel} onLostPointerCapture={()=>{if(gesture.current?.pointerId!==-1)pointerCancel()}}
    onTouchStart={touchStart} onTouchMove={touchMove} onTouchEnd={touchEnd} onTouchCancel={touchCancel}
    aria-label={`Active job ${label} for ${current.customerName}. Swipe left for next job, swipe right for details.`}>
    <div className="jt-confirmed-job-meta"><strong>{label}</strong><small>JT-{current.requestId.slice(0,8).toUpperCase()}</small></div>
    <p><UserRound size={17}/> {current.customerName}</p>
    {current.customerRequestedJobs!==undefined&&current.customerRequestedJobs!==null&&
     <p className="jt-confirmed-job-trust" aria-label="Customer rating and number of service requests">
      <span>{current.customerRating!==null&&current.customerRating!==undefined?'★ '+current.customerRating.toFixed(1)+' ('+(current.customerRatingCount||0)+' ratings)':'☆ New · No ratings yet'}</span>
      <span>{current.customerRequestedJobs} {current.customerRequestedJobs===1?'job requested':'jobs requested'}</span>
     </p>}
    {current.customerPhone&&<p><a href={'tel:'+current.customerPhone.replace(/[^+0-9]/g,'')}>{current.customerPhone} · Call customer</a></p>}
    <ProviderTravelEstimate job={current}/>
    <div className="jt-confirmed-job-actions">
     <ProviderJobAction key={current.id} appointmentId={current.id} status={current.status} rated={current.rated}
      onUpdated={async(status)=>onUpdated(current,status)}/>
     <a className="jt-confirmed-view" href={'/provider/calendar?job='+encodeURIComponent(current.requestId)}>View <ChevronRight size={16}/></a>
    </div>
   </article>
  </div>
  <div className="jt-provider-stack-controls">
   <button type="button" onClick={()=>advance('previous')} disabled={count<=1} aria-label="Previous active job"><ChevronLeft size={18}/> Previous</button>
   <span>{count>1?'Swipe left for next · right for details':'View or update this job'}</span>
   <button type="button" onClick={()=>advance('next')} disabled={count<=1} aria-label="Next active job">Next <ChevronRight size={18}/></button>
  </div>
 </section>;
}
