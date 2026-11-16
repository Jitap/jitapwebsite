'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {BellRing,MapPin,Zap} from 'lucide-react';
import {playProviderBuzzChime} from '@/lib/provider-buzz-audio';
import './wave-buzz.css';

type LiveOffer={requestId:string;ref:string;category:string;brief:string;location:string;preferredTime:string;distanceKm:number;wave:number;expiresAt:string};
export function WaveBuzzIncoming({enabled,enRoute=false}:{enabled:boolean;enRoute?:boolean}){
 const [offer,setOffer]=useState<LiveOffer|null>(null);
 const [now,setNow]=useState(Date.now());
 const [clockOffset,setClockOffset]=useState(0);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const current=useRef('');
 const lastPing=useRef(0);
 const remaining=offer?Math.max(0,Math.ceil((Date.parse(offer.expiresAt)-(now+clockOffset))/1000)):0;
 const play=playProviderBuzzChime;
 const poll=useCallback(async()=>{
  if(!enabled||document.visibilityState!=='visible')return;
  try{
   const result=await fetch('/api/provider/wave-buzz',{cache:'no-store',credentials:'same-origin'});
   if(!result.ok)return;
   const data=await result.json();
   if(data.serverNow)setClockOffset(Date.parse(data.serverNow)-Date.now());
   const next=data.offer as LiveOffer|null;
   if(next&&next.requestId!==current.current){
    current.current=next.requestId;
    setOffer(next);
    if('vibrate' in navigator)navigator.vibrate([300,150,300,150,500]);
    play();
   }else if(!next){
    current.current='';
    setOffer(null);
   }
  }catch{/* Keep normal provider dashboard available during connectivity issues. */}
 },[enabled,play]);
 useEffect(()=>{
  if(!enabled){setOffer(null);return}
  void poll();
  const tick=window.setInterval(()=>{setNow(Date.now());void poll()},3000);
  const timer=window.setInterval(()=>setNow(Date.now()),250);
  return()=>{window.clearInterval(tick);window.clearInterval(timer)};
 },[enabled,poll]);
 useEffect(()=>{
  if(!enabled||!offer||remaining===0)return;
  if(Date.now()-lastPing.current>4500){
   lastPing.current=Date.now();play();
  }
 },[enabled,offer,remaining,play]);
 const shareLocation=useCallback(async(silent=false)=>{
  if(!navigator.geolocation){if(!silent)setError('Location is unavailable on this device.');return}
  if(!silent)setBusy(true);
  if(!silent)setError('');
  try{
   const position=await new Promise<GeolocationPosition>((resolve,reject)=>
    navigator.geolocation.getCurrentPosition(resolve,reject,
     {enableHighAccuracy:true,maximumAge:0,timeout:12000}));
   const res=await fetch('/api/provider/wave-buzz',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'location',sharing:true,latitude:position.coords.latitude,longitude:position.coords.longitude})});
   if(!res.ok)throw Error('Precise location was not refreshed.');
  }catch{
   if(!silent)setError('Please enable precise location in your phone settings to receive nearby jobs.');
  }finally{if(!silent)setBusy(false)}
 },[]);
 useEffect(()=>{
  if(!enabled)return
  // The Online switch already obtained explicit GPS permission. Refresh only
  // while the app is visible; closed apps require Aly's native location service.
  const timer=window.setInterval(()=>{
   if(document.visibilityState==='visible')void shareLocation(true);
  },enRoute?20000:4*60*1000);
  const onVisible=()=>{if(document.visibilityState==='visible')void shareLocation(true)};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible)};
 },[enabled,shareLocation,enRoute]);
 async function respond(decision:'accepted'|'declined'){
  if(!offer||remaining<=0||busy)return;
  setBusy(true);setError('');
  try{
   const result=await fetch('/api/provider/wave-buzz',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'respond',requestId:offer.requestId,decision})});
   const data=await result.json();
   if(!result.ok||!['matched','declined'].includes(data.status))throw Error(data.status==='expired'?'Another provider accepted or your BUZZ expired.':data.error||'Request no longer available');
   setLastOutcome(data.status==='matched'?'Accepted! JiTap Service Operations will coordinate the customer connection.':'Declined. JiTap will continue searching.');
   setOffer(null);current.current='';
   if('vibrate' in navigator)navigator.vibrate(0);
  }catch(e){setError(e instanceof Error?e.message:'Unable to respond')}
  finally{setBusy(false)}
 }
 if(!enabled)return null;
 return <>
  {offer&&remaining>0&&<div className="jt-wave-live-backdrop" role="presentation">
   <section className="jt-wave-live-sheet" role="dialog" aria-modal="true" aria-label="Incoming JiTap Wave Buzz">
    <div className="jt-wave-live-header"><strong><BellRing size={18}/> Incoming JiTap BUZZ</strong><span>Wave {offer.wave}</span></div>
    <div className="jt-wave-sonar running" style={{height:105}}>
     <span className="jt-wave-ring jt-wave-ring-one"/><span className="jt-wave-ring jt-wave-ring-two"/><span className="jt-wave-ring jt-wave-ring-three"/>
     <div className="jt-wave-sonar-icon" style={{width:64,height:64}}><Zap size={30}/></div>
    </div>
    <div className="jt-wave-live-countdown">{remaining}s <small>to respond</small></div>
    <div className="jt-wave-progress"><span style={{width:(remaining/15*100)+'%'}}/></div>
    <h2>{offer.category.replaceAll('-',' ')}</h2>
    <p>{offer.brief}</p>
    <div className="jt-wave-fact"><MapPin size={17}/> {offer.location} · {offer.distanceKm.toFixed(1)} km away</div>
    {offer.preferredTime&&<div className="jt-wave-fact">Requested: {offer.preferredTime}</div>}
    <p className="jt-wave-ref">{offer.ref} · Straight-line GPS distance, not ETA</p>
    {error&&<p role="alert" style={{color:'#b42332'}}>{error}</p>}
    <button type="button" className="jt-wave-accept" onClick={()=>void respond('accepted')} disabled={busy}>Accept Job</button>
    <button type="button" className="jt-wave-decline" onClick={()=>void respond('declined')} disabled={busy}>Decline</button>
   </section>
  </div>}
 </>;
}
