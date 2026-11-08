'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
import {Menu,X,ArrowUpRight,MapPin,ChevronDown} from 'lucide-react';
import {areas,categories} from '@/lib/data';
const links=[['Find Services','/services'],['Find Fundis','/fundis'],['How It Works','/how-it-works'],['Guides','/guides']];
export function Brand(){return <Link href="/" className="brand" aria-label="JiTap home"><img src="/images/jitap-logo.svg" width="156" height="72" alt="JiTap — ASK • MATCH • BUZZ"/></Link>}
export function Header(){const [open,setOpen]=useState(false),[area,setArea]=useState('Bamburi'),[signedIn,setSignedIn]=useState(false),pathname=usePathname();useEffect(()=>{
 let active=true;
 const update=async()=>{
  try{
   const result=await fetch('/api/auth/session',{cache:'no-store',credentials:'same-origin'});
   if(active)setSignedIn(result.ok);
  }catch{if(active)setSignedIn(false)}
 };
 const onVisible=()=>{if(document.visibilityState==='visible')void update()};
 const onFocus=()=>void update();
 const onAccountChange=()=>void update();
 void update();
 window.addEventListener('focus',onFocus);
 window.addEventListener('pageshow',onFocus);
 window.addEventListener('jitap:auth-changed',onAccountChange);
 document.addEventListener('visibilitychange',onVisible);
 return()=>{active=false;window.removeEventListener('focus',onFocus);window.removeEventListener('pageshow',onFocus);window.removeEventListener('jitap:auth-changed',onAccountChange);document.removeEventListener('visibilitychange',onVisible)};
},[pathname]);useEffect(()=>{try{const previous=window.localStorage.getItem('jitap:area');if(previous&&areas.includes(previous))setArea(previous)}catch{}},[]);const accountActive=signedIn||pathname==='/account';function changeArea(value:string){setArea(value);try{window.localStorage.setItem('jitap:area',value)}catch{}window.dispatchEvent(new CustomEvent('jitap:area',{detail:value}));}return <header className="header"><div className="container nav"><Brand/><nav aria-label="Main navigation" className="desktop-nav"><details className="jt-explore"><summary>Explore <ChevronDown size={16}/></summary><div className="jt-explore-panel"><strong>Find local services</strong>{categories.map(c=><Link key={c.slug} href={'/services/'+c.slug}>{c.name}</Link>)}<Link href="/fundis" className="jt-explore-list-all">Browse fundi profiles <ArrowUpRight size={14}/></Link></div></details>{links.slice(1).map(([label,href])=><Link className={pathname===href?'active':''} key={href} href={href}>{label}</Link>)}</nav><Link href={accountActive?"/account":"/login"} className="button nav-button">{accountActive?"My Account":"Sign In"}</Link><button className="menu-button" onClick={()=>setOpen(!open)} aria-label={open?'Close menu':'Open menu'} aria-expanded={open}>{open?<X/>:<Menu/>}</button></div>{open&&<nav className="mobile-nav" aria-label="Mobile navigation">{links.map(([name,href])=><Link key={href} href={href} onClick={()=>setOpen(false)}>{name}</Link>)}<Link href={signedIn?"/account":"/login"} onClick={()=>setOpen(false)}>{signedIn?"My Account":"Sign In"}</Link><Link href="/request" onClick={()=>setOpen(false)}>Find help</Link></nav>}</header>}
export function Footer(){return <footer className="footer"><div className="container foot-grid"><div><Link href="/" className="brand" aria-label="JiTap home"><img src="/images/jitap-logo-white.svg" width="156" height="72" alt="JiTap — ASK • MATCH • BUZZ"/></Link><p>AI-powered real-time local services. Building neighbourhood connections, beginning in Mombasa.</p></div><div><h3>Customers</h3><Link href="/services">Services</Link><Link href="/request">Find help</Link><Link href="/how-it-works">How it works</Link><Link href="/faq">FAQs</Link></div><div><h3>JiTap</h3><Link href="/fundis">Find fundis</Link><Link href="/providers">Providers</Link><Link href="/app">Our app</Link><Link href="/about">Our story</Link><Link href="/news">News</Link></div><div><h3>Support</h3><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/payments">Payments and refunds</Link><a href="mailto:hello@jitap.app">Email JiTap</a></div></div><div className="container legalfoot">© {new Date().getFullYear()} JiTap. All rights reserved. <span>ASK • MATCH • BUZZ</span></div></footer>}
