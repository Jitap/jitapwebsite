'use client';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
import {Home,ClipboardList,Wallet,CalendarDays,UserRound} from 'lucide-react';
export default function ProviderBottomNavigation(){
 const pathname=usePathname();
 const profile=pathname.startsWith('/provider/profile');
 const requestDetail=pathname.startsWith('/provider/request/');
 const wallet=pathname==='/provider/wallet';
 const calendar=pathname==='/provider/calendar';
 const [section,setSection]=useState('');
 useEffect(()=>{setSection(new URLSearchParams(window.location.search).get('view')==='requests'?'requests':new URLSearchParams(window.location.search).get('section')==='availability'?'calendar':'')},[pathname]);
 // The wallet feature is not active yet; its tab opens the coming-soon preview.
 const items=[
  {name:'Home',href:'/provider',icon:Home,active:!profile&&!requestDetail&&!wallet&&!calendar&&section!=='requests'},
  {name:'Requests',href:'/provider?view=requests',icon:ClipboardList,active:requestDetail||(!profile&&section==='requests')},
  {name:'Wallet',href:'/provider/wallet',icon:Wallet,active:wallet},
  {name:'Calendar',href:'/provider/calendar',icon:CalendarDays,active:calendar},
  {name:'Profile',href:'/provider/profile',icon:UserRound,active:profile&&section!=='calendar'},
 ];
 return <nav className="jt-provider-bottom-nav" aria-label="Provider main navigation">
  <div className="jt-provider-nav-items">{items.map(item=>{
   const Icon=item.icon;
   // Plain links make query-based views reliable when navigating from any profile subsection.
   return <a key={item.name} href={item.href} className={'jt-provider-nav-item'+(item.active?' jt-provider-nav-active':'')} aria-current={item.active?'page':undefined}><Icon size={23} strokeWidth={item.active?2.4:1.9}/><small>{item.name}</small></a>;
  })}</div>
 </nav>;
}
