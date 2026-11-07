'use client';
import {useState} from 'react';
import {Star} from 'lucide-react';

export type WorkStage='confirmed'|'on_my_way'|'arrived'|'in_progress'|'completed';
const steps:Record<WorkStage,{label:string;action:string}|null>={
 confirmed:{label:'On my way',action:'on_my_way'},
 on_my_way:{label:'Arrived',action:'arrived'},
 arrived:{label:'Start Work',action:'start_work'},
 in_progress:{label:'Completed',action:'complete'},
 completed:{label:'Rate Customer',action:'rate_customer'}
};
export function ProviderJobAction({appointmentId,status,rated=false,onUpdated}:{appointmentId:string;status:string;rated?:boolean;onUpdated:()=>Promise<void>|void}){
 const [busy,setBusy]=useState(false),[stars,setStars]=useState(0),[comment,setComment]=useState(''),[ratingOpen,setRatingOpen]=useState(false),[error,setError]=useState('');
 const stage=status in steps?status as WorkStage:null;
 const step=stage?steps[stage]:null;
 async function submit(action:string){
  setBusy(true);setError('');
  try{
   const res=await fetch('/api/provider/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,appointmentId,...(action==='rate_customer'?{stars,comment}:{})})});
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(data.error||'Unable to update job');
   setRatingOpen(false);await onUpdated();
  }catch(e){setError(e instanceof Error?e.message:'Unable to update job')}finally{setBusy(false)}
 }
 if(!step)return <span className="jt-work-stage-done">{status==='cancelled'?'Cancelled':'Job closed'}</span>;
 if(stage==='completed'&&rated)return <span className="jt-work-stage-done">★ Customer rated · Completed</span>;
 return <div className="jt-work-action">
  {ratingOpen&&stage==='completed'&&<div className="jt-work-rating">
   <strong>Rate your customer</strong><p>How was your experience working with this customer?</p>
   <div className="jt-work-stars" aria-label="Customer star rating">{[1,2,3,4,5].map(n=><button type="button" key={n} aria-label={n+' stars'} aria-pressed={stars===n} onClick={()=>setStars(n)}><Star size={27} fill={n<=stars?'#f9bc35':'none'} color={n<=stars?'#f9bc35':'#aab4c0'}/></button>)}</div>
   <textarea value={comment} onChange={e=>setComment(e.target.value)} maxLength={500} rows={2} placeholder="Comment (optional)" aria-label="Rating comment"/>
   <button type="button" className="jt-work-stage-button" disabled={busy||stars===0} onClick={()=>void submit('rate_customer')}>{busy?'Saving…':'Submit Rating'}</button>
   <button type="button" className="jt-work-rating-cancel" onClick={()=>setRatingOpen(false)}>Not now</button>
  </div>}
  {!ratingOpen&&<button type="button" className="jt-work-stage-button" disabled={busy} onClick={()=>step.action==='rate_customer'?setRatingOpen(true):void submit(step.action)}>{busy?'Updating…':step.label}</button>}
  {error&&<small role="alert" className="jt-work-action-error">{error}</small>}
 </div>;
}
