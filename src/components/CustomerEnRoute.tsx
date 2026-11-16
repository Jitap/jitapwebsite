'use client';
import {useCallback,useEffect,useState} from 'react';
import {Bike,Clock3,MapPin} from 'lucide-react';
type Estimate={available:boolean;distanceKm?:number;etaMinutes?:number;lastLocationAt?:string;reason?:string};
export function CustomerEnRoute({requestId}:{requestId:string}){
 const [estimate,setEstimate]=useState<Estimate|null>(null);
 const refresh=useCallback(async()=>{
  try{
   const response=await fetch('/api/account/en-route?requestId='+encodeURIComponent(requestId),{cache:'no-store'});
   if(!response.ok){setEstimate({available:false});return}
   const data=await response.json() as Estimate;
   setEstimate(data);
  }catch{setEstimate({available:false})}
 },[requestId]);
 useEffect(()=>{
  void refresh();
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh()},30000);
  const onVisible=()=>{if(document.visibilityState==='visible')void refresh()};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible)};
 },[refresh]);
 return <section aria-label="Provider approaching" style={{background:'#f0faf4',border:'1px solid #c9e8d5',borderRadius:14,padding:15,margin:'14px 0'}}>
  <strong style={{display:'flex',alignItems:'center',gap:7,color:'#087845',fontSize:15}}><Bike size={19}/> Your provider is on the way</strong>
  {estimate?.available&&typeof estimate.distanceKm==='number'&&typeof estimate.etaMinutes==='number'?
   <div style={{display:'flex',flexWrap:'wrap',gap:15,margin:'12px 0',fontWeight:800,color:'#164d30'}}>
    <span style={{display:'inline-flex',alignItems:'center',gap:6}}><MapPin size={17}/>{estimate.distanceKm.toFixed(1)} km remaining</span>
    <span style={{display:'inline-flex',alignItems:'center',gap:6}}><Clock3 size={17}/>About {estimate.etaMinutes} min</span>
   </div>:
   <p style={{fontSize:13,color:'#567465',margin:'10px 0'}}>Waiting for updated travel information from your provider.</p>}
  <small style={{fontSize:11,color:'#547365'}}>Updated approximately every 30 seconds while tracking is open. Traffic and routes can change.</small>
 </section>;
}
