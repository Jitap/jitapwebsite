'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {BadgeCheck,Check,ContactRound,Gift,Link2,PhoneOff,Plus,Share2,ShieldCheck,UserRoundCheck,UsersRound,X} from 'lucide-react';
import './network-panel.css';

type Connection={providerId?:string;customerId?:string;name?:string;status:string;businessName?:string|null;categories?:string[];area?:string|null};
type Invitation={id:string;status:string;discountPercent:number;discountCapKes:number};
type State={ok:boolean;role:'customer'|'provider';discoverable?:boolean;connections:Connection[];invites?:Invitation[];reviewer?:boolean};
type Match={providerId:string;matched:boolean;label:string};
type ContactApi={select:(properties:string[],options:{multiple:boolean})=>Promise<Array<{name?:string[];tel?:string[]}>>};
function phoneError(phone:string){return /^(?:\+?254|0)?[17]\d{8}$/.test(phone.replace(/[\s()-]/g,''))?'':'Enter a valid Kenyan mobile number.';}
async function readResponse(response:Response){
 const data=await response.json().catch(()=>({})) as Record<string,unknown>;
 if(!response.ok)throw Error(typeof data.error==='string'?data.error:'Something went wrong. Try again.');
 return data;
}
export function NetworkPanel({mode,reviewer=false,saved=[]}:{mode:'customer'|'provider';reviewer?:boolean;saved?:{id:string;name:string;url:string}[]}){
 const [state,setState]=useState<State|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [phone,setPhone]=useState('');
 const [label,setLabel]=useState('');
 const [matches,setMatches]=useState<Match[]>([]);
 const [supportsPicker,setSupportsPicker]=useState(false);
 const requestLock=useRef(false);
 const load=useCallback(async()=>{
  const res=await fetch('/api/network',{cache:'no-store',credentials:'same-origin'});
  const data=await readResponse(res) as unknown as State;
  setState(data);
 },[]);
 useEffect(()=>{
  const nav=navigator as Navigator&{contacts?:ContactApi};
  setSupportsPicker(!!nav.contacts?.select);
  let live=true;
  load().catch(e=>{if(live)setError(e instanceof Error?e.message:'Network unavailable')}).finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[load]);
 async function mutate(action:string,fields:Record<string,unknown>={}){
  if(requestLock.current||reviewer||state?.reviewer)return null;
  requestLock.current=true;setBusy(true);setError('');setMessage('');
  try{
   const response=await fetch('/api/network',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
    body:JSON.stringify({action,...fields})});
   const data=await readResponse(response);
   if(action!=='match')await load();
   return data;
  }catch(e){setError(e instanceof Error?e.message:'Action failed');return null}
  finally{requestLock.current=false;setBusy(false)}
 }
 async function matchOne(number:string,name:string){
  if(phoneError(number)){setError(phoneError(number));return}
  const result=await mutate('match',{phone:number});
  if(result?.matched&&typeof result.providerId==='string'){
   setMatches(old=>old.some(m=>m.providerId===result.providerId)?old:[...old,{providerId:result.providerId as string,matched:true,label:name.trim()||'Contact'}]);
   setMessage('JiTap found an eligible provider in your selected contacts. Send a connection request to continue.');
  }else if(result)setMessage('No discoverable provider match. You can invite this fundi to JiTap.');
 }
 async function pickContacts(){
  const api=(navigator as Navigator&{contacts?:ContactApi}).contacts;
  if(!api?.select)return;
  setError('');setMessage('');
  try{
   const chosen=await api.select(['name','tel'],{multiple:true});
   if(chosen.length>10){setError('Select up to 10 contacts at a time.');return}
   for(const person of chosen){
    const tel=person.tel?.[0];
    if(tel&&!phoneError(tel))await matchOne(tel,person.name?.[0]||'Contact');
   }
  }catch(e){
   // A user-cancelled picker should not show an alarming error.
   if(e instanceof Error&&e.name!=='AbortError')setError('Could not open contacts. You can enter a fundi’s number below.');
  }
 }
 async function connect(match:Match){
  const result=await mutate('request',{providerId:match.providerId});
  if(result){setMatches(old=>old.filter(x=>x.providerId!==match.providerId));setMessage('Connection requested. The fundi must accept before you can see their JiTap profile.')}
 }
 async function invite(){
  const result=await mutate('invite');
  if(!result||typeof result.inviteId!=='string')return;
  const url=window.location.origin+'/login?role=provider&invite='+encodeURIComponent(result.inviteId);
  const share={title:'Join JiTap as a service provider',text:'I would like to invite you to JiTap. Join as a service provider using my invitation link:',url};
  if(navigator.share){
   try{await navigator.share(share);setMessage('Invitation ready. Discount eligibility is recorded when a new fundi joins and is approved.')}catch(e){
    if(e instanceof Error&&e.name!=='AbortError')setError('Could not open sharing. Try copying the invitation link.');
   }
  }else{
   try{await navigator.clipboard.writeText(url);setMessage('Invitation link copied. Share it with a fundi you know.')}
   catch{setMessage('Invitation link: '+url)}
  }
 }
 if(loading)return <section className="jt-network-loading" role="status">Opening your network…</section>;
 return <section className="jt-network" aria-label={mode==='customer'?'My Network':'Provider Network'}>
  <header className="jt-network-header">
   <span className="jt-network-emblem"><UsersRound size={25}/></span>
   <div><h1>{mode==='customer'?'My Network':'My Connections'}</h1><p>{mode==='customer'?'Find fundis already in your contacts. Connect, invite and grow your trusted network.':'Manage contact discovery and customer connection requests.'}</p></div>
  </header>
  {error&&<p className="jt-network-alert" role="alert">{error}</p>}
  {message&&<p className="jt-network-success" role="status">{message}</p>}
  {(reviewer||state?.reviewer)&&<p className="jt-network-note">Design-review mode. No real contacts are scanned and no connection or referral is created.</p>}
  {mode==='customer'?<>
   <div className="jt-network-card">
    <div className="jt-network-card-heading"><ContactRound size={22}/><h2>Find My Fundis</h2></div>
    <p>Only providers already in your selected contacts who choose to be discoverable can appear here. Their profiles remain private until they accept your connection.</p>
    {supportsPicker&&<button type="button" className="jt-network-primary" disabled={busy||reviewer} onClick={()=>void pickContacts()}><ContactRound size={18}/> Choose phone contacts</button>}
    <form className="jt-network-search" onSubmit={e=>{e.preventDefault();void matchOne(phone,label)}}>
     <label htmlFor="jt-network-contact-name">Contact name (as saved in your phone)</label>
     <input id="jt-network-contact-name" value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Peter Plumber" maxLength={70}/>
     <label htmlFor="jt-network-contact-phone">Fundi's mobile number</label>
     <input id="jt-network-contact-phone" type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+254 7XX XXX XXX" required/>
     <button type="submit" className="jt-network-secondary" disabled={busy||reviewer||!phone}>Check selected contact</button>
    </form>
    <div className="jt-network-privacy"><ShieldCheck size={17}/> We never publish imported contacts or reveal provider phone numbers through My Network.</div>
    {matches.map(m=><div key={m.providerId} className="jt-network-person">
     <span className="jt-network-avatar"><UserRoundCheck size={21}/></span>
     <div><strong>{m.label}</strong><small>In your contacts · Discoverable on JiTap</small></div>
     <button type="button" onClick={()=>void connect(m)} disabled={busy||reviewer} aria-label={'Connect with '+m.label}><Plus size={18}/> Connect</button>
    </div>)}
   </div>
   <div className="jt-network-card">
    <div className="jt-network-card-heading"><Gift size={22}/><h2>Invite a Fundi</h2></div>
    <p>Know a fundi who should join JiTap? Share a personal registration link. Earn eligibility for <strong>10% off an eligible service (up to KES 300)</strong> after a new provider joins and is approved.</p>
    <button type="button" className="jt-network-primary" onClick={()=>void invite()} disabled={busy||reviewer}><Share2 size={18}/> Invite via WhatsApp or share</button>
    <small className="jt-network-terms">One reward per eligible new provider; not stackable. Rewards are tracked during the pilot and are not yet redeemable at checkout.</small>
    {!!state?.invites?.length&&<div className="jt-network-invitations"><h3>My invitations</h3>{state.invites.slice(0,8).map(inv=><div key={inv.id}><Gift size={16}/><span>{inv.status==='qualified'?'Provider approved · reward eligible':inv.status==='claimed'?'Provider joined · awaiting approval':'Invitation created'}</span></div>)}</div>}
   </div>
   <div className="jt-network-card">
    <div className="jt-network-card-heading"><UsersRound size={22}/><h2>My Connections</h2></div>
    {!state?.connections?.length?<p>No connections yet. Connect with a fundi you already know to build your network.</p>:
    state.connections.map(c=><div key={c.providerId} className="jt-network-person">
     <span className="jt-network-avatar">{c.status==='accepted'?<BadgeCheck size={21}/>:<UsersRound size={21}/>}</span>
     <div><strong>{c.status==='accepted'?(c.businessName||'Connected fundi'):'Connection requested'}</strong>
      <small>{c.status==='accepted'?[(c.categories||[]).join(', '),c.area].filter(Boolean).join(' · '):'Awaiting provider approval · Private profile'}</small>
     </div>
     <span className={'jt-network-state '+(c.status==='accepted'?'accepted':'')}>{c.status==='accepted'?'Connected':'Pending'}</span>
    </div>)}
   </div>
   {!!saved.length&&<div className="jt-network-card">
    <div className="jt-network-card-heading"><Link2 size={21}/><h2>Saved Providers</h2></div>
    {saved.map(provider=><Link className="jt-network-saved" key={provider.id} href={provider.url}>{provider.name} <span>View</span></Link>)}
   </div>}
  </>:<>
   <div className="jt-network-card">
    <div className="jt-network-card-heading"><ShieldCheck size={22}/><h2>Contact discovery</h2></div>
    <p>Let customers who already have your number saved find you on JiTap. They see only that you are available to connect—not your full profile or your mobile number.</p>
    <button type="button" className={'jt-network-primary '+(state?.discoverable?'is-discoverable':'')} disabled={busy||reviewer}
     onClick={()=>void mutate('discovery',{enabled:!state?.discoverable})}>
     {state?.discoverable?<><Check size={18}/> Discoverable: ON</>:<><PhoneOff size={18}/> Discoverable: OFF</>}
    </button>
   </div>
   <div className="jt-network-card">
    <div className="jt-network-card-heading"><UsersRound size={22}/><h2>Connection requests</h2></div>
    {!state?.connections?.length?<p>No requests yet. When a customer from your contacts asks to connect, it will appear here.</p>:
     state.connections.map(c=><div className="jt-network-person jt-network-pending" key={c.customerId}>
      <span className="jt-network-avatar"><UsersRound size={20}/></span>
      <div><strong>{c.name||'JiTap customer'}</strong><small>{c.status==='accepted'?'Connected to your network':'Wants to connect with you · Phone hidden'}</small></div>
      {c.status==='pending'?<div className="jt-network-decision">
       <button type="button" disabled={busy||reviewer} onClick={()=>void mutate('decide',{customerId:c.customerId,decision:'accepted'})} aria-label="Accept connection"><Check size={18}/></button>
       <button type="button" disabled={busy||reviewer} onClick={()=>void mutate('decide',{customerId:c.customerId,decision:'declined'})} aria-label="Decline connection"><X size={18}/></button>
      </div>:<span className="jt-network-state accepted">Connected</span>}
     </div>)}
   </div>
  </>}
 </section>;
}
