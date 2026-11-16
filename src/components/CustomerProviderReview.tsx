'use client';
import {useState} from 'react';
import {Star} from 'lucide-react';
export function CustomerProviderReview({requestId,providerName,existing}:{requestId:string;providerName:string;existing:{stars:number;comment:string}|null}){
 const [stars,setStars]=useState(0);
 const [comment,setComment]=useState('');
 const [saved,setSaved]=useState(existing);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function submit(){
  if(stars<1||busy)return;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/account/provider-review',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requestId,stars,comment})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||'Could not save your review');
   setSaved({stars,comment});
  }catch(e){setError(e instanceof Error?e.message:'Please try again')}
  finally{setBusy(false)}
 }
 return <section className="jt-customer-provider-review" aria-label="Review your provider"
  style={{margin:'14px 0',padding:16,border:'1px solid #bce7cc',borderRadius:15,background:'#f4fbf6'}}>
  <h3 style={{fontSize:17,fontWeight:800,color:'#145d36',margin:'0 0 6px'}}>Review your provider</h3>
  <p style={{fontSize:13,color:'#486858',margin:'0 0 11px'}}>
   {saved?'Thank you for reviewing your completed job.':'How was your experience with '+providerName+'?'}
  </p>
  {saved?<div style={{display:'flex',alignItems:'center',gap:9,color:'#0d7541',fontWeight:750}}>
    <span aria-label={saved.stars+' out of 5 stars'}>{'★'.repeat(saved.stars)+'☆'.repeat(5-saved.stars)}</span>
    <span>{saved.stars}/5</span>
   </div>:
   <>
    <div role="group" aria-label="Rate the provider from one to five stars" style={{display:'flex',gap:5,marginBottom:10}}>
     {[1,2,3,4,5].map(value=><button key={value} type="button" onClick={()=>setStars(value)}
      aria-label={value+' stars'} aria-pressed={stars===value}
      style={{border:0,background:'transparent',cursor:'pointer',padding:'5px 4px',color:value<=stars?'#eba624':'#afbbb1'}}>
      <Star size={28} fill={value<=stars?'currentColor':'none'}/>
     </button>)}
    </div>
    <textarea aria-label="Optional written review" value={comment} maxLength={500} onChange={e=>setComment(e.target.value)}
     placeholder="Share your experience (optional)" rows={3}
     style={{width:'100%',border:'1px solid #cae2d3',borderRadius:10,padding:11,resize:'vertical',fontFamily:'inherit',fontSize:14}}/>
    <button type="button" disabled={stars===0||busy} onClick={()=>void submit()}
     style={{marginTop:10,padding:'12px 18px',background:'#008a3e',border:0,color:'#fff',fontWeight:800,borderRadius:10,cursor:'pointer',opacity:(stars===0||busy)?0.6:1}}>
     {busy?'Submitting…':'Submit review'}
    </button>
    {error&&<p role="alert" style={{color:'#ad293b',fontSize:13}}>{error}</p>}
   </>}
  {saved?.comment&&<p style={{fontSize:13,color:'#37624b',margin:'9px 0 0'}}>{saved.comment}</p>}
 </section>;
}
