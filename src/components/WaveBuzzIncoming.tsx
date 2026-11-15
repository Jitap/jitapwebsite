'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {BellRing,MapPin,Volume2,VolumeX,LocateFixed,Zap} from 'lucide-react';
import './wave-buzz.css';

type LiveOffer={requestId:string;ref:string;category:string;brief:string;location:string;preferredTime:string;distanceKm:number;wave:number;expiresAt:string};
export function WaveBuzzIncoming({enabled}:{enabled:boolean}){
 const [offer,setOffer]=useState<LiveOffer|null>(null);
 const [now,setNow]=useState(Date.now());
 const [clockOffset,setClockOffset]=useState(0);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [muted,setMuted]=useState(true);
 const [locationShared,setLocationShared]=useState(false);
 const [lastOutcome,setLastOutcome]=useState('');
 const current=useRef('');
 const audio=useRef<AudioContext|null>(null);
 const lastPing=useRef(0);
 const remaining=offer?Math.max(0,Math.ceil((Date.parse(offer.expiresAt)-(now+clockOffset))/1000)):0;
 const play=useCallback(()=>{
  if(muted)return;
  try{
   const ctx=audio.current||(audio.current=new AudioContext());
   void ctx.resume();
   const start=ctx.currentTime;
   [784,1047].forEach((frequency,i)=>{
    const oscillator=ctx.createOscillator(),volume=ctx.createGain();
    oscillator.type='sine';oscillator.frequency.value=frequency;
    volume.gain.setValueAtTime(.0001,start+i*.11);
    volume.gain.exponentialRampToValueAtTime(.055,start+i*.11+.02);
    volume.gain.exponentialRampToValueAtTime(.0001,start+i*.11+.24);
    oscillator.connect(volume).connect(ctx.destination);
    oscillator.start(start+i*.11);oscillator.stop(start+i*.11+.25);
   });
  }catch{/* Audio may be blocked; visual BUZZ remains functional. */}
 },[muted]);
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
    setOffer(next);setLastOutcome('');
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
  if(!muted&&Date.now()-lastPing.current>4500){
   lastPing.current=Date.now();play();
  }
 },[enabled,offer,muted,remaining,play]);
 useEffect(()=>()=>{void audio.current?.close()},[]);
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
   setLocationShared(true);
   if(!silent)setLastOutcome('Location refreshed for nearby Wave Buzz matching.');
  }catch{
   setLocationShared(false);
   if(!silent)setError('Please enable precise location in your phone settings to receive nearby jobs.');
  }finally{if(!silent)setBusy(false)}
 },[]);
 useEffect(()=>{
  if(!enabled){setLocationShared(false);return}
  // The Online switch already obtained explicit GPS permission. Refresh only
  // while the app is visible; closed apps require Aly's native location service.
  setLocationShared(true);
  const timer=window.setInterval(()=>{
   if(document.visibilityState==='visible')void shareLocation(true);
  },4*60*1000);
  const onVisible=()=>{if(document.visibilityState==='visible')void shareLocation(true)};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible)};
 },[enabled,shareLocation]);
 async function stopSharing(){
  setBusy(true);setError('');
  try{
   // Offline removes stored coordinates server-side and stops dispatch.
   const r=await fetch('/api/provider/workspace',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'availability',online:false})});
   if(!r.ok)throw Error('Unable to switch offline');
   setLocationShared(false);setOffer(null);
   window.location.reload();
  }catch(e){setError(e instanceof Error?e.message:'Please try again.')}
  finally{setBusy(false)}
 }
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
  <div className="jt-wave-live-controls" aria-label="JiTap Wave Buzz controls">
   <span><Zap size={17}/> Wave Buzz</span>
   <button type="button" onClick={()=>void shareLocation()} disabled={busy}><LocateFixed size={17}/> {locationShared?'Refresh GPS':'Enable GPS'}</button>
   <button type="button" onClick={stopSharing} disabled={busy}>Go offline</button>
   <button type="button" onClick={()=>{setMuted(x=>!x);if(muted){try{audio.current||(audio.current=new AudioContext());void audio.current.resume()}catch{}}}} aria-pressed={!muted}>{muted?<VolumeX size={17}/>:<Volume2 size={17}/>} {muted?'Enable chime':'Mute'}</button>
   <Link href="/provider/wave-buzz">Test Wave Buzz</Link>
  </div>
  {(error||lastOutcome)&&<p role="status" style={{fontSize:12,margin:'8px 0',color:error?'#aa3030':'#008a3e'}}>{error||lastOutcome}</p>}
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
