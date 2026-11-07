'use client';
import {useEffect,useState} from 'react';
import {MapPin,Navigation} from 'lucide-react';
export type JobDestination={id:string;location:string;latitude:number|null;longitude:number|null;placeId:string};
export function googleJobDirections(job:JobDestination){
 const destination=job.latitude!==null&&job.longitude!==null?job.latitude+','+job.longitude:job.location;
 if(!destination)return '';
 return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(destination)+(job.placeId?'&destination_place_id='+encodeURIComponent(job.placeId):'')+'&travelmode=driving';
}
export function ProviderTravelEstimate({job}:{job:JobDestination}){
 const [estimate,setEstimate]=useState<{minutes:number;kilometers:number}|null>(null);
 const [state,setState]=useState<'loading'|'no-gps'|'unavailable'|'ready'>('loading');
 useEffect(()=>{
  let active=true;
  if(job.latitude===null||job.longitude===null){setState('unavailable');return}
  if(!navigator.geolocation){setState('no-gps');return}
  navigator.geolocation.getCurrentPosition(async position=>{
   if(!active)return;
   try{
    const res=await fetch('/api/provider/route-estimate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appointmentId:job.id,origin:{lat:position.coords.latitude,lng:position.coords.longitude}})});
    const result=await res.json();
    if(!active)return;
    if(res.ok&&result.available){setEstimate({minutes:result.minutes,kilometers:result.kilometers});setState('ready')}
    else setState('unavailable');
   }catch{if(active)setState('unavailable')}
  },()=>{if(active)setState('no-gps')},{enableHighAccuracy:false,timeout:10000,maximumAge:120000});
  return()=>{active=false};
 },[job.id,job.latitude,job.longitude]);
 const directions=googleJobDirections(job);
 return <div className="jt-travel-estimate">
  {directions?<a className="jt-travel-location" href={directions} target="_blank" rel="noopener noreferrer"><MapPin size={17}/><span>{job.location||'View exact pin on Google Maps'}</span><Navigation size={16}/></a>:<span className="jt-travel-location"><MapPin size={17}/> Customer location unavailable</span>}
  <div className="jt-travel-eta" role="status">
   {state==='ready'&&estimate?<><strong>🏍️ {estimate.minutes} min ({estimate.kilometers.toFixed(1)} km)</strong><small>Estimated motorcycle journey · Google Maps</small></>:
    state==='loading'?<small>🏍️ Calculating journey…</small>:
    state==='no-gps'?<small>🏍️ Allow device location for travel estimate</small>:
    <small>🏍️ Travel estimate unavailable · Open Google Maps for directions</small>}
  </div>
 </div>;
}
