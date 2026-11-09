'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowRight,Bell,BriefcaseBusiness,CalendarDays,ChevronDown,ClipboardList,Home,LogOut,MapPin,Sparkles,UserRound,Wallet} from 'lucide-react';
import {areas,inferService} from '@/lib/data';
import {CustomerTicketCard,type CustomerTicket} from '@/components/CustomerTicketCard';
import './customer-home.css';

type Account={authenticated:boolean;accountType:'customer'|'provider';primaryAccountType?:'customer'|'provider';phone:string;fullName?:string|null};
type Tab='home'|'requests'|'calendar'|'wallet'|'profile';
const tabs:readonly {key:Tab;label:string;icon:typeof Home}[]=[
 {key:'home',label:'Home',icon:Home},
 {key:'requests',label:'Requests',icon:ClipboardList},
 {key:'calendar',label:'Calendar',icon:CalendarDays},
 {key:'wallet',label:'Wallet',icon:Wallet},
 {key:'profile',label:'Profile',icon:UserRound}
];
function humanDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return 'Date to be confirmed';
 const date=new Date(value+'T12:00:00Z');
 return Number.isNaN(date.getTime())?'Date to be confirmed':date.toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
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
 const [area,setArea]=useState('Nyali');
 const [description,setDescription]=useState('');
 useEffect(()=>{
  try{const selected=window.localStorage.getItem('jitap:area');if(selected&&areas.includes(selected))setArea(selected)}catch{}
  const params=new URLSearchParams(window.location.search);
  const section=params.get('tab');
  if(section&&['home','requests','calendar','wallet','profile'].includes(section))setTab(section as Tab);
 },[]);
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
   .then(async r=>{if(!r.ok)throw Error('Unable to load');return r.json()})
   .then(data=>{if(active){setRequests(Array.isArray(data.requests)?data.requests:[]);setRequestsError('')}})
   .catch(()=>{if(active)setRequestsError('Request history is temporarily unavailable.')})
   .finally(()=>{if(active)setRequestsLoading(false)});
  void refresh();
  const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh()},15000);
  return()=>{active=false;window.clearInterval(interval)};
 },[account?.accountType]);
 function navigate(next:Tab){
  setTab(next);
  window.history.replaceState(null,'',next==='home'?'/account':'/account?tab='+next);
  window.scrollTo({top:0,behavior:'smooth'});
 }
 function submitAsk(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const query=description.trim();
  if(!query){setError('Tell JiTap what you need help with.');return}
  setError('');
  const category=inferService(query)||'other-services';
  try{window.localStorage.setItem('jitap:area',area)}catch{}
  router.push('/request?category='+encodeURIComponent(category)+'&area='+encodeURIComponent(area)+'&description='+encodeURIComponent(query));
 }
 async function switchProvider(){
  const r=await fetch('/api/auth/mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'provider'})});
  if(!r.ok){setError('Could not open provider onboarding.');return}
  window.dispatchEvent(new Event('jitap:auth-changed'));router.push('/provider');router.refresh();
 }
 async function signOut(){
  const r=await fetch('/api/auth/session',{method:'DELETE'});
  if(!r.ok){setError('Unable to sign out. Please try again.');return}
  window.dispatchEvent(new Event('jitap:auth-changed'));router.replace('/login?role=customer');router.refresh();
 }
 const needsAttention=requests.filter(r=>!!r.rematch).length;
 const upcoming=requests.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&r.date>=new Date().toISOString().slice(0,10))
  .sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
 const initials=(account?.fullName||'Customer').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join('');
 return <main className="jt-customer-app">
  {loading?<div className="jt-customer-loading" role="status">Opening your JiTap account…</div>:account?.accountType==='customer'?<>
   <header className="jt-customer-topbar">
    <Link href="/account" className="jt-customer-logo" onClick={e=>{e.preventDefault();navigate('home')}} aria-label="JiTap customer home">
     <img src="/images/jitap-logo.svg" alt="JiTap — Ask Match Buzz" width={183} height={96}/>
    </Link>
    <div className="jt-customer-top-actions">
     <button type="button" className="jt-customer-bell" aria-label={needsAttention?needsAttention+' requests need your attention':'View your requests'} onClick={()=>navigate('requests')}>
      <Bell size={31} strokeWidth={1.8}/>{needsAttention>0&&<span className="jt-customer-bell-count">{needsAttention}</span>}
     </button>
     <button type="button" className="jt-customer-avatar" aria-label="Open your profile" onClick={()=>navigate('profile')}>{initials||'J'}</button>
    </div>
   </header>
   {tab==='home'?<>
    <section className="jt-customer-home-panel" aria-label="Ask JiTap and your service history">
     <form className="jt-customer-ask" onSubmit={submitAsk} role="search" aria-label="Ask JiTap for a service">
      <label className="jt-customer-query"><Sparkles size={24} aria-hidden="true"/>
       <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="How can I help you today - e.g. my sink is leaking" aria-label="Describe what you need" maxLength={1500} rows={2} required onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit()}}}/>
      </label>
      <label className="jt-customer-location"><MapPin size={22} aria-hidden="true"/><select aria-label="Service area" value={area} onChange={e=>setArea(e.target.value)}>
       {areas.map(value=><option key={value} value={value}>{value}</option>)}
      </select><ChevronDown size={19} aria-hidden="true"/></label>
      <button className="jt-customer-submit" type="submit">Ask JiTap <ArrowRight size={21} aria-hidden="true"/></button>
     </form>
     {error&&<p className="jt-customer-error" role="alert">{error}</p>}
     <section className="jt-customer-history" aria-labelledby="jt-customer-history-title">
      <div className="jt-customer-history-heading"><div><span className="jt-customer-section-kicker">YOUR SERVICE HISTORY</span><h1 id="jt-customer-history-title">My Requests</h1></div><button type="button" onClick={()=>navigate('requests')}>View all <ArrowRight size={16}/></button></div>
      {requestsLoading?<p role="status">Loading your service requests…</p>:requestsError?<p role="alert">{requestsError}</p>:requests.length===0?
       <div className="jt-customer-empty jt-customer-home-empty"><ClipboardList size={28}/><h2>No service requests yet</h2><p>Once you request a service, you can follow its progress here.</p></div>:
       <div className="jt-requests-list">{requests.slice(0,3).map(r=><CustomerTicketCard ticket={r} key={r.reference}/>)}</div>}
     </section>
    </section>   </>:<section className="jt-customer-tabview">
    {tab==='requests'&&<>
     <div className="jt-customer-view-heading"><div><span className="jt-customer-section-kicker">YOUR SERVICE HISTORY</span><h1>My Requests</h1><p>Keep track of your services and provider updates.</p></div><Link href="/request" className="jt-customer-new-request">+ New request</Link></div>
     {requestsLoading?<p role="status">Loading your requests…</p>:requestsError?<p role="alert">{requestsError}</p>:requests.length===0?<div className="jt-customer-empty"><ClipboardList/><h2>No requests yet</h2><p>Your submitted service requests will appear here.</p><Link href="/request">Request a service</Link></div>:<div className="jt-requests-list">{requests.map(r=><CustomerTicketCard ticket={r} key={r.reference}/>)}</div>}
    </>}
    {tab==='calendar'&&<>
     <div className="jt-customer-view-heading"><div><span className="jt-customer-section-kicker">YOUR SCHEDULE</span><h1>Calendar</h1><p>Requested service dates from your JiTap bookings.</p></div></div>
     {requestsLoading?<p role="status">Loading your schedule…</p>:requestsError?<p role="alert">{requestsError}</p>:!upcoming.length?<div className="jt-customer-empty"><CalendarDays/><h2>No upcoming requests</h2><p>When a service request has a future date, it will appear here.</p><button type="button" onClick={()=>navigate('requests')}>View requests</button></div>:<div className="jt-customer-schedule">{upcoming.map(r=><Link href={'/track?ref='+encodeURIComponent(r.serviceId)} className="jt-customer-schedule-item" key={r.reference}><div><CalendarDays size={22}/><strong>{humanDate(r.date)}</strong></div><div><strong>{r.category.replaceAll('-',' ')}</strong><small>{r.time?r.time+' EAT':'Time to be confirmed'} · {r.location||r.area||'Location pending'}</small></div><ArrowRight size={19}/></Link>)}</div>}
    </>}
    {tab==='wallet'&&<div className="jt-customer-empty jt-customer-wallet"><Wallet/><h1>Wallet</h1><p>JiTap Wallet is coming soon. Your existing service requests remain available in My Requests.</p><button type="button" onClick={()=>navigate('requests')}>View requests</button></div>}
    {tab==='profile'&&<>
     <div className="jt-customer-view-heading"><div><span className="jt-customer-section-kicker">YOUR JITAP ACCOUNT</span><h1>My Profile</h1><p>Your customer details and account options.</p></div></div>
     <div className="jt-customer-profile-card"><span className="jt-customer-profile-avatar">{initials||'J'}</span><div><h2>{account.fullName||'JiTap Customer'}</h2><p>Customer account</p></div></div>
     <div className="jt-customer-profile-row"><span>Mobile number</span><strong>{account.phone}</strong></div>
     <div className="jt-customer-profile-row"><span>Verification</span><strong>Mobile number verified</strong></div>
     <div className="jt-customer-profile-actions"><button type="button" onClick={()=>void switchProvider()}><BriefcaseBusiness size={20}/> Switch to Provider</button><button type="button" onClick={()=>void signOut()}><LogOut size={20}/> Log out</button></div>
     {error&&<p role="alert" className="jt-customer-error">{error}</p>}
    </>}
   </section>}
   <nav className="jt-customer-bottom-nav" aria-label="Customer navigation">
    {tabs.map(item=><button key={item.key} type="button" className={tab===item.key?'is-active':''} aria-current={tab===item.key?'page':undefined} onClick={()=>navigate(item.key)}>
     <item.icon size={27} strokeWidth={2} aria-hidden="true"/><span>{item.label}</span>{item.key==='requests'&&needsAttention>0&&<i className="jt-customer-nav-alert" aria-label={needsAttention+' requests need attention'}/>}
    </button>)}
   </nav>
  </>:null}
 </main>;
}
