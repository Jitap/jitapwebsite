'use client';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
import {Home,ClipboardList,Wallet,CalendarDays,UserRound} from 'lucide-react';
export default function ProviderBottomNavigation(){
 const pathname=usePathname();
 const profile=pathname.startsWith('/provider/profile');
 const [section,setSection]=useState('');
 useEffect(()=>{setSection(new URLSearchParams(window.location.search).get('view')==='requests'?'requests':new URLSearchParams(window.location.search).get('section')==='availability'?'calendar':'')},[pathname]);
 // These labels describe real routes. Wallet isn't released, so it isn't a link.
 const items=[
  {name:'Home',href:'/provider',icon:Home,active:!profile&&section!=='requests'},
  {name:'Requests',href:'/provider?view=requests',icon:ClipboardList,active:!profile&&section==='requests'},
  {name:'Wallet',href:'',icon:Wallet,active:false,disabled:true},
  {name:'Calendar',href:'/provider/profile?section=availability',icon:CalendarDays,active:profile&&section==='calendar'},
  {name:'Profile',href:'/provider/profile',icon:UserRound,active:profile&&section!=='calendar'},
 ];
 return <nav className="jt-provider-bottom-nav" aria-label="Provider main navigation">
  <div className="jt-provider-nav-items">{items.map(item=>{
   const Icon=item.icon;
   if(item.disabled)return <span key={item.name} className="jt-provider-nav-item jt-provider-nav-disabled" aria-disabled="true" title="Wallet coming later"><Icon size={23}/><small>{item.name}</small></span>;
   // Plain links make query-based views reliable when navigating from any profile subsection.
   return <a key={item.name} href={item.href} className={'jt-provider-nav-item'+(item.active?' jt-provider-nav-active':'')} aria-current={item.active?'page':undefined}><Icon size={23} strokeWidth={item.active?2.4:1.9}/><small>{item.name}</small></a>;
  })}</div><div className="jt-provider-nav-blue-strip" aria-hidden="true"/>
 </nav>;
}
