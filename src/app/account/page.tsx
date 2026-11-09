'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {
 ArrowRight,Bell,BriefcaseBusiness,CalendarDays,Check,ChevronRight,
 ClipboardList,Clock3,Eye,Home,LogOut,MapPin,Phone,Plus,
 ShieldCheck,UserRound,Wallet
} from 'lucide-react';
import {CustomerTicketCard,type CustomerTicket} from '@/components/CustomerTicketCard';
import './customer-home.css';
import './glass-dashboard.css';

type Account={
 authenticated:boolean;accountType:'customer'|'provider';
 primaryAccountType?:'customer'|'provider';phone:string;fullName?:string|null
};
type Tab='home'|'requests'|'saved'|'wallet'|'profile';
const tabs:Tab[]=['home','requests','saved','wallet','profile'];
const services=[
 {name:'Plumbing',slug:'plumbing',icon:'🚰'},
 {name:'Electrical',slug:'electrical',icon:'⚡'},
 {name:'Cleaning',slug:'cleaning',icon:'🧹'},
 {name:'Handyman',slug:'general-repairs',icon:'🛠️'}
];
function dateLabel(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return 'Date to be confirmed';
 const d=new Date(value+'T12:00:00Z');
 if(Number.isNaN(d.getTime()))return 'Date to be confirmed';
 return d.toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
}
function currentStage(ticket:CustomerTicket):number {
 const state=(ticket.status+' '+ticket.statusLabel+' '+ticket.providerStatus).toLowerCase();
 if(/complet|finish|done/.test(state))return 4;
 if(/in.progress|work.started|ongoing|working/.test(state))return 3;
 if(/en.route|on.the.way|travell/.test(state))return 2;
 if(/accepted|matched|assigned|confirmed/.test(state))return 1;
 return 0;
}
function activeTicket(ticket:CustomerTicket){
 const state=(ticket.status+' '+ticket.statusLabel).toLowerCase();
 return !/complet|cancel|reject|clos|declin/.test(state);
}
function requestPath(ticket:CustomerTicket){
 return '/track?ref='+encodeURIComponent(ticket.serviceId);
}
function timeLabel(ticket:CustomerTicket){
 const when=dateLabel(ticket.date);
 return ticket.time?when+' · '+ticket.time+' EAT':when;
}

export default function AccountPage(){
 const router=useRouter();
 const [account,setAccount]=useState<Account|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [requests,setRequests]=useState<CustomerTicket[]>([]);
 const [requestsLoading,setRequestsLoading]=useState(true);
 const [requestsError,setRequestsError]=useState('');
 const [tab,setTab]=useState<Tab>('home');
 const [showAll,setShowAll]=useState(false);
 const [savedProviders,setSavedProviders]=useState<{id:string;name:string;url:string}[]>([]);

 const readTab=useCallback(()=>{
  const param=new URLSearchParams(window.location.search).get('tab');
  setTab(param&&tabs.includes(param as Tab)?param as Tab:'home');
 },[]);
 useEffect(()=>{
  readTab();
  window.addEventListener('popstate',readTab);
  return()=>window.removeEventListener('popstate',readTab);
 },[readTab]);
 useEffect(()=>{
  let active=true;
  fetch('/api/auth/session',{cache:'no-store',credentials:'same-origin'})
   .then(async r=>{if(!r.ok)throw Error('Sign in required');return r.json()})
   .then(data=>{if(active){setAccount(data);if(data.accountType==='provider')router.replace('/provider')}})
   .catch(()=>{if(active)router.replace('/login?role=customer')})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[router]);
 useEffect(()=>{
  if(account?.accountType!=='customer')return;
  let active=true;
  const refresh=()=>fetch('/api/account/requests',{cache:'no-store',credentials:'same-origin'})
   .then(async r=>{if(!r.ok)throw Error('Unable to load requests');return r.json()})
   .then(data=>{if(active){setRequests(Array.isArray(data.requests)?data.requests:[]);setRequestsError('')}})
   .catch(()=>{if(active)setRequestsError('Request history is temporarily unavailable.')})
   .finally(()=>{if(active)setRequestsLoading(false)});
  void refresh();
  const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh()},15000);
  return()=>{active=false;window.clearInterval(interval)};
 },[account?.accountType]);
 useEffect(()=>{
  if(account?.accountType!=='customer')return;
  try{
   const key='jitap:saved-providers:'+(account.phone||'customer');
   const parsed=JSON.parse(localStorage.getItem(key)||'[]') as unknown;
   if(Array.isArray(parsed)){
    setSavedProviders(parsed.filter((v):v is {id:string;name:string;url:string}=>
     !!v&&typeof v==='object'&&typeof v.id==='string'&&typeof v.name==='string'&&
     typeof v.url==='string'&&v.url.startsWith('/fundis/')).slice(0,100));
   }
  }catch{}
 },[account?.accountType,account?.phone]);
 function navigate(next:Tab){
  setTab(next);
  const nextUrl=next==='home'?'/account':'/account?tab='+next;
  window.history.pushState(null,'',nextUrl);
  window.scrollTo({top:0,behavior:'smooth'});
 }
 async function switchProvider(){
  setError('');
  try{
   const r=await fetch('/api/auth/mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'provider'})});
   if(!r.ok)throw Error('Unable to switch mode');
   window.dispatchEvent(new Event('jitap:auth-changed'));
   router.push('/provider');router.refresh();
  }catch{setError('Could not open provider onboarding.')}
 }
 async function signOut(){
  try{
   const r=await fetch('/api/auth/session',{method:'DELETE'});
   if(!r.ok)throw Error('Unable to sign out');
   window.dispatchEvent(new Event('jitap:auth-changed'));
   router.replace('/login?role=customer');router.refresh();
  }catch{setError('Unable to sign out. Please try again.')}
 }
 const needsAttention=requests.filter(r=>!!r.rematch).length;
 const current=useMemo(()=>requests.find(r=>activeTicket(r))||null,[requests]);
 const stage=current?currentStage(current):0;
 const firstName=(account?.fullName||'').trim().split(/\s+/)[0]||'there';
 const initials=(account?.fullName||'Customer').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'J';
 const steps=['Requested','Matched','En Route','In Progress','Completed'] as const;
 const displayTickets=showAll?requests:requests.slice(0,3);
 const header=(
  <header className="jt-glass-header">
   <Link href="/account" aria-label="JiTap Home" onClick={e=>{e.preventDefault();navigate('home')}}>
    <img src="/images/jitap-logo-transparent.svg" alt="JiTap" width={149} height={59}/>
   </Link>
   <div className="jt-glass-header-actions">
    <button type="button" aria-label={needsAttention?needsAttention+' requests need action':'Open requests'} className="jt-glass-notification" onClick={()=>navigate('requests')}>
     <Bell size={24}/>{needsAttention>0&&<span className="jt-glass-count">{needsAttention}</span>}
    </button>
    <button type="button" aria-label="Open customer profile" className="jt-glass-avatar" onClick={()=>navigate('profile')}>{initials}</button>
   </div>
  </header>
 );
 return <main className="jt-customer-app jt-glass-app">
  {loading?<div className="jt-customer-loading" role="status">Opening JiTap…</div>:account?.accountType==='customer'?<>
   {header}
   {tab==='home'?<div className="jt-glass-content">
    <section className="jt-glass-welcome">
     <h1>Hello, <span>{firstName}</span></h1>
     <p>Request, track and manage your services all in one place.</p>
    </section>
    <section className="jt-glass-actions" aria-label="Quick actions">
     <Link href="/request" className="jt-glass-tile jt-glass-tile-request">
      <span className="jt-glass-action-icon"><Home size={35}/><Plus className="jt-glass-action-plus" size={20}/></span>
      <strong>Request<br/>a Service</strong>
     </Link>
     <button type="button" className="jt-glass-tile" onClick={()=>navigate('requests')}>
      <span className="jt-glass-action-icon jt-glass-track-icon"><MapPin size={39} fill="#f04e53" stroke="#182579" strokeWidth={1.8}/></span>
      <strong>Track<br/>Requests</strong>
     </button>
     <button type="button" className="jt-glass-tile" onClick={()=>navigate('saved')}>
      <img src="/images/197bfed06ab38ebd786c364ec8869d2e.jpg" alt="" className="jt-glass-save-icon"/>
      <strong>Saved<br/>Providers</strong>
     </button>
    </section>
    <section className="jt-glass-explore" aria-labelledby="jt-glass-explore-title">
     <div className="jt-glass-section-head"><h2 id="jt-glass-explore-title">Explore Services</h2><Link href="/services">View All <ChevronRight size={21}/></Link></div>
     <div className="jt-glass-services">{services.map(service=><Link key={service.slug} href={'/request?category='+encodeURIComponent(service.slug)} className="jt-glass-service-tile">
      <span className="jt-glass-service-icon" aria-hidden="true">{service.icon}</span><strong>{service.name}</strong>
     </Link>)}</div>
    </section>
    <section className="jt-glass-current" aria-labelledby="jt-glass-current-title">
     <div className="jt-glass-section-head jt-glass-current-heading"><h2 id="jt-glass-current-title"><Clock3 size={25}/> My Current Request</h2></div>
     {requestsLoading?<div className="jt-glass-request-card"><p role="status">Loading your current request…</p></div>:
      requestsError?<div className="jt-glass-request-card"><p role="alert">{requestsError}</p></div>:
      current?<article className="jt-glass-request-card">
       <div className="jt-glass-request-top">
        <span className="jt-glass-request-service-icon" aria-hidden="true">{services.find(s=>s.slug===current.category)?.icon||'🛠️'}</span>
        <div><h3>{current.category.replaceAll('-',' ')}</h3><span className="jt-glass-state">{current.statusLabel||'Requested'}</span></div>
        <small>{current.serviceId}</small>
       </div>
       <div className="jt-glass-request-details">
        <div><UserRound size={17}/><span>{current.provider||'Awaiting provider match'}</span></div>
        <div><CalendarDays size={17}/><span>{timeLabel(current)}</span></div>
        <div><MapPin size={17}/><span>{current.location||current.area||'Location to be confirmed'}</span></div>
       </div>
       <ol className="jt-glass-progress" aria-label="Request progress">
        {steps.map((label,index)=><li className={index<stage?'is-done':index===stage?'is-current':''} key={label}>
         <span className="jt-glass-step-mark">{index<stage?<Check size={13}/>:index===stage?<span className="jt-glass-step-dot"/>:null}</span>
         <small>{label}</small>
        </li>)}
       </ol>
       <div className="jt-glass-request-actions">
        {current.providerPhone?<a href={'tel:'+current.providerPhone.replace(/[^+\d]/g,'')} className="jt-glass-call"><Phone size={19}/> Call</a>:
         <button type="button" className="jt-glass-call" disabled title="Provider contact is available after matching"><Phone size={19}/> Call</button>}
        <Link href={requestPath(current)} className="jt-glass-view"><Eye size={19}/> View</Link>
       </div>
       {current.rematch&&<p className="jt-glass-request-alert">Your provider has cancelled. <button type="button" onClick={()=>navigate('requests')}>Review your rematch options</button></p>}
      </article>:
      <div className="jt-glass-request-card jt-glass-no-request">
       <ClipboardList size={30}/><strong>No active requests yet</strong><p>Need a fundi? Start a service request and track it here.</p><Link href="/request">Request a Service <ArrowRight size={16}/></Link>
      </div>}
    </section>
    <Link className="jt-glass-recommendation" href="/services"><ShieldCheck size={31}/><span><strong>Recommended for You</strong><small>Explore local services in your area.</small></span><ChevronRight size={23}/></Link>
   </div>:tab==='requests'?<section className="jt-glass-subpage">
    <div className="jt-glass-section-head"><h1>My Requests</h1><Link href="/request">+ New request</Link></div>
    {requestsLoading?<p role="status">Loading your requests…</p>:requestsError?<p role="alert">{requestsError}</p>:
     requests.length===0?<div className="jt-glass-empty"><ClipboardList size={33}/><h2>No requests yet</h2><p>Your requests will appear here when you submit them.</p><Link href="/request">Request a Service</Link></div>:
     <div className="jt-requests-list">{displayTickets.map(r=><CustomerTicketCard key={r.reference} ticket={r}/>)}
      {!showAll&&requests.length>3&&<button type="button" className="jt-glass-show-all" onClick={()=>setShowAll(true)}>View all {requests.length} requests <ChevronRight size={16}/></button>}</div>}
   </section>:tab==='saved'?<section className="jt-glass-subpage">
    <div className="jt-glass-section-head"><h1>Saved Providers</h1><Link href="/fundis">Find Providers <ChevronRight size={18}/></Link></div>
    {savedProviders.length?<div className="jt-glass-saved-list">{savedProviders.map(p=><Link href={p.url} key={p.id}><img src="/images/197bfed06ab38ebd786c364ec8869d2e.jpg" alt=""/><strong>{p.name}</strong><ChevronRight size={20}/></Link>)}</div>:
     <div className="jt-glass-empty"><img src="/images/197bfed06ab38ebd786c364ec8869d2e.jpg" alt="" width={42} height={42}/><h2>No saved providers yet</h2><p>Explore local fundis and return to providers you trust.</p><Link href="/fundis">Explore Providers</Link></div>}
   </section>:tab==='wallet'?<section className="jt-glass-subpage"><div className="jt-glass-empty"><Wallet size={37}/><h1>Wallet</h1><p>JiTap Wallet is coming soon. Manage your current jobs in Requests.</p><button type="button" onClick={()=>navigate('requests')}>View Requests</button></div></section>:
   <section className="jt-glass-subpage">
    <h1>My Profile</h1>
    <div className="jt-glass-profile"><span className="jt-glass-avatar jt-glass-avatar-big">{initials}</span><div><h2>{account.fullName||'JiTap Customer'}</h2><p>Customer account</p></div></div>
    <dl className="jt-glass-profile-fields"><div><dt>Mobile number</dt><dd>{account.phone}</dd></div><div><dt>Account status</dt><dd>Mobile number verified</dd></div></dl>
    <div className="jt-glass-profile-actions"><button type="button" onClick={()=>void switchProvider()}><BriefcaseBusiness size={19}/> Switch to Provider</button><button type="button" onClick={()=>void signOut()}><LogOut size={19}/> Log out</button></div>
    {error&&<p role="alert" className="jt-glass-error">{error}</p>}
   </section>}
   <nav className="jt-glass-bottom-nav" aria-label="Customer navigation">
    <button type="button" className={tab==='home'?'is-active':''} onClick={()=>navigate('home')} aria-current={tab==='home'?'page':undefined}><Home size={25}/><span>Home</span></button>
    <button type="button" className={tab==='requests'?'is-active':''} onClick={()=>navigate('requests')} aria-current={tab==='requests'?'page':undefined}><ClipboardList size={25}/><span>Requests</span>{needsAttention>0&&<i className="jt-glass-nav-dot"/>}</button>
    <Link href="/request" aria-label="Request a Service" className="jt-glass-central-plus"><Plus size={33}/></Link>
    <button type="button" className={tab==='wallet'?'is-active':''} onClick={()=>navigate('wallet')} aria-current={tab==='wallet'?'page':undefined}><Wallet size={25}/><span>Wallet</span></button>
    <button type="button" className={tab==='profile'?'is-active':''} onClick={()=>navigate('profile')} aria-current={tab==='profile'?'page':undefined}><UserRound size={25}/><span>Profile</span></button>
   </nav>
  </>:null}
 </main>;
}
