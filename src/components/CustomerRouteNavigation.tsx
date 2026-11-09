'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Bell,CalendarDays,ClipboardList,Home,UserRound,Wallet} from 'lucide-react';
import './customer-route-navigation.css';

type Account={accountType?:string;fullName?:string|null};
const destinations=[
 {label:'Home',href:'/account',icon:Home},
 {label:'Requests',href:'/account?tab=requests',icon:ClipboardList},
 {label:'Calendar',href:'/account?tab=calendar',icon:CalendarDays},
 {label:'Wallet',href:'/account?tab=wallet',icon:Wallet},
 {label:'Profile',href:'/account?tab=profile',icon:UserRound}
];
export function CustomerRouteNavigation(){
 const pathname=usePathname();
 const onCustomerRoute=pathname==='/request'||pathname.startsWith('/request/')||pathname==='/track'||pathname==='/services'||pathname.startsWith('/services/')||pathname==='/fundis'||pathname.startsWith('/fundis/');
 const [account,setAccount]=useState<Account|null>(null);
 useEffect(()=>{
  if(!onCustomerRoute){setAccount(null);return}
  let active=true;
  const update=async()=>{
   try{
    const r=await fetch('/api/auth/session',{cache:'no-store',credentials:'same-origin'});
    if(!active)return;
    const a=r.ok?await r.json() as Account:null;
    if(active)setAccount(a?.accountType==='customer'?a:null);
   }catch{if(active)setAccount(null)}
  };
  void update();
  window.addEventListener('jitap:auth-changed',update);
  return()=>{active=false;window.removeEventListener('jitap:auth-changed',update)};
 },[onCustomerRoute]);
 if(!onCustomerRoute||!account)return null;
 const initials=(account.fullName||'Customer').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'J';
 return <div className="jt-customer-route-nav">
  <header className="jt-customer-route-header">
   <Link href="/account" aria-label="Back to JiTap customer homepage"><img src="/images/jitap-logo.svg" alt="JiTap" width={136} height={62}/></Link>
   <div><Link href="/account?tab=requests" aria-label="View service requests"><Bell size={24}/></Link><Link href="/account?tab=profile" className="jt-customer-route-avatar" aria-label="Customer profile">{initials}</Link></div>
  </header>
  <nav className="jt-customer-route-bottom" aria-label="Customer navigation">
   {destinations.map(item=><Link key={item.label} href={item.href} className={item.label==='Requests'?'is-context':''}>
    <item.icon size={23} aria-hidden="true"/><span>{item.label}</span>
   </Link>)}
  </nav>
 </div>
}
