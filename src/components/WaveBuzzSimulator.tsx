'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {BellRing,Volume2,VolumeX,MapPin,Clock3,Zap,CheckCircle2,RotateCcw} from 'lucide-react';
import {waveAtElapsed,WAVE_SECONDS} from '@/lib/wave-buzz';
import './wave-buzz.css';

const providers=[
 {id:'sim-1',name:'Fundi 1',distance:'1.2 km',distanceKm:1.2,eta:'~6 mins',wave:1},
 {id:'sim-2',name:'Fundi 2',distance:'1.8 km',distanceKm:1.8,eta:'~9 mins',wave:1},
 {id:'sim-3',name:'Fundi 3',distance:'3.4 km',distanceKm:3.4,eta:'ETA unavailable',wave:2},
 {id:'sim-4',name:'Fundi 4',distance:'4.6 km',distanceKm:4.6,eta:'ETA unavailable',wave:2},
 {id:'sim-5',name:'Fundi 5',distance:'7.1 km',distanceKm:7.1,eta:'ETA unavailable',wave:3},
] as const;
type State='idle'|'dispatching'|'matched'|'unmatched';
export function WaveBuzzSimulator(){
 const [state,setState]=useState<State>('idle');
 const [startAt,setStartAt]=useState(0);
 const [now,setNow]=useState(0);
 const [muted,setMuted]=useState(false);
 const [declined,setDeclined]=useState<string[]>([]);
 const [winner,setWinner]=useState('');
 const audio=useRef<AudioContext|null>(null);
 const lastPing=useRef(-1);
 const [soundAvailable,setSoundAvailable]=useState(true);
 const elapsed=Math.max(0,now-startAt);
 const wave=waveAtElapsed(elapsed);
 const waveIndex=wave==='ended'?3:wave;
 const remaining=state==='dispatching'&&wave!=='ended'?Math.max(0,WAVE_SECONDS-Math.floor(elapsed/1000)%WAVE_SECONDS):0;
 const live=state==='dispatching'&&wave!=='ended'?providers.filter(p=>p.wave<=wave&&!declined.includes(p.id)):[];
 const active=state==='dispatching'&&wave!=='ended'?providers.filter(p=>p.wave===wave&&!declined.includes(p.id)):[];
 const playPing=useCallback(()=>{
  if(muted)return;
  try{
   const Ctx=window.AudioContext;
   if(!Ctx){setSoundAvailable(false);return}
   const ctx=audio.current||(audio.current=new Ctx());
   void ctx.resume();
   const time=ctx.currentTime;
   [880,1175].forEach((hz,i)=>{
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(hz,time+i*.12);
    gain.gain.setValueAtTime(0.0001,time+i*.12);
    gain.gain.exponentialRampToValueAtTime(.055,time+i*.12+.015);
    gain.gain.exponentialRampToValueAtTime(.0001,time+i*.12+.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time+i*.12);osc.stop(time+i*.12+.23);
   });
  }catch{setSoundAvailable(false)}
 },[muted]);
 const start=()=>{
  setDeclined([]);setWinner('');setState('dispatching');
  setStartAt(Date.now());setNow(Date.now());lastPing.current=-1;
  playPing();
  if('vibrate' in navigator)navigator.vibrate([300,150,300,150,500]);
 };
 useEffect(()=>{
  if(state!=='dispatching')return;
  const tick=window.setInterval(()=>setNow(Date.now()),125);
  return()=>window.clearInterval(tick);
 },[state]);
 useEffect(()=>{
  if(state!=='dispatching')return;
  if(wave==='ended'){setState('unmatched');return}
  const pingBucket=Math.floor(elapsed/4500);
  if(pingBucket>0&&lastPing.current!==pingBucket){lastPing.current=pingBucket;playPing()}
 },[elapsed,state,wave,playPing]);
 useEffect(()=>()=>{void audio.current?.close()},[]);
 const accept=(id:string)=>{
  // Simulation-only first-accept lock; real dispatch uses a database transaction.
  if(state!=='dispatching'||wave==='ended')return;
  const candidate=active.find(x=>x.id===id);
  if(!candidate)return;
  setWinner(id);setState('matched');
  if('vibrate' in navigator)navigator.vibrate(0);
 };
 return <div className="jt-wave-sim">
  <header className="jt-wave-intro">
   <span className="jt-wave-kicker"><Zap size={16}/> JiTap Wave Buzz · Safe simulation</span>
   <h1>Incoming Job Dispatch</h1>
   <p>Try the 0–2 km, 2–5 km and 5–10 km waves in 15-second stages. All providers, distances and times below are fictional demonstration data. No real SMS, booking or location is used.</p>
   <div className="jt-wave-toolbar">
    <button type="button" className="jt-wave-sim-start" onClick={start}><RotateCcw size={17}/>{state==='idle'?'Simulate New Customer Request':'Restart Simulation'}</button>
    <button type="button" className="jt-wave-mute" aria-pressed={muted} onClick={()=>setMuted(x=>!x)}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>} {muted?'Unmute':'Mute'} chime</button>
   </div>
   {!soundAvailable&&<p className="jt-wave-help">Audio is unavailable or restricted in this browser. Haptics also depend on device support.</p>}
  </header>
  <div className="jt-wave-layout">
   <section className="jt-wave-provider-preview" aria-label="Provider incoming job">
    <div className={'jt-wave-sonar '+(state==='dispatching'?'running':'')}>
     <span className="jt-wave-ring jt-wave-ring-one"/><span className="jt-wave-ring jt-wave-ring-two"/><span className="jt-wave-ring jt-wave-ring-three"/>
     <div className="jt-wave-sonar-icon"><BellRing size={38}/></div>
    </div>
    <div className="jt-wave-job-card">
     <div className="jt-wave-card-heading"><strong>{state==='matched'?'Job matched':state==='unmatched'?'Service Operations follow-up':state==='idle'?'Ready for JiTap BUZZ':'Incoming JiTap BUZZ'}</strong><span className="jt-wave-demo-tag">DEMO</span></div>
     <div className="jt-wave-progress"><span style={{width:(state==='dispatching'?(remaining/15*100):state==='matched'?100:0)+'%'}}/></div>
     <div className="jt-wave-countdown">{state==='dispatching'?remaining+'s':state==='idle'?'15s':state==='matched'?'Matched':'Expired'}</div>
     <h2>⚡ Electrical repair</h2>
     <p className="jt-wave-brief">Power socket intermittently tripping in the kitchen.</p>
     <div className="jt-wave-fact"><MapPin size={17}/> City Mall, Nyali · {active[0]?.distance||'Distance pending'}</div>
     <div className="jt-wave-fact"><Clock3 size={17}/> Today · 08:00 EAT</div>
     <p className="jt-wave-ref">JT-F8F814D8 · Simulation only</p>
     {state==='dispatching'&&active.length>0?<div className="jt-wave-actions">
       <button type="button" className="jt-wave-accept" onClick={()=>accept(active[0].id)}>Accept Job</button>
       <button type="button" className="jt-wave-decline" onClick={()=>setDeclined(x=>[...x,active[0].id])}>Decline this offer</button>
      </div>:state==='matched'?<div className="jt-wave-done"><CheckCircle2 size={24}/> Accepted by {providers.find(p=>p.id===winner)?.name||'provider'} · Other offers dismissed</div>:
      <div className="jt-wave-waiting">{state==='unmatched'?'No eligible provider accepted. Customer request remains open for JiTap Service Operations.':state==='idle'?'Start simulation to view the incoming job card.':'No available providers in this wave. Expanding automatically…'}</div>}
    </div>
   </section>
   <section className="jt-wave-system-preview" aria-label="System wave dispatch">
    <h2>Customer dispatch radar</h2>
    <div className="jt-wave-radar" aria-label="Simulation of geographic waves">
     <div className="jt-wave-map-ring ring3"/><div className="jt-wave-map-ring ring2"/><div className="jt-wave-map-ring ring1"/>
     <div className="jt-wave-customer-pin">📍</div>
     {providers.map((p,i)=><span key={p.id} className={'jt-wave-provider-dot '+(state==='dispatching'&&p.wave<=waveIndex?'reached':'')+(winner===p.id?' winner':'')} style={{top:(31+Math.sin((i+1)*2.4)*29)+'%',left:(49+Math.cos((i+1)*2.4)*32)+'%'}} title={p.name+' · '+p.distance}/>)}
    </div>
    <div className="jt-wave-system-status" aria-live="polite">
     {state==='idle'?'Waiting to dispatch':state==='matched'?'Matched · Waves stopped':state==='unmatched'?'No acceptance · SOC review':'Wave '+waveIndex+' · Buzzing '+active.length+' eligible providers'}
    </div>
    <div className="jt-wave-stages">
     {[[1,'0–2 km','0–15s'],[2,'2–5 km','15–30s'],[3,'5–10 km','30–45s']].map(([w,range,time])=>
      <div key={w} className={'jt-wave-stage '+(state==='dispatching'&&waveIndex===w?'active':state==='matched'?'finished':'')}>
       <span>Wave {w}</span><strong>{range}</strong><small>{time}</small>
      </div>)}
    </div>
    <p className="jt-wave-help">Distance is straight-line GPS distance, not route travel time. Real dispatch must not display a guessed ETA.</p>
   </section>
  </div>
 </div>;
}
