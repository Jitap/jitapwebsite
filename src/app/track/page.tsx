'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowRight,ClipboardCheck,ShieldCheck,LogIn} from 'lucide-react';
import {CustomerTicketCard,type CustomerTicket} from '@/components/CustomerTicketCard';
type Ticket=CustomerTicket;
const progressLabels:Record<string,string>={
 new:'Received — JiTap is reviewing your request',
 incomplete:'Information needed',
 needs_sourcing:'Finding a suitable provider',
 matching:'Matching with local providers',
 provider_contacted:'Provider contacted — awaiting confirmation',
 awaiting_quote:'Waiting for provider quotation',
 scheduled:'Visit scheduled',
 in_progress:'Service in progress',
 completed:'Completed',
 cancelled:'Cancelled',
 closed:'Closed'
};
export default function TrackTicketPage(){
 const router=useRouter();
 const [ref,setRef]=useState('');
 const [ticket,setTicket]=useState<Ticket|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [providerMode,setProviderMode]=useState(false);
 const [switching,setSwitching]=useState(false);
 useEffect(()=>{
  const value=new URLSearchParams(location.search).get('ref')||'';
  setRef(value);
  if(!/^JT-[0-9A-F]{8}$/.test(value)){setError('This tracking link does not contain a valid Service ID.');setLoading(false);return}
  let alive=true;
  fetch('/api/account/track?ref='+encodeURIComponent(value),{cache:'no-store'}).then(async r=>{
   const data=await r.json().catch(()=>({}));
   if(!alive)return;
   if(r.status===401){
    if(data.error==='switch_mode'){setProviderMode(true);setLoading(false);return}
    router.replace('/login?mode=login&next='+encodeURIComponent('/track?ref='+value));return;
   }
   if(!r.ok)throw Error(data.error||'Could not find your ticket.');
   setTicket(data.ticket);
  }).catch(e=>{if(alive)setError(e instanceof Error?e.message:'Tracking is unavailable')})
   .finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[router]);
 async function switchCustomer(){
  setSwitching(true);setError('');
  try{
   const res=await fetch('/api/auth/mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'customer'})});
   if(!res.ok)throw Error('Unable to switch into customer mode');
   window.dispatchEvent(new Event('jitap:auth-changed'));
   window.location.reload();
  }catch(e){setError(e instanceof Error?e.message:'Mode change failed');setSwitching(false)}
 }
 const title=ticket?.category?.replace(/-/g,' ')||'Service request';
 return <main className="jt-account-page"><div className="container jt-account-shell" style={{maxWidth:720,paddingTop:35,paddingBottom:80}}>
  <div className="jt-account-head"><span><ClipboardCheck size={27}/></span><div><p>JITAP SERVICE TRACKING</p><h1>Your service request</h1><p>Private progress updates for your verified mobile number.</p></div></div>
  {loading?<div className="jt-account-summary" role="status">Checking your verified account and Service ID…</div>:providerMode?
   <div className="jt-account-summary"><h2>Switch to customer mode</h2><p>You are signed in as a provider. You can track your own request without affecting your provider account.</p>
    <button className="button" disabled={switching} onClick={switchCustomer}>{switching?'Switching…':'Switch to Customer'} <ArrowRight size={17}/></button></div>:
   ticket?<div className="jt-account-summary">
    <span style={{display:'flex',alignItems:'center',gap:9,color:'#06844b',fontWeight:800}}><ShieldCheck size={20}/> Phone ownership verified</span>
    <CustomerTicketCard ticket={ticket} detail/>
    <p style={{fontSize:13,color:'#64748b'}}>Accepting your request confirms your provider. When confirmed, their phone number appears in your service details.</p>
    <Link href="/account#my-requests" className="button">View My Requests <ArrowRight size={17}/></Link>
   </div>:<div className="jt-account-summary" role="alert"><p>{error}</p><p>If this is your first visit, sign up using the same phone number that received your JiTap SMS.</p>
    <Link className="button" href={'/login?next='+encodeURIComponent('/track?ref='+ref)}>Sign up or log in <LogIn size={17}/></Link></div>}
 </div></main>;
}
