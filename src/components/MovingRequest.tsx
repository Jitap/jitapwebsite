'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {Truck,Check,ArrowLeft,ArrowRight,MapPin,House,Package,Phone,CalendarDays} from 'lucide-react';
import {MovingLocationPicker,type MoveLocation} from '@/components/MovingLocationPicker';

type MoveInfo={
 pickup:string;dropoff:string;pickupArea:string;movingDate:string;movingTime:string;distanceKm:string;
 pickupLocation:MoveLocation|null;dropoffLocation:MoveLocation|null;
 homeSize:'bedsitter'|'1-bed'|'2-bed'|'3-bed';
 pickupFloor:number;dropoffFloor:number;liftPickup:boolean;liftDropoff:boolean;
 packing:'self-packing'|'fragile-only'|'full-packing';special:boolean;phone:string;email:string;consent:boolean
};
const initial:MoveInfo={pickup:'',dropoff:'',pickupLocation:null,dropoffLocation:null,pickupArea:'Mombasa',movingDate:'',movingTime:'',distanceKm:'',homeSize:'1-bed',pickupFloor:0,dropoffFloor:0,liftPickup:false,liftDropoff:false,packing:'self-packing',special:false,phone:'',email:'',consent:false};
const labels=['Route','Home','Items','Contact'];
const fmt=(n:number)=>'KES '+n.toLocaleString('en-KE');
const today=()=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=(key:string)=>parts.find(p=>p.type===key)?.value||'';return get('year')+'-'+get('month')+'-'+get('day')};
const isValidTime=(value:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const formatMovingTime=(value:string)=>{
 if(!isValidTime(value))return value;
 const [hour,minute]=value.split(':').map(Number);
 return String(hour%12||12)+':'+String(minute).padStart(2,'0')+(hour>=12?' PM':' AM');
};
const currentKenyaTime=()=>new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Nairobi',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
const homeLabels:Record<string,string>={'bedsitter':'Bedsitter / studio','1-bed':'1 bedroom','2-bed':'2 bedrooms','3-bed':'3 bedrooms'};
const packingLabels:Record<string,string>={'self-packing':'I will pack','fragile-only':'Fragile items only','full-packing':'Pack everything'};
type Saved={id:string;secret:string;stage:number;info:MoveInfo;estimate:number|null;distanceVerified?:boolean};
export function MovingRequest(){
 const [stage,setStage]=useState(1);
 const [info,setInfo]=useState<MoveInfo>(initial);
 const [leadId,setLeadId]=useState<string|null>(null);
 const [secret,setSecret]=useState('');
 const [estimate,setEstimate]=useState<number|null>(null);
 const [distanceVerified,setDistanceVerified]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [receipt,setReceipt]=useState('');
 useEffect(()=>{
  try{const raw=sessionStorage.getItem('jitap:moving-draft');if(!raw)return;const saved=JSON.parse(raw) as Saved;
   if(saved.id&&saved.secret&&saved.stage>=1&&saved.stage<=4){setLeadId(saved.id);setSecret(saved.secret);const modern=typeof saved.distanceVerified==='boolean';setInfo({...saved.info,movingTime:saved.info.movingTime||'',pickupLocation:saved.info.pickupLocation||null,dropoffLocation:saved.info.dropoffLocation||null,distanceKm:modern&&saved.distanceVerified?saved.info.distanceKm:''});setStage(modern&&isValidTime(saved.info.movingTime||'')?saved.stage:1);setEstimate(modern?saved.estimate:null);setDistanceVerified(saved.distanceVerified===true)}}
  catch{}
 },[]);
 function edit<K extends keyof MoveInfo>(name:K,value:MoveInfo[K]){setInfo(x=>({...x,[name]:value}));setError('')}
 function chooseLocation(which:'pickup'|'dropoff',selected:MoveLocation){setInfo(x=>({...x,[which]:selected.label,[which==='pickup'?'pickupLocation':'dropoffLocation']:selected,distanceKm:''}));setDistanceVerified(false);setEstimate(null);setError('')}
 function typeLocation(which:'pickup'|'dropoff',value:string){setInfo(x=>({...x,[which]:value,[which==='pickup'?'pickupLocation':'dropoffLocation']:null,distanceKm:''}));setDistanceVerified(false);setEstimate(null);setError('')}
 function stagePayload(s:number){
  if(s===1)return {pickup:info.pickup.trim(),dropoff:info.dropoff.trim(),pickupArea:info.pickupArea,movingDate:info.movingDate,movingTime:info.movingTime,pickupLocation:info.pickupLocation,dropoffLocation:info.dropoffLocation};
  if(s===2)return {homeSize:info.homeSize,pickupFloor:info.pickupFloor,dropoffFloor:info.dropoffFloor,liftPickup:info.liftPickup,liftDropoff:info.liftDropoff};
  return {packing:info.packing,special:info.special};
 }
 async function saveStage(s:number,override?:{phone:string;email:string;intakeReference:string}){
  const key=secret||crypto.randomUUID()+crypto.randomUUID();
  const response=await fetch('/api/moving',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({leadId,secret:key,stage:s,payload:override||stagePayload(s)})});
  const data=await response.json();
  if(!response.ok||!data.ok)throw new Error(data.error||'Unable to save your progress.');
  setSecret(key);setLeadId(data.leadId);setEstimate(typeof data.estimateKes==='number'?data.estimateKes:null);
  const verified=data.distanceVerified===true&&typeof data.distanceKm==='number';
  setDistanceVerified(verified);
  const nextInfo=s===1?{...info,distanceKm:verified?String(data.distanceKm):''}:info;
  if(s===1)setInfo(nextInfo);
  if(s<4)sessionStorage.setItem('jitap:moving-draft',JSON.stringify({
   id:data.leadId,secret:key,stage:s+1,info:nextInfo,estimate:data.estimateKes??null,distanceVerified:verified
  }));
  return data;
 }
 function check(s:number){
  if(s===1){
   if(info.pickup.trim().length<3||info.dropoff.trim().length<3)return 'Choose a pickup and destination.';
   if(!info.pickupLocation||!info.dropoffLocation)return 'Select a suggested place, use the typed address, or choose a map pin for both locations.';
   if(!info.movingDate||info.movingDate<today())return 'Choose today or a future moving date.';
   if(!isValidTime(info.movingTime))return 'Choose your preferred moving time.';
   if(info.movingDate===today()&&info.movingTime<=currentKenyaTime())return 'Choose a future time for today\'s move.';

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
   'Preferred move: '+info.movingDate+' at '+formatMovingTime(info.movingTime)+' (Africa/Nairobi).',
   'House: '+homeLabels[info.homeSize]+'.',
   'Floors: pickup '+info.pickupFloor+(info.liftPickup?' (lift)':' (stairs)')+', drop-off '+info.dropoffFloor+(info.liftDropoff?' (lift)':' (stairs)')+'.',
   'Packing: '+packingLabels[info.packing]+'.',
   'Special items: '+(info.special?'Yes':'No')+'.',
   distanceVerified&&info.distanceKm?'Google Routes driving distance: '+info.distanceKm+' km (map-verified).':'Road distance not yet verified; extra-distance charges may apply.',
   estimate!==null?'JiTap provisional estimate: '+fmt(estimate)+' (not a confirmed quote).':'Quote pending provider assessment.'
  ].join(' ');
  const phone=info.phone.replace(/[\s().-]/g,''); const daysAway=Math.round((Date.parse(info.movingDate+'T00:00:00Z')-Date.parse(today()+'T00:00:00Z'))/86400000); const timing=daysAway<=1?'today':daysAway<=7?'this-week':'flexible';
  try{
   const response=await fetch('/api/intake/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    phone,consent:true,category:'moving',area:'Mombasa',timing,description:requestDescription,preferredDate:info.movingDate,preferredTime:info.movingTime,
    // Reuse the confirmed pickup Place ID / pin. The customer already provided this at Route.
    locationLabel:info.pickupLocation?.label||info.pickup,
    ...(info.pickupLocation?.placeId?{locationPlaceId:info.pickupLocation.placeId}:{}),
    ...(typeof info.pickupLocation?.lat==='number'&&typeof info.pickupLocation?.lng==='number'
      ?{locationLat:info.pickupLocation.lat,locationLng:info.pickupLocation.lng}:{})
   })});
   const payload=await response.json();
   if(!response.ok||!payload.ok||!payload.reference){
    const issues=payload.issues&&typeof payload.issues==='object'?Object.values(payload.issues).flat().filter((v):v is string=>typeof v==='string'):[];
    throw new Error(issues[0]||payload.error||'JiTap could not receive this request.');
   }
   setReceipt('JT-SRV-'+String(payload.reference).replace(/-/g,'').slice(0,12).toUpperCase());setStage(5);
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
    <MovingLocationPicker title="Moving from" value={info.pickup} selected={info.pickupLocation} onChange={v=>typeLocation('pickup',v)} onSelect={v=>chooseLocation('pickup',v)}/>
    <MovingLocationPicker title="Moving to" value={info.dropoff} selected={info.dropoffLocation} onChange={v=>typeLocation('dropoff',v)} onSelect={v=>chooseLocation('dropoff',v)}/>
    <div className="jt-moving-date-time">
     <label>Preferred moving date <input type="date" min={today()} value={info.movingDate} onChange={e=>edit('movingDate',e.target.value)} required/></label>
     <label>Preferred moving time <input type="time" step={1800} value={info.movingTime} onChange={e=>edit('movingTime',e.target.value)} required/></label>
    </div>
    <p className="jt-moving-note"><MapPin size={15} aria-hidden="true"/> Your selected locations help JiTap calculate the road distance for your moving estimate.</p>
   </section>}
   {stage>1&&<div className={'jt-moving-route-result'+(distanceVerified?' verified':'')} role="status">
    <MapPin size={16} aria-hidden="true"/>
    {distanceVerified?<span><strong>Google road distance: {info.distanceKm} km</strong> · verified for this estimate</span>:<span>Road distance unavailable · estimate excludes possible extra-distance costs.</span>}
   </div>}
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
    <div className="jt-moving-estimate"><span>Moving estimate</span><strong>{estimate===null?'Quote pending':fmt(estimate)}</strong></div>
    <div className="jt-moving-review"><p><MapPin size={16}/> {info.pickup} → {info.dropoff}</p><p><CalendarDays size={16}/> {info.movingDate} at {formatMovingTime(info.movingTime)} · {homeLabels[info.homeSize]}</p><p><Package size={16}/> {packingLabels[info.packing]}{info.special?' · Special items':''}</p></div>
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
