'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {Truck,Check,ArrowLeft,ArrowRight,MapPin,House,Package,Phone,CalendarDays} from 'lucide-react';
import {areas} from '@/lib/data';

type MoveInfo={
 pickup:string;dropoff:string;pickupArea:string;movingDate:string;distanceKm:string;
 homeSize:'bedsitter'|'1-bed'|'2-bed'|'3-bed';
 pickupFloor:number;dropoffFloor:number;liftPickup:boolean;liftDropoff:boolean;
 packing:'self-packing'|'fragile-only'|'full-packing';special:boolean;phone:string;email:string;consent:boolean
};
const initial:MoveInfo={pickup:'',dropoff:'',pickupArea:'Bamburi',movingDate:'',distanceKm:'',homeSize:'1-bed',pickupFloor:0,dropoffFloor:0,liftPickup:false,liftDropoff:false,packing:'self-packing',special:false,phone:'',email:'',consent:false};
const labels=['Route','Home','Items','Contact'];
const fmt=(n:number)=>'KES '+n.toLocaleString('en-KE');
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const homeLabels:Record<string,string>={'bedsitter':'Bedsitter / studio','1-bed':'1 bedroom','2-bed':'2 bedrooms','3-bed':'3 bedrooms'};
const packingLabels:Record<string,string>={'self-packing':'I will pack','fragile-only':'Fragile items only','full-packing':'Pack everything'};
type Saved={id:string;secret:string;stage:number;info:MoveInfo;estimate:number|null};
export function MovingRequest(){
 const [stage,setStage]=useState(1);
 const [info,setInfo]=useState<MoveInfo>(initial);
 const [leadId,setLeadId]=useState<string|null>(null);
 const [secret,setSecret]=useState('');
 const [estimate,setEstimate]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [receipt,setReceipt]=useState('');
 useEffect(()=>{
  try{const raw=sessionStorage.getItem('jitap:moving-draft');if(!raw)return;const saved=JSON.parse(raw) as Saved;
   if(saved.id&&saved.secret&&saved.stage>=1&&saved.stage<=4){setLeadId(saved.id);setSecret(saved.secret);setInfo(saved.info);setStage(saved.stage);setEstimate(saved.estimate)}}
  catch{}
 },[]);
 function edit<K extends keyof MoveInfo>(name:K,value:MoveInfo[K]){setInfo(x=>({...x,[name]:value}));setError('')}
 function stagePayload(s:number){
  if(s===1)return {pickup:info.pickup.trim(),dropoff:info.dropoff.trim(),movingDate:info.movingDate,distanceKm:info.distanceKm.trim()?Number(info.distanceKm):null};
  if(s===2)return {homeSize:info.homeSize,pickupFloor:info.pickupFloor,dropoffFloor:info.dropoffFloor,liftPickup:info.liftPickup,liftDropoff:info.liftDropoff};
  return {packing:info.packing,special:info.special};
 }
 async function saveStage(s:number,override?:{phone:string;email:string;intakeReference:string}){
  const key=secret||crypto.randomUUID()+crypto.randomUUID();
  const response=await fetch('/api/moving',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({leadId,secret:key,stage:s,payload:override||stagePayload(s)})});
  const data=await response.json();
  if(!response.ok||!data.ok)throw new Error(data.error||'Unable to save your progress.');
  setSecret(key);setLeadId(data.leadId);setEstimate(typeof data.estimateKes==='number'?data.estimateKes:null);
  if(s<4)sessionStorage.setItem('jitap:moving-draft',JSON.stringify({id:data.leadId,secret:key,stage:s+1,info,estimate:data.estimateKes??null}));
  return data;
 }
 function check(s:number){
  if(s===1){
   if(info.pickup.trim().length<3||info.dropoff.trim().length<3)return 'Enter a pickup and drop-off location or landmark.';
   if(!info.movingDate||info.movingDate<today())return 'Choose a future moving date.';
   if(info.distanceKm.trim()&&(Number(info.distanceKm)<0||Number(info.distanceKm)>2000||!Number.isFinite(Number(info.distanceKm))))return 'Enter a valid estimated distance in kilometres.';
  }
  return '';
 }
 async function next(){
  const issue=check(stage);if(issue){setError(issue);return}
  setBusy(true);setError('');
  try{await saveStage(stage);setStage(stage+1)}
  catch(e){setError(e instanceof Error?e.message:'Could not save your details.')}
  finally{setBusy(false)}
 }
 function previous(){setError('');setStage(v=>Math.max(1,v-1))}
 async function submit(e:FormEvent){
  e.preventDefault();if(busy||receipt)return;
  if(!info.consent){setError('Please agree to the privacy notice.');return}
  setBusy(true);setError('');
  const requestDescription=[
   'Moving from '+info.pickup+' to '+info.dropoff+'.',
   'Move date: '+info.movingDate+'.',
   'House: '+homeLabels[info.homeSize]+'.',
   'Floors: pickup '+info.pickupFloor+(info.liftPickup?' (lift)':' (stairs)')+', drop-off '+info.dropoffFloor+(info.liftDropoff?' (lift)':' (stairs)')+'.',
   'Packing: '+packingLabels[info.packing]+'.',
   'Special items: '+(info.special?'Yes':'No')+'.',
   info.distanceKm?'Customer-estimated distance: '+info.distanceKm+' km (unverified).':'Road distance not yet verified.',
   estimate!==null?'JiTap provisional estimate: '+fmt(estimate)+' (not a confirmed quote).':'Quote pending provider assessment.'
  ].join(' ');
  const phone=info.phone.replace(/[\s().-]/g,'');
  try{
   const response=await fetch('/api/intake/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,consent:true,category:'moving',area:info.pickupArea,timing:'flexible',description:requestDescription})});
   const payload=await response.json();
   if(!response.ok||!payload.ok||!payload.reference)throw new Error(payload.error||'JiTap could not receive this request.');
   setReceipt('JT-SRV-'+String(payload.reference).replace(/-/g,'').slice(0,12).toUpperCase());
   try{await saveStage(4,{phone,email:info.email.trim(),intakeReference:String(payload.reference)});}
   catch{console.error('Moving progress sync failed after successful service intake')}
   sessionStorage.removeItem('jitap:moving-draft');
  }catch(e){setError(e instanceof Error?e.message:'Submission failed. Please try again.')}
  finally{setBusy(false)}
 }
 return <div className="container jt-moving-page">
  <div className="jt-moving-heading"><span className="th-overline">JITAP MOVING SERVICES</span><h1>Move with less hassle.</h1><p>Tell JiTap what you're moving. We'll help coordinate a mover and a quote.</p></div>
  <div className="jt-moving-card">
   <nav className="jt-truck-progress" aria-label="Moving request progress"><ol>{labels.map((name,index)=>{
    const number=index+1;const done=number<stage;const active=number===stage;
    return <li key={name} className={done?'done':active?'active':''}>
      <span className="jt-truck-node">{done?<Check size={17}/>:active?<Truck size={22}/>:number}</span><span>{name}</span>
    </li>
   })}</ol></nav>
   {receipt?<div className="jt-moving-receipt" role="status"><Check size={26}/><h2>Your moving request is in!</h2><p>JiTap has received your details and will follow up on availability and pricing.</p><strong>{receipt}</strong><p><Link href="/fundis">Explore more JiTap services</Link></p></div>:
   <form onSubmit={submit}>
   {stage===1&&<section className="jt-moving-step">
    <div className="jt-moving-stage-title"><MapPin/><div><h2>Where are you moving?</h2><p>Use neighbourhoods, streets or nearby landmarks.</p></div></div>
    <label>Pickup area <select value={info.pickupArea} onChange={e=>edit('pickupArea',e.target.value)}>{areas.map(a=><option key={a}>{a}</option>)}</select></label>
    <label>Moving from <input value={info.pickup} onChange={e=>edit('pickup',e.target.value)} maxLength={200} placeholder="e.g. Bamburi, near Naivas" required/></label>
    <label>Moving to <input value={info.dropoff} onChange={e=>edit('dropoff',e.target.value)} maxLength={200} placeholder="e.g. Nyali, Links Road" required/></label>
    <label>Preferred moving date <input type="date" min={today()} value={info.movingDate} onChange={e=>edit('movingDate',e.target.value)} required/></label>
    <label>Approximate distance in km <small>(optional)</small><input type="number" step="0.1" min="0" max="2000" inputMode="decimal" value={info.distanceKm} onChange={e=>edit('distanceKm',e.target.value)} placeholder="Only if you know it"/></label>
    <p className="jt-moving-note">JiTap has not calculated a road route. Leaving distance blank gives a preliminary price that excludes any extra-distance charge.</p>
   </section>}
   {stage===2&&<section className="jt-moving-step">
    <div className="jt-moving-stage-title"><House/><div><h2>Tell us about your home</h2><p>We'll estimate the truck and handling required.</p></div></div>
    <label>Home size <select value={info.homeSize} onChange={e=>edit('homeSize',e.target.value as MoveInfo['homeSize'])}>{Object.entries(homeLabels).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
    <div className="jt-moving-cols"><label>Pickup floor <select value={info.pickupFloor} onChange={e=>edit('pickupFloor',Number(e.target.value))}>{Array.from({length:16},(_,i)=><option key={i} value={i}>{i===0?'Ground':i}</option>)}</select></label><label>Drop-off floor <select value={info.dropoffFloor} onChange={e=>edit('dropoffFloor',Number(e.target.value))}>{Array.from({length:16},(_,i)=><option key={i} value={i}>{i===0?'Ground':i}</option>)}</select></label></div>
    <label className="jt-moving-check"><input type="checkbox" checked={info.liftPickup} onChange={e=>edit('liftPickup',e.target.checked)}/> Pickup building has a working lift</label>
    <label className="jt-moving-check"><input type="checkbox" checked={info.liftDropoff} onChange={e=>edit('liftDropoff',e.target.checked)}/> Drop-off building has a working lift</label>
   </section>}
   {stage===3&&<section className="jt-moving-step">
    <div className="jt-moving-stage-title"><Package/><div><h2>How should we handle your things?</h2><p>Choose the help you need.</p></div></div>
    <div className="jt-moving-tiers">{([{key:'self-packing',name:'I will pack',desc:'Loading and moving help'},{key:'fragile-only',name:'Pack fragile items',desc:'Extra care for breakables'},{key:'full-packing',name:'Pack everything',desc:'Full packing assistance'}] as const).map(t=><button type="button" aria-pressed={info.packing===t.key} key={t.key} className={info.packing===t.key?'selected':''} onClick={()=>edit('packing',t.key)}><span><strong>{t.name}</strong><small>{t.desc}</small></span><span className="jt-moving-radio"/></button>)}</div>
    <label className="jt-moving-check"><input type="checkbox" checked={info.special} onChange={e=>edit('special',e.target.checked)}/> I have heavy or delicate special items (e.g. piano or safe)</label>
   </section>}
   {stage===4&&<section className="jt-moving-step">
    <div className="jt-moving-stage-title"><Phone/><div><h2>Review your move</h2><p>Share a number JiTap can reach.</p></div></div>
    <div className="jt-moving-estimate"><span>Provisional moving estimate</span><strong>{estimate===null?'Quote pending':fmt(estimate)}</strong><small>Not a confirmed mover quote. {info.distanceKm?'Distance is customer-estimated, not map-verified.':'Road distance and extra-distance charges are not yet included.'} Final price depends on scope, access and provider confirmation.</small></div>
    <div className="jt-moving-review"><p><MapPin size={16}/> {info.pickup} → {info.dropoff}</p><p><CalendarDays size={16}/> {info.movingDate} · {homeLabels[info.homeSize]}</p><p><Package size={16}/> {packingLabels[info.packing]}{info.special?' · Special items':''}</p></div>
    <label>Mobile number <input required inputMode="tel" autoComplete="tel" type="tel" placeholder="0712345678" value={info.phone} onChange={e=>edit('phone',e.target.value)}/></label>
    <label>Email <small>(optional)</small><input type="email" autoComplete="email" value={info.email} onChange={e=>edit('email',e.target.value)} placeholder="you@example.com"/></label>
    <label className="jt-moving-check"><input type="checkbox" required checked={info.consent} onChange={e=>edit('consent',e.target.checked)}/> I agree to JiTap processing these details to respond to my request. <Link href="/privacy">Privacy</Link></label>
   </section>}
   {error&&<p className="jt-moving-error" role="alert">{error}</p>}
   <div className="jt-moving-actions">{stage>1&&<button type="button" className="jt-moving-back" disabled={busy} onClick={previous}><ArrowLeft size={17}/> Back</button>}
    {stage<4?<button className="jt-moving-next" type="button" onClick={next} disabled={busy}>{busy?'Saving…':'Continue'} <ArrowRight size={18}/></button>:<button className="jt-moving-next" disabled={busy} type="submit">{busy?'Submitting…':'Request moving quote'} <ArrowRight size={18}/></button>}
   </div>
   </form>}
  </div>
 </div>;
}
