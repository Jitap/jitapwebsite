'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {BriefcaseBusiness,ClipboardList,LogOut,MapPin,UserRound,Wrench} from 'lucide-react';
type Account={authenticated:boolean;accountType:'customer'|'provider';phone:string;fullName?:string|null};
export default function AccountPage(){
 const [account,setAccount]=useState<Account|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const router=useRouter();
 useEffect(()=>{let active=true;fetch('/api/auth/session',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Sign in required');return r.json()}).then(data=>{if(active)setAccount(data)}).catch(()=>{if(active)router.replace('/login?mode=login')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[router]);
 async function signOut(){const r=await fetch('/api/auth/session',{method:'DELETE'});if(!r.ok){setError('Unable to sign out. Please try again.');return}router.replace('/login?mode=login');router.refresh()}
 return <main className="jt-account-page"><div className="container jt-account-shell">
  {loading?<p role="status">Checking your JiTap account…</p>:account?<>
   <div className="jt-account-head"><span><UserRound size={25}/></span><div><p>JITAP ACCOUNT</p><h1>{account.fullName?('Habari, '+account.fullName.split(' ')[0]+'!'):'Welcome to JiTap!'}</h1><p>{account.accountType==='provider'?'Your provider account':'Your customer account'}</p></div></div>
   <div className="jt-account-summary"><strong>{account.accountType==='provider'?'Service provider':'Customer'}</strong><span>{account.phone}</span><span>Mobile number verified</span></div>
   <div className="jt-account-cards">
    {account.accountType==='provider'?<><Link href="/providers/apply"><BriefcaseBusiness/><strong>Complete provider onboarding</strong><small>Add your skills and preferred service areas.</small></Link><Link href="/buzz"><ClipboardList/><strong>Provider opportunities</strong><small>Use an authorized invitation to view a request.</small></Link></>:<><Link href="/request"><ClipboardList/><strong>Request a service</strong><small>Describe what you need and where.</small></Link><Link href="/services"><Wrench/><strong>Explore local services</strong><small>Discover JiTap's service categories.</small></Link></>}
   </div>
   <p className="jt-account-disclaimer">{account.accountType==='provider'?'A provider account does not automatically mean verification, active work allocation, or guaranteed jobs.':'Service requests are coordinated during the pilot; submission does not guarantee a provider match.'}</p>
   {error&&<p role="alert" className="jt-auth-error">{error}</p>}
   <button type="button" className="jt-account-signout" onClick={signOut}><LogOut size={18}/> Log out</button>
  </>:null}
 </div></main>
}
