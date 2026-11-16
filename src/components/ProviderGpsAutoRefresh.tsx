'use client';
import {useEffect,useRef} from 'react';

/**
 * Provider-wide foreground GPS heartbeat: one 20-second timer for all
 * /provider/* routes. Online is the provider's explicit persisted choice.
 *
 * Browsers can suspend geolocation in background/locked-screen states.
 * Aly's native Expo location task handles background operation only after
 * the provider grants the OS-specific background-location permission.
 */
export function ProviderGpsAutoRefresh(){
 const inFlight=useRef(false);
 useEffect(()=>{
  let active=true;
  const pulse=async()=>{
   if(!active||inFlight.current||document.visibilityState!=='visible'||!navigator.geolocation)return;
   inFlight.current=true;
   try{
    const state=await fetch('/api/provider/location-state',{cache:'no-store'});
    if(!state.ok)return;
    const current=await state.json() as {online?:boolean};
    if(!current.online)return;
    const position=await new Promise<GeolocationPosition>((resolve,reject)=>
     navigator.geolocation.getCurrentPosition(resolve,reject,{
      enableHighAccuracy:true,maximumAge:0,timeout:12000
     }));
    if(!active||document.visibilityState!=='visible')return;
    await fetch('/api/provider/wave-buzz',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({
      action:'location',sharing:true,
      latitude:position.coords.latitude,longitude:position.coords.longitude
     })
    });
   }catch{/* Failed location updates never force provider Offline. */}
   finally{inFlight.current=false}
  };
  void pulse();
  const timer=window.setInterval(()=>void pulse(),20000);
  const focus=()=>{if(document.visibilityState==='visible')void pulse()};
  document.addEventListener('visibilitychange',focus);
  return()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',focus)};
 },[]);
 return null;
}
