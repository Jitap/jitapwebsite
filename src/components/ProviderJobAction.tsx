'use client';
import {useEffect,useRef,useState} from 'react';
import {Star} from 'lucide-react';

export type WorkStage='confirmed'|'on_my_way'|'arrived'|'in_progress'|'completed';
const orderedStages:WorkStage[]=['confirmed','on_my_way','arrived','in_progress','completed'];
const steps:Record<WorkStage,{label:string;action:string}|null>={
 confirmed:{label:'On my way',action:'on_my_way'},
 on_my_way:{label:'Arrived',action:'arrived'},
 arrived:{label:'Start Work',action:'start_work'},
 in_progress:{label:'Completed',action:'complete'},
 completed:{label:'Rate Customer',action:'rate_customer'}
};
const expectedStatus:Record<string,WorkStage|'rated'>={
 on_my_way:'on_my_way',arrived:'arrived',start_work:'in_progress',
 complete:'completed',rate_customer:'rated'
};
function stageIndex(status:string){return orderedStages.indexOf(status as WorkStage)}
export function ProviderJobAction({appointmentId,status,rated=false,onUpdated}:{
 appointmentId:string;status:string;rated?:boolean;onUpdated:(nextStatus?:string)=>Promise<void>|void
}){
 // The server's successful transition is authoritative. Keep a local high-water
 // mark so polling or an older GET cannot rewind Start Work back to Arrived.
 const [currentStatus,setCurrentStatus]=useState(status);
 const [customerRated,setCustomerRated]=useState(rated);
 const [busy,setBusy]=useState(false);
 const submitting=useRef(false);
 const [stars,setStars]=useState(0);
 const [comment,setComment]=useState('');
 const [ratingOpen,setRatingOpen]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(status==='cancelled'){setCurrentStatus('cancelled');return}
  setCurrentStatus(previous=>stageIndex(status)>stageIndex(previous)?status:previous);
  if(rated)setCustomerRated(true);
 },[status,rated]);
 const stage=currentStatus in steps?currentStatus as WorkStage:null;
 const step=stage?steps[stage]:null;
 async function submit(action:string){
  if(submitting.current)return;
  submitting.current=true;setBusy(true);setError('');
  try{
   const res=await fetch('/api/provider/calendar',{
    method:'POST',headers:{'Content-Type':'application/json'},
    cache:'no-store',body:JSON.stringify({action,appointmentId,...(action==='rate_customer'?{stars,comment}:{})})
   });
   const data=await res.json().catch(()=>({})) as {status?:string;recorded?:boolean;error?:string};
   if(!res.ok||data.recorded!==true)throw Error(data.error||'Unable to update job. Please try again.');
   const next=expectedStatus[action];
   if(!next||data.status!==next)throw Error('The job status could not be confirmed. Refresh and check the latest state.');
   if(next==='rated'){
    setCustomerRated(true);
    setRatingOpen(false);
   }else{
    setCurrentStatus(next);
    // The last workflow action immediately opens the rating form. This is
    // intentional: the provider can finish without searching for another job.
    if(next==='completed')setRatingOpen(true);
    else setRatingOpen(false);
   }
   // Render the confirmed server result before refreshing lists. Even if a
   // concurrent request returns an older snapshot, the button never reverses.
   try{await onUpdated(next)}catch{setError('Status saved. Your dashboard will sync when refreshed.')}
  }catch(e){
   setError(e instanceof Error?e.message:'Unable to update job');
  }finally{setBusy(false);submitting.current=false}
 }
 if(!step)return <span className="jt-work-stage-done">{currentStatus==='cancelled'?'Cancelled':'Job closed'}</span>;
 if(stage==='completed'&&customerRated)return <span className="jt-work-stage-done">★ Customer rated · Job completed</span>;
 return <div className="jt-work-action" aria-live="polite">
  {ratingOpen&&stage==='completed'&&<div className="jt-work-rating">
   <strong>Rate your customer</strong>
   <p>Work completed. How was your experience with this customer?</p>
   <div className="jt-work-stars" role="group" aria-label="Customer star rating">
    {[1,2,3,4,5].map(n=><button type="button" key={n} disabled={busy}
      aria-label={n+' stars'} aria-pressed={stars===n} onClick={()=>setStars(n)}>
      <Star size={27} fill={n<=stars?'#f9bc35':'none'} color={n<=stars?'#f9bc35':'#aab4c0'}/>
    </button>)}
   </div>
   <textarea value={comment} onChange={e=>setComment(e.target.value)}
    maxLength={500} rows={2} disabled={busy}
    placeholder="Comment (optional)" aria-label="Rating comment"/>
   <button type="button" className="jt-work-stage-button" disabled={busy||stars===0}
    onClick={()=>void submit('rate_customer')}>{busy?'Saving…':'Submit Rating'}</button>
   <button type="button" className="jt-work-rating-cancel" disabled={busy}
    onClick={()=>setRatingOpen(false)}>Not now</button>
  </div>}
  {!ratingOpen&&<button type="button" className="jt-work-stage-button"
   disabled={busy} onClick={()=>step.action==='rate_customer'?setRatingOpen(true):void submit(step.action)}>
   {busy?'Updating…':step.label}
  </button>}
  {error&&<small role="alert" className="jt-work-action-error">{error}</small>}
 </div>;
}
