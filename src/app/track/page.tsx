'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ClipboardCheck,ShieldCheck,LockKeyhole,Eye,LogIn} from 'lucide-react';
import {CustomerTicketCard,type CustomerTicket} from '@/components/CustomerTicketCard';
import './tracking-green.css';
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
 const [preview,setPreview]=useState<{reference:string;status:string}|null>(null);
 const [signInRequired,setSignInRequired]=useState(false);
 const [switching,setSwitching]=useState(false);
 useEffect(()=>{
  const query=new URLSearchParams(window.location.search);
  const value=query.get('ref')||'',invite=query.get('invite')||'';
  setRef(value);
  if(!/^JT-[0-9A-F]{8}$/.test(value)){setError('This tracking link does not contain a valid JiTap Service ID.');setLoading(false);return}
  let active=true;
  async function openTracking(){
   // The signed preview shows only coarse progress, never contact details.
   if(invite){
    const publicResult=await fetch('/api/track/preview?ref='+encodeURIComponent(value)+'&invite='+encodeURIComponent(invite),{cache:'no-store'}).catch(()=>null);
    if(publicResult?.ok){
     const data=await publicResult.json();
     if(active)setPreview({reference:data.reference,status:data.status});
    }
   }
   const privateResponse=await fetch('/api/account/track?ref='+encodeURIComponent(value),{cache:'no-store'});
   if(!active)return;
   if(privateResponse.status===401){
    const data=await privateResponse.json().catch(()=>({}));
    if(data.error==='switch_mode')setProviderMode(true);
    else setSignInRequired(true);
    return;
   }
   const data=await privateResponse.json().catch(()=>({}));
   if(privateResponse.ok){setTicket(data.ticket);return}
   if(privateResponse.status===403||privateResponse.status===404){setSignInRequired(true);setError('Sign in with the mobile number associated with this booking to view its private details.');return}
   throw Error(data.error||'Could not load your ticket right now.');
  }
  openTracking().catch(e=>{if(active)setError(e instanceof Error?e.message:'Tracking is temporarily unavailable')})
   .finally(()=>{if(active)setLoading(false)});
  const poll=window.setInterval(()=>{
   if(!active||document.visibilityState!=='visible')return;
   fetch('/api/account/track?ref='+encodeURIComponent(value),{cache:'no-store'})
    .then(async r=>r.ok?r.json():null)
    .then(data=>{if(active&&data?.ticket)setTicket(data.ticket)}).catch(()=>{});
  },10000);
  return()=>{active=false;window.clearInterval(poll)};
 },[]);
 async function switchCustomer(){
  setSwitching(true);setError('');
  try{
   const res=await fetch('/api/auth/mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'customer'})});
   if(!res.ok)throw Error('Unable to switch into customer mode');
   window.dispatchEvent(new Event('jitap:auth-changed'));
   window.location.reload();
  }catch(e){setError(e instanceof Error?e.message:'Mode change failed');setSwitching(false)}
 }
 const loginTarget='/login?mode=login&next='+encodeURIComponent('/track?ref='+ref+(typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('invite')?'&invite='+encodeURIComponent(new URLSearchParams(window.location.search).get('invite')!):''));
 const previewStatus:Record<string,string>={scheduled:'Booking scheduled',on_my_way:'Provider on the way',arrived:'Provider arrived',in_progress:'Service in progress',completed:'Service completed',cancelled:'Booking cancelled'};
 return <main className="jt-account-page jt-tracking-page"><div className="jt-tracking-brand"><Link href="/account" aria-label="Back to JiTap home"><img src="/images/jitap-logo-transparent.svg" alt="JiTap" width={110} height={52}/></Link></div><div className="container jt-account-shell" style={{maxWidth:720,paddingTop:35,paddingBottom:80}}>
  <div className="jt-account-head"><span><ClipboardCheck size={27}/></span><div><p>JITAP SERVICE TRACKING</p><h1>Your service request</h1><p>See your booking progress here. Sign in to access full service details.</p></div></div>
  {loading?<div className="jt-account-summary" role="status">Opening your JiTap tracking page…</div>:providerMode?
   <div className="jt-account-summary"><h2>Switch to customer mode</h2><p>You are signed in as a provider. You can track your own request without affecting your provider account.</p>
    <button className="button jt-tracking-action" disabled={switching} onClick={switchCustomer}>{switching?'Switching…':'Switch to Customer'}</button></div>:
   ticket?<div className="jt-account-summary">
    <span style={{display:'flex',alignItems:'center',gap:9,color:'#06844b',fontWeight:800}}><ShieldCheck size={20}/> Phone ownership verified</span>
    <CustomerTicketCard ticket={ticket} detail/>
    <p style={{fontSize:13,color:'#64748b'}}>Accepting your request confirms your provider. When confirmed, their phone number appears in your service details.</p>
    <Link href="/account#my-requests" className="button jt-tracking-action">View My Requests</Link>
   </div>:
   <div className="jt-account-summary jt-tracking-acquisition">
    <span className="jt-tracking-acquisition-icon"><Eye size={22}/> JiTap service tracking</span>
    <h2>{preview?previewStatus[preview.status]||'Booking recorded':'Track your service'}</h2>
    <p>Service ID: <strong>{ref}</strong></p>
    {preview?<p>Your provider has recorded a booking in JiTap. You can follow the service progress here.</p>:
     <p>JiTap connects customers and service providers through a secure service record. Open your booking by signing in with the mobile number used for the request.</p>}
    <div className="jt-tracking-private">
     <LockKeyhole size={21}/>
     <div><strong>View more about your service</strong><p>Sign in or create your free JiTap account to see the provider, appointment, location, service details and updates.</p></div>
    </div>
    {error&&<p className="jt-tracking-muted">{error}</p>}
    <Link href={loginTarget} className="button jt-tracking-action"><LogIn size={17}/> View full service details</Link>
    <p className="jt-tracking-muted">For your privacy, we verify your phone number before revealing personal booking details.</p>
    <Link href="/" className="jt-tracking-discover">Discover more services on JiTap</Link>
   </div>}
 </div></main>;
}
