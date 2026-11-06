'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {BriefcaseBusiness,ClipboardList,LogOut,MapPin,UserRound,Wrench} from 'lucide-react';
type Account={authenticated:boolean;accountType:'customer'|'provider';phone:string;fullName?:string|null};
type CustomerRequest={reference:string;category:string;description:string;area:string;status:string;createdAt:string};
export default function AccountPage(){
 const [account,setAccount]=useState<Account|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [requests,setRequests]=useState<CustomerRequest[]>([]);
 const [requestsLoading,setRequestsLoading]=useState(true);
 const [requestsError,setRequestsError]=useState('');
 const router=useRouter();
 useEffect(()=>{
  if(account?.accountType!=='customer')return;
  let active=true;
  fetch('/api/account/requests',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Unable to load');return r.json()}).then(data=>{if(active)setRequests(Array.isArray(data.requests)?data.requests:[])}).catch(()=>{if(active)setRequestsError('Request history is temporarily unavailable.')}).finally(()=>{if(active)setRequestsLoading(false)});
  return()=>{active=false};
 },[account?.accountType]);
 useEffect(()=>{let active=true;fetch('/api/auth/session',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Sign in required');return r.json()}).then(data=>{if(active)setAccount(data)}).catch(()=>{if(active)router.replace('/login?mode=login')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[router]);
 async function signOut(){const r=await fetch('/api/auth/session',{method:'DELETE'});if(!r.ok){setError('Unable to sign out. Please try again.');return}window.dispatchEvent(new Event('jitap:auth-changed'));router.replace('/login?mode=login');router.refresh()}
 return <main className="jt-account-page"><div className="container jt-account-shell">
  {loading?<p role="status">Checking your JiTap account…</p>:account?<>
   <div className="jt-account-head"><span><UserRound size={25}/></span><div><p>JITAP ACCOUNT</p><h1>{account.fullName?('Habari, '+account.fullName.split(' ')[0]+'!'):'Welcome to JiTap!'}</h1><p>{account.accountType==='provider'?'Your provider account':'Your customer account'}</p></div></div>
   <div className="jt-account-summary"><strong>{account.accountType==='provider'?'Service provider':'Customer'}</strong><span>{account.phone}</span><span>Mobile number verified</span></div>
   <div className="jt-account-cards">
    {account.accountType==='provider'?<><Link href="/providers/apply"><BriefcaseBusiness/><strong>Complete provider onboarding</strong><small>Add your skills and preferred service areas.</small></Link><Link href="/buzz"><ClipboardList/><strong>Provider opportunities</strong><small>Use an authorized invitation to view a request.</small></Link></>:<><Link href="/request"><ClipboardList/><strong>Request a service</strong><small>Describe what you need and where.</small></Link><Link href="/services"><Wrench/><strong>Explore local services</strong><small>Discover JiTap's service categories.</small></Link></>}
   </div>
   {account.accountType==='customer'&&<section className="jt-customer-requests" id="my-requests" aria-labelledby="jt-my-requests-title">
    <div className="jt-customer-requests-head"><div><span>YOUR SERVICE HISTORY</span><h2 id="jt-my-requests-title">My Requests</h2></div><Link href="/request">+ New request</Link></div>
    {requestsLoading?<p role="status">Loading your service requests…</p>:requestsError?<p role="alert">{requestsError}</p>:requests.length===0?<div className="jt-requests-empty"><ClipboardList size={29}/><p>No service requests linked to your account yet.</p><small>When you submit a new request while signed in, it will appear here.</small></div>:
     <div className="jt-requests-list">{requests.map(r=><article key={r.reference} className="jt-request-history-card">
      <div><strong>{r.category.replace(/-/g,' ')}</strong><span className="jt-request-history-status">{r.status==='new'?'Received':r.status==='reviewing'?'Under review':r.status==='handled'?'Handled':r.status==='archived'?'Archived':'In progress'}</span></div>
      <p>{r.description}</p>
      <small>{r.area? r.area+' · ':''}{new Date(r.createdAt).toLocaleDateString('en-KE',{dateStyle:'medium'})} · Ref: JT-{r.reference.slice(0,8).toUpperCase()}</small>
     </article>)}</div>}
   </section>}
   <p className="jt-account-disclaimer">{account.accountType==='provider'?'A provider account does not automatically mean verification, active work allocation, or guaranteed jobs.':'Service requests are coordinated during the pilot; submission does not guarantee a provider match.'}</p>
   {error&&<p role="alert" className="jt-auth-error">{error}</p>}
   <button type="button" className="jt-account-signout" onClick={signOut}><LogOut size={18}/> Log out</button>
  </>:null}
 </div></main>
}
