'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ProviderShowcase,type Profile} from '@/components/ProviderShowcase';

export function MovingMatches(){
 const [profiles,setProfiles]=useState<Profile[]>([]);
 const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
 useEffect(()=>{
  const controller=new AbortController();
  fetch('/api/providers/public',{signal:controller.signal})
   .then(async r=>{if(!r.ok)throw new Error('Could not load movers');return r.json()})
   .then(data=>{setProfiles(Array.isArray(data.profiles)?data.profiles:[]);setState('ready')})
   .catch(e=>{if(e?.name!=='AbortError')setState('error')});
  return()=>controller.abort();
 },[]);
 return <section className="jt-moving-matches" aria-label="Moving and relocation provider matches">
  {state==='loading'?<p role="status">Finding matching movers…</p>:
   state==='error'?<p role="status">Movers are temporarily unavailable. You can still submit a moving request.</p>:
   <><div className="jt-moving-matches-heading"><span className="th-overline">LOCAL SERVICE MATCHES</span><h2>{profiles.length} {profiles.length===1?'Match':'Matches'} found</h2><p>Moving and relocation providers serving JiTap customers. View a profile before submitting your request.</p></div>
   {profiles.length?profiles.map(p=><ProviderShowcase key={p.id} profile={p}/>):<div className="td-empty"><p>No matching movers listed yet. JiTap can still review your request.</p><Link href="/providers/apply">Are you a mover? Join JiTap</Link></div>}</>}
 </section>;
}
