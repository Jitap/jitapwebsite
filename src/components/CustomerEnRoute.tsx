'use client';
import {useCallback,useEffect,useState} from 'react';
import {Bike,Clock3,MapPin} from 'lucide-react';

type Estimate={
 available:boolean;
 locationLabel?:string;
 lastLocationAt?:string|null;
 routeUpdatedAt?:string|null;
 distanceKm?:number|null;
 etaMinutes?:number|null;
 isLive?:boolean;
 isLastKnown?:boolean;
};
const timeText=(date:string|null|undefined)=>{
 if(!date)return '';
 const stamp=Date.parse(date);
 if(!Number.isFinite(stamp))return '';
 return new Intl.DateTimeFormat('en-KE',{
  hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Africa/Nairobi'
 }).format(new Date(stamp))+' EAT';
};
export function CustomerEnRoute({
 requestId,variant='detail'
}:{requestId:string;variant?:'home'|'detail'}){
 const [estimate,setEstimate]=useState<Estimate|null>(null);
 const refresh=useCallback(async()=>{
  try{
   const response=await fetch(
    '/api/account/en-route?requestId='+encodeURIComponent(requestId),
    {cache:'no-store',credentials:'same-origin'});
   if(!response.ok)return; // Keep last valid values through transient failures.
   const data=await response.json() as Estimate;
   setEstimate(prev=>{
    // The server persists the last known fix. A failed lookup never erases
    // valid location/ETA already displayed on this customer's device.
    if(!data.available&&prev?.available)return {...prev,isLive:false,isLastKnown:true};
    return data;
   });
  }catch{/* Preserve last known route and timestamp. */}
 },[requestId]);
 useEffect(()=>{
  setEstimate(null); // Never reuse a different request's coordinates.
  void refresh();
  const timer=window.setInterval(()=>{
   if(document.visibilityState==='visible')void refresh();
  },30000);
  const onVisible=()=>{if(document.visibilityState==='visible')void refresh()};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible)};
 },[refresh]);

 const hasRoute=estimate?.distanceKm!==null&&estimate?.distanceKm!==undefined&&
  estimate?.etaMinutes!==null&&estimate?.etaMinutes!==undefined;
 const updated=timeText(estimate?.lastLocationAt);
 const routeUpdated=timeText(estimate?.routeUpdatedAt);
 const location=estimate?.available
  ?estimate.locationLabel||'Provider GPS location'
  :'Provider location not yet recorded';
 const lastUpdated=updated?'Last updated '+updated:'Last update unavailable';

 if(variant==='home')return <div className="jt-home-enroute" aria-label="Provider location and ETA">
  <div className="jt-home-provider-location">
   <MapPin size={18} aria-hidden="true"/>
   <span><strong>{location}</strong><small>{lastUpdated}{estimate?.isLastKnown?' · Last known location':''}</small></span>
  </div>
  {hasRoute&&<div className="jt-home-arrival-metrics" aria-label="Remaining road distance and travel time">
   <span><MapPin size={16}/>{estimate.distanceKm!.toFixed(1)} km remaining</span>
   <span><Clock3 size={16}/>About {estimate.etaMinutes} min</span>
  </div>}
  {hasRoute&&<small className="jt-home-route-updated">
   {estimate?.isLastKnown?'Last known travel estimate':'Estimated travel time'}
   {routeUpdated?' · '+routeUpdated:''}
  </small>}
 </div>;

 return <section aria-label="Provider approaching" className="jt-enroute-detail"
  style={{background:'#f0faf4',border:'1px solid #c9e8d5',borderRadius:14,padding:15,margin:'14px 0'}}>
  <strong style={{display:'flex',alignItems:'center',gap:7,color:'#087845',fontSize:15}}>
   <Bike size={19}/> Your provider is on the way
  </strong>
  <p style={{display:'flex',alignItems:'flex-start',gap:7,fontSize:13,color:'#315b47',margin:'11px 0 5px'}}>
   <MapPin size={17}/><span><strong>{location}</strong><small style={{display:'block',fontSize:11,marginTop:4}}>{lastUpdated}{estimate?.isLastKnown?' · Last known location':''}</small></span>
  </p>
  {hasRoute&&<div style={{display:'flex',flexWrap:'wrap',gap:15,margin:'12px 0',fontWeight:800,color:'#164d30'}}>
   <span style={{display:'inline-flex',alignItems:'center',gap:6}}><MapPin size={17}/>{estimate.distanceKm!.toFixed(1)} km remaining</span>
   <span style={{display:'inline-flex',alignItems:'center',gap:6}}><Clock3 size={17}/>About {estimate.etaMinutes} min</span>
  </div>}
  <small style={{fontSize:11,color:'#547365'}}>
   {hasRoute?(estimate?.isLastKnown?'Last known travel estimate':'Travel estimate')+
    (routeUpdated?' · '+routeUpdated:'')+'. ':''}
   GPS and route updates refresh while tracking is open.
  </small>
 </section>;
}
