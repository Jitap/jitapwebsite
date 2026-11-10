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
import {prioritizeActiveRequests} from '@/lib/customer-home-priority';
import {CustomerHomePanels} from '@/components/CustomerHomePanels';
import './customer-home.css';
import './glass-dashboard.css';

type Account={
 authenticated:boolean;accountType:'customer'|'provider';
 primaryAccountType?:'customer'|'provider';phone:string;fullName?:string|null;reviewer?:boolean
};
type Tab='home'|'requests'|'saved'|'wallet'|'profile';
const tabs:Tab[]=['home','requests','saved','wallet','profile'];
export default function AccountPage(){
 const router=useRouter();
 const [account,setAccount]=useState<Account|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [requests,setRequests]=useState<CustomerTicket[]>([]);
 const [requestsLoading,setRequestsLoading]=useState(true);
 const [requestsError,setRequestsError]=useState('');
 const [tab,setTab]=useState<Tab>('home');
 const [activeStory,setActiveStory]=useState<'request'|'track'|'saved'>('request');
 const [showAll,setShowAll]=useState(false);
 const [savedProviders,setSavedProviders]=useState<{id:string;name:string;url:string}[]>([]);

 const readTab=useCallback(()=>{
  const param=new URLSearchParams(window.location.search).get('tab');
  const next=param&&tabs.includes(param as Tab)?param as Tab:'home';
  setTab(next);
  if(next==='requests')setActiveStory('track');
  else if(next==='saved')setActiveStory('saved');
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
 const refreshRequests=useCallback(async()=>{
  try{
   const response=await fetch('/api/account/requests',{cache:'no-store',credentials:'same-origin'});
   if(!response.ok)throw Error('Request refresh failed');
   const data=await response.json();
   if(!Array.isArray(data.requests))throw Error('Invalid request history');
   setRequests(data.requests);
   setRequestsError('');
  }catch{
   setRequestsError('Request history is temporarily unavailable.');
  }finally{
   setRequestsLoading(false);
  }
 },[]);
 useEffect(()=>{
  if(account?.accountType!=='customer')return;
  void refreshRequests();
  const onFocus=()=>void refreshRequests();
  const onVisible=()=>{if(document.visibilityState==='visible')void refreshRequests()};
  const interval=window.setInterval(onVisible,15000);
  window.addEventListener('focus',onFocus);
  document.addEventListener('visibilitychange',onVisible);
  return()=>{
   window.clearInterval(interval);
   window.removeEventListener('focus',onFocus);
   document.removeEventListener('visibilitychange',onVisible);
  };
 },[account?.accountType,refreshRequests]);
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
  if(next==='requests')setActiveStory('track');
  else if(next==='saved')setActiveStory('saved');
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
 const activeRequests=useMemo(()=>prioritizeActiveRequests(requests),[requests]);
 const firstName=(account?.fullName||'').trim().split(/\s+/)[0]||'there';
 const initials=(account?.fullName||'Customer').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'J';
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
  {account?.reviewer&&<aside role="status" style={{position:'relative',zIndex:15,padding:'11px 16px',background:'#eaf3ff',color:'#123d69',fontSize:13,borderBottom:'1px solid #b9cfe9',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><span><strong>JiTap Design Review · Customer</strong> — Sample tickets. Production actions are disabled.</span><button type="button" style={{border:'1px solid #296bad',padding:'7px 10px',background:'white',borderRadius:8,color:'#124a86',fontWeight:700}} onClick={()=>void switchProvider()}>Switch to Provider</button></aside>}
  {loading?<div className="jt-customer-loading" role="status">Opening JiTap…</div>:account?.accountType==='customer'?<>
   {header}
   {tab==='home'?<div className="jt-glass-content">
    <section className="jt-glass-welcome">
     <h1>Hello, <span>{firstName}</span></h1>
     <p>What can we help you with today?</p>
    </section>
    <section className="jt-glass-actions jt-story-actions" aria-label="Quick actions">
     <Link href={account?.reviewer?'/services':'/request'} className={'jt-glass-tile jt-story-action jt-story-request'+(activeStory==='request'?' is-story-active':'')} onClick={()=>setActiveStory('request')}>
      <span className="jt-story-ring"><span className="jt-story-inner">
       <img className="jt-glass-quick-icon" src="/images/Request%20Icon%20Service.png" width={86} height={86} alt="" aria-hidden="true"/>
      </span></span>
      <strong>Request<br/>a Service</strong>
     </Link>
     <button type="button" className={'jt-glass-tile jt-story-action jt-story-track'+(activeStory==='track'?' is-story-active':'')} onClick={()=>navigate('requests')}>
      <span className="jt-story-ring"><span className="jt-story-inner">
       <img className="jt-glass-quick-icon" src="/images/Track%20Service.png" width={86} height={86} alt="" aria-hidden="true"/>
      </span></span>
      <strong>Track<br/>Requests</strong>
     </button>
     <button type="button" className={'jt-glass-tile jt-story-action jt-story-saved'+(activeStory==='saved'?' is-story-active':'')} onClick={()=>navigate('saved')}>
      <span className="jt-story-ring"><span className="jt-story-inner">
       <img src="/images/Save%20Providers%20Icon.png" alt="" aria-hidden="true" className="jt-glass-quick-icon" width={86} height={86}/>
      </span></span>
      <strong>Saved<br/>Providers</strong>
     </button>
    </section>
    <CustomerHomePanels
     activeRequests={activeRequests}
     loading={requestsLoading}
     error={requestsError}
     reviewer={!!account.reviewer}
     onRetry={()=>void refreshRequests()}
     onOpenRequests={()=>navigate('requests')}
    />
    <Link className="jt-glass-recommendation" href="/services"><ShieldCheck size={31}/><span><strong>Recommended for You</strong><small>Explore local services in your area.</small></span><ChevronRight size={23}/></Link>
   </div>:tab==='requests'?<section className="jt-glass-subpage">
    <div className="jt-glass-section-head"><h1>My Requests</h1><Link href="/request">+ New request</Link></div>
    {requestsLoading?<p role="status">Loading your requests…</p>:requestsError?<p role="alert">{requestsError}</p>:
     requests.length===0?<div className="jt-glass-empty"><ClipboardList size={33}/><h2>No requests yet</h2><p>Your requests will appear here when you submit them.</p><Link href={account.reviewer?'/services':'/request'}>Request a Service</Link></div>:
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
    <Link href={account?.reviewer?'/services':'/request'} aria-label="Request a Service" className="jt-glass-central-plus"><Plus size={33}/></Link>
    <button type="button" className={tab==='wallet'?'is-active':''} onClick={()=>navigate('wallet')} aria-current={tab==='wallet'?'page':undefined}><Wallet size={25}/><span>Wallet</span></button>
    <button type="button" className={tab==='profile'?'is-active':''} onClick={()=>navigate('profile')} aria-current={tab==='profile'?'page':undefined}><UserRound size={25}/><span>Profile</span></button>
   </nav>
  </>:null}
 </main>;
}
