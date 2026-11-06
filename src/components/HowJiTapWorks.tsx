'use client';
import {useEffect,useRef,useState,type TouchEvent} from 'react';
import {ArrowLeft,ArrowRight,CalendarClock,CheckCircle2,ClipboardPenLine,Pause,Play,UsersRound} from 'lucide-react';

const steps=[
 {key:'ask',short:'ASK',title:'Tell us what you need',description:'Describe the job, your location and when you need help—in English, Kiswahili or Sheng.',icon:ClipboardPenLine,number:'01'},
 {key:'match',short:'MATCH',title:'Find the right local skills',description:'JiTap reviews your request and looks for suitable service providers in the areas they cover. A match depends on availability.',icon:UsersRound,number:'02'},
 {key:'schedule',short:'BUZZ & PLAN',title:'Connect and agree on a time',description:'Once a provider responds, clarify the work, discuss any quote and agree on a suitable time before proceeding.',icon:CalendarClock,number:'03'},
 {key:'done',short:'DONE',title:'Complete the job',description:'Coordinate the work and confirm completion. You can share feedback about your experience.',icon:CheckCircle2,number:'04'}
] as const;
const INTERVAL=4800;
const artworkLabels=['Original illustration of a service request on a phone','Original illustration of a Kenyan service-provider team','Original illustration of a scheduling calendar','Original illustration of a completed home'];
function StepArtwork({step}:{step:number}){return <div role="img" aria-label={artworkLabels[step]} className={`jt-how-original-art jt-how-original-art-${step}`}/>;}
export function HowJiTapWorks(){
 const [active,setActive]=useState(0);
 const [playing,setPlaying]=useState(true);
 const [reducedMotion,setReducedMotion]=useState(false);
 const touchStart=useRef<number|null>(null);
 useEffect(()=>{const mq=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>{setReducedMotion(mq.matches);if(mq.matches)setPlaying(false)};update();mq.addEventListener('change',update);return()=>mq.removeEventListener('change',update)},[]);
 useEffect(()=>{if(!playing||reducedMotion)return;const id=window.setInterval(()=>setActive(n=>(n+1)%steps.length),INTERVAL);return()=>window.clearInterval(id)},[playing,reducedMotion]);
 function select(index:number){setActive((index+steps.length)%steps.length);setPlaying(false)}
 function onTouchStart(e:TouchEvent){touchStart.current=e.touches[0]?.clientX??null}
 function onTouchEnd(e:TouchEvent){if(touchStart.current===null)return;const delta=(e.changedTouches[0]?.clientX??touchStart.current)-touchStart.current;touchStart.current=null;if(Math.abs(delta)>45)select(active+(delta<0?1:-1))}
 return <section className="jt-how" aria-labelledby="jt-how-title">
  <div className="container jt-how-shell">
   <div className="jt-how-header"><span className="jt-how-overline">ASK · MATCH · BUZZ · DONE</span><h2 id="jt-how-title">How <em>JiTap</em> Works</h2><p>Get local services in four simple steps.</p><span className="jt-how-accent" aria-hidden="true"/></div>
   <div className="jt-how-progress" aria-label="Service request journey"><div className="jt-how-progress-track" aria-hidden="true"><div className="jt-how-progress-fill" style={{width:`${active/3*100}%`}}/><div className={'jt-how-progress-pulse'+(playing&&!reducedMotion?' is-moving':'')} style={{left:`${active/3*100}%`}}/></div>
    <div className="jt-how-nodes">{steps.map((step,index)=><button type="button" key={step.key} className={'jt-how-node'+(index===active?' is-active':'')+(index<active?' is-passed':'')} onClick={()=>select(index)} aria-label={`Show step ${index+1}: ${step.title}`} aria-current={index===active?'step':undefined}><span className="jt-how-node-disc"><step.icon size={25} strokeWidth={2.3}/></span><span className="jt-how-node-caption">{step.short}</span></button>)}</div>
   </div>
   <div className="jt-how-viewport" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-roledescription="carousel" aria-label="How JiTap Works steps">
    <div className="jt-how-slides" style={{transform:`translateX(-${active*100}%)`,transitionDuration:reducedMotion?'0ms':undefined}}>
     {steps.map((step,index)=><article key={step.key} className="jt-how-slide" aria-roledescription="slide" aria-label={`Step ${index+1} of 4`} aria-hidden={index!==active}><div className="jt-how-slide-art"><StepArtwork step={index}/></div><div className="jt-how-slide-copy"><span className="jt-how-step-count">STEP {step.number} / 04</span><h3>{step.title}</h3><p>{step.description}</p></div></article>)}
    </div>
   </div>
   <div className="jt-how-controls"><button type="button" className="jt-how-arrow" onClick={()=>select(active-1)} aria-label="Previous step"><ArrowLeft size={20}/></button><div className="jt-how-dots">{steps.map((step,index)=><button key={step.key} type="button" className={'jt-how-dot'+(index===active?' is-active':'')} aria-label={`Go to step ${index+1}`} aria-current={index===active?'step':undefined} onClick={()=>select(index)}/>)}</div><button type="button" className="jt-how-arrow" onClick={()=>select(active+1)} aria-label="Next step"><ArrowRight size={20}/></button><button type="button" className="jt-how-play" onClick={()=>setPlaying(v=>!v)} aria-label={playing?'Pause carousel':'Play carousel'} disabled={reducedMotion}>{playing?<Pause size={17}/>:<Play size={17}/>}<span>{playing?'Pause':'Play'}</span></button></div>
   <p className="jt-how-note">JiTap coordinates enquiries during its pilot. Provider availability, quotations and job completion are not guaranteed.</p>
  </div>
 </section>;
}
