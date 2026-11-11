'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,UserRound,MapPin} from 'lucide-react';
import {MatchedFundis} from '@/components/FundiDirectory';
import {IntakeForm} from '@/components/Interactive';
import './request-match.css';

type Brief={savedAt:number;category:string;area:string;description:string;preferredDate:string;preferredTime:string;timing:string};
export function SonarMatcher({avatarUrl,color='#008a3e',status='Finding providers near you...'}:{avatarUrl?:string;color?:string;status?:string}){
 return <div className="jt-sonar" role="status" aria-live="polite" style={{'--sonar-color':color} as React.CSSProperties}>
   <div className="jt-sonar-stage">
    {[0,1,2,3].map(index=><span className="jt-sonar-ring" key={index} style={{animationDelay:(index*0.8)+'s'}} aria-hidden="true"/>)}
    <div className="jt-sonar-avatar">{avatarUrl?<img src={avatarUrl} alt="Provider profile"/>:<UserRound size={44} aria-hidden="true"/>}</div>
   </div>
   <p className="jt-sonar-status">{status}</p>
 </div>;
}
export function RequestMatch(){
 const [brief,setBrief]=useState<Brief|null>(null);
 const [hydrated,setHydrated]=useState(false);
 const [matching,setMatching]=useState(true);
 const [contact,setContact]=useState(false);
 useEffect(()=>{
  try{
   const data=JSON.parse(sessionStorage.getItem('jitap:matched-brief')||'null') as Brief|null;
   if(data&&typeof data.savedAt==='number'&&Date.now()-data.savedAt<45*60*1000&&typeof data.description==='string'&&data.description.length>=8&&typeof data.category==='string'&&typeof data.area==='string')setBrief(data);
  }catch{}
  setHydrated(true);
 },[]);
 useEffect(()=>{
  if(!brief)return;
  const timeout=window.setTimeout(()=>setMatching(false),3200);
  return()=>window.clearTimeout(timeout);
 },[brief]);
 return <main className="jt-match-page">
   <header className="jt-match-header"><Link href="/request" aria-label="Back to service request"><ArrowLeft size={23}/></Link><strong>JiTap</strong><span/></header>
   {!hydrated?<SonarMatcher/>:!brief?<div className="jt-match-empty"><h1>Start with your service request</h1><p>Your job details are not available in this session.</p><Link href="/request">Ask JiTap</Link></div>:matching?<SonarMatcher/>:contact?
    <div className="jt-match-content"><h1>Complete your request</h1><p className="jt-match-info"><MapPin size={17}/>{brief.area} · {brief.preferredDate} · {brief.preferredTime} EAT</p><IntakeForm kind="request" initialCategory={brief.category} initialArea={brief.area} initialDescription={brief.description} initialPreferredDate={brief.preferredDate} initialPreferredTime={brief.preferredTime} initialTiming={brief.timing==='today'?'today':brief.timing==='this-week'?'this-week':'flexible'}/></div>:
    <div className="jt-match-content"><h1>Providers for your service</h1><p className="jt-match-info"><MapPin size={17}/>{brief.area} · {brief.preferredDate} · {brief.preferredTime} EAT</p><MatchedFundis category={brief.category} area={brief.area} onQuotes={()=>setContact(true)}/></div>}
 </main>;
}
