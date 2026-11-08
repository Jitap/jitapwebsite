'use client';
import {useEffect,useRef,useState} from 'react';
import {BellRing,CalendarClock,X,MessageCircle,Check} from 'lucide-react';
type Reminder={id:string;appointmentId:string;requestId:string;dueAt:string;startsAt:string|null;title:string;customerName:string;phone:string;location:string;channel:'in_app'|'whatsapp_manual'};
export function ProviderDueReminders(){
 const [items,setItems]=useState<Reminder[]>([]);
 const [enabled,setEnabled]=useState(false);
 const [error,setError]=useState('');
 const lastNotified=useRef<Set<string>>(new Set());
 useEffect(()=>{
  let active=true;
  const refresh=async()=>{
   if(!active||document.visibilityState==='hidden')return;
   try{
    const r=await fetch('/api/provider/reminders',{cache:'no-store'});
    if(!r.ok)return;
    const data=await r.json() as {reminders?:Reminder[]};
    if(!active)return;
    const next=data.reminders||[];setItems(next);
    if('Notification' in window&&Notification.permission==='granted'){
     for(const a of next){
      if(lastNotified.current.has(a.id))continue;
      lastNotified.current.add(a.id);
      new Notification('JiTap job reminder',{body:a.title+' · '+a.customerName+' · '+a.location,tag:'jitap-reminder-'+a.id});
     }
    }
   }catch{}
  };
  void refresh();
  const timer=window.setInterval(()=>void refresh(),60000);
  const focus=()=>void refresh();
  window.addEventListener('focus',focus);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',focus)};
 },[]);
 async function dismiss(id:string){
  setError('');
  try{
   const response=await fetch('/api/provider/reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
   if(!response.ok)throw Error('Could not dismiss reminder');
   setItems(x=>x.filter(r=>r.id!==id));
  }catch{setError('Unable to dismiss reminder right now.')}
 }
 async function enableNotifications(){
  if(!('Notification' in window)){setError('This browser does not support system notifications. In-app reminders remain available.');return}
  const status=await Notification.requestPermission();setEnabled(status==='granted');
  if(status!=='granted')setError('Browser notifications were not enabled. In-app reminders remain available.');
 }
 if(!items.length)return null;
 return <aside className="jt-due-reminder-panel" aria-label="Due job reminders">
  <header><span><BellRing size={18}/> Job reminders <strong>{items.length}</strong></span>{!enabled&&'Notification' in globalThis&&Notification.permission==='default'&&<button type="button" onClick={()=>void enableNotifications()}>Enable alerts</button>}</header>
  {items.slice(0,4).map(r=><article key={r.id}>
   <button className="jt-due-dismiss" type="button" aria-label="Dismiss reminder" onClick={()=>void dismiss(r.id)}><X size={17}/></button>
   <strong>{r.title}</strong><p>{r.customerName} · {r.location}</p>
   <small><CalendarClock size={13}/>{r.startsAt?new Date(r.startsAt).toLocaleString('en-KE',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Nairobi'}):'Scheduled booking'}</small>
   <div className="jt-due-actions">
    {r.channel==='whatsapp_manual'&&r.phone&&<a href={'https://wa.me/'+r.phone.replace(/[^0-9]/g,'')+'?text='+encodeURIComponent('Hello '+r.customerName+', this is a JiTap reminder about '+r.title+' scheduled for '+(r.startsAt?new Date(r.startsAt).toLocaleString('en-KE',{timeZone:'Africa/Nairobi',dateStyle:'medium',timeStyle:'short'}):'your appointment')+'. Service ID JT-'+r.requestId.slice(0,8).toUpperCase()+'.')} target="_blank" rel="noopener noreferrer"><MessageCircle size={15}/> Send via WhatsApp</a>}
    <a href={'/provider/calendar?job='+encodeURIComponent(r.requestId)}><CalendarClock size={15}/> Open job</a>
    <button type="button" onClick={()=>void dismiss(r.id)}><Check size={15}/> Done</button>
   </div>
  </article>)}
  {items.length>4&&<small>{items.length-4} additional reminders pending</small>}
  {error&&<p role="alert">{error}</p>}
 </aside>;
}
