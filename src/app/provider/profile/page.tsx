'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Settings,CheckCircle2,ChevronRight,ShieldCheck,UserRound,Camera,Plus,Trash2,Clock3,Phone,MapPin,Bell,Globe,LogOut,HelpCircle,FileText,LockKeyhole,BriefcaseBusiness} from 'lucide-react';
import {ProviderMediaFields,type MediaKind} from '@/components/ProviderMediaFields';
import {SERVICE_OPTIONS} from '@/lib/provider-options';
import './profile.css';

type Service={id:string;name:string;category:string;description:string;minPrice:number|null;maxPrice:number|null};
type Day={enabled:boolean;from:string;to:string;breakFrom?:string;breakTo?:string};
type Profile={full_name:string;business_name:string;categories:string[];service_areas:string[];base_area:string;is_online:boolean};
type Pane='profile'|'services'|'service'|'availability'|'day'|'account'|'verification'|'support'|'settings';
const DAYS=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const defaultHours=Object.fromEntries(DAYS.map((d,i)=>[d,{enabled:i!==6,from:i===5?'09:00':'08:00',to:i===5?'16:00':'18:00'}])) as Record<string,Day>;
const money=(n:number|null)=>n===null?'Not set':'KES '+n.toLocaleString('en-KE');
const time=(v:string)=>new Date('2020-01-01T'+v+':00').toLocaleTimeString('en-KE',{hour:'numeric',minute:'2-digit',hour12:true});
const serviceLabel=(value:string)=>SERVICE_OPTIONS.find(x=>x.value===value)?.label||value;
export default function ProviderProfilePage(){
 const router=useRouter();
 const [pane,setPane]=useState<Pane>('profile'),[day,setDay]=useState('monday'),[current,setCurrent]=useState<string|null>(null);
 const [profile,setProfile]=useState<Profile|null>(null),[review,setReview]=useState('not_submitted'),[media,setMedia]=useState<{kind:MediaKind;uploadedAt:string}[]>([]);
 const [phone,setPhone]=useState(''),[services,setServices]=useState<Service[]>([]),[hours,setHours]=useState<Record<string,Day>>(defaultHours),[language,setLanguage]=useState<'en'|'sw'>('en'),[notifications,setNotifications]=useState(true);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{
  const [workspace,prefs]=await Promise.all([fetch('/api/provider/workspace',{cache:'no-store'}),fetch('/api/provider/profile',{cache:'no-store'})]);
  if(workspace.status===401||prefs.status===401){router.replace('/login?mode=login');return}
  if(!workspace.ok||!prefs.ok)throw Error('Unable to load provider profile');
  const w=await workspace.json(),p=await prefs.json();
  setProfile(w.profile);setReview(w.reviewStatus);setMedia(w.uploadedMedia||[]);setPhone(p.phone||'');
  setServices(p.preferences?.services||[]);setHours({...defaultHours,...(p.preferences?.working_hours||{})});
  setLanguage(p.preferences?.language||'en');setNotifications(p.preferences?.notifications_enabled??true);
 },[router]);
 useEffect(()=>{refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false))},[refresh]);
 const uploadRefresh=async()=>{await refresh();setNotice('Photo saved successfully.')};
 const navigate=(next:Pane)=>{setError('');setNotice('');setPane(next)};
 async function persist(nextServices=services,nextHours=hours,nextLang=language,nextNotifs=notifications){
  setSaving(true);setError('');setNotice('');
  try{
   const res=await fetch('/api/provider/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({services:nextServices,workingHours:nextHours,language:nextLang,notificationsEnabled:nextNotifs})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Unable to save');
   setServices(nextServices);setHours(nextHours);setLanguage(nextLang);setNotifications(nextNotifs);setNotice('Changes saved.');
   return true;
  }catch(e){setError(e instanceof Error?e.message:'Unable to save');return false}
  finally{setSaving(false)}
 }
 async function setOnline(value:boolean){
  setSaving(true);setError('');
  try{
   const res=await fetch('/api/provider/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'availability',online:value})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'Unable to update availability');
   setProfile(p=>p?{...p,is_online:value}:p);
  }catch(e){setError(e instanceof Error?e.message:'Unable to update availability')}finally{setSaving(false)}
 }
 async function logout(){setSaving(true);const r=await fetch('/api/auth/session',{method:'DELETE'});if(r.ok){window.dispatchEvent(new Event('jitap:auth-changed'));router.replace('/login?mode=login')}else{setError('Unable to sign out');setSaving(false)}}
 const [editing,setEditing]=useState<Service>({id:'',name:'',category:'',description:'',minPrice:null,maxPrice:null});
 const photo=media.find(m=>m.kind==='profile_photo');
 const title=pane==='profile'?'Profile':pane==='services'?'My Services':pane==='service'?(current?'Edit Service':'Add Service'):pane==='availability'?'Availability':pane==='day'?day[0].toUpperCase()+day.slice(1):pane==='account'?'Account Details':pane==='verification'?'Identity Verification':pane==='support'?'Help & Support':'Settings';
 const item=(label:string,subtitle:string,icon:React.ReactNode,to:Pane,right?:React.ReactNode)=><button className="jpf-menu-row" onClick={()=>navigate(to)}><span className="jpf-icon">{icon}</span><span className="jpf-menu-text"><strong>{label}</strong>{subtitle&&<small>{subtitle}</small>}</span>{right||<ChevronRight size={20}/>}</button>;
 const toggle=(value:boolean,fn:()=>void,disabled=false)=><button type="button" disabled={disabled||saving} className={'jpf-switch '+(value?'on':'')} role="switch" aria-checked={value} onClick={fn}><span/></button>;
 return <main className="jpf-app"><div className="jpf-shell">
  <header className="jpf-header">{pane==='profile'?<span/>:<button aria-label="Back" onClick={()=>navigate(pane==='service'?'services':pane==='day'?'availability':'profile')}><ArrowLeft size={23}/></button>}<h1>{title}</h1>{pane==='profile'?<button aria-label="Settings" onClick={()=>navigate('settings')}><Settings size={23}/></button>:<span/>}</header>
  {loading?<p className="jpf-info">Loading your profile…</p>:!profile?<p className="jpf-info">Complete provider onboarding first. <Link href="/provider">Open provider dashboard</Link></p>:<>
  {error&&<div className="jpf-error" role="alert">{error}</div>}{notice&&<div className="jpf-notice" role="status">{notice}</div>}
  {pane==='profile'&&<><div className="jpf-identity"><div className="jpf-avatar">{photo?<img src={'/api/provider/media?kind=profile_photo&v='+encodeURIComponent(photo.uploadedAt)} alt="Your profile photo"/>:<UserRound size={47}/>}<button aria-label="Add profile photo" onClick={()=>document.getElementById('jpf-photo')?.scrollIntoView({behavior:'smooth'})}><Camera size={17}/></button></div><h2>{profile.full_name} {review==='approved'&&<CheckCircle2 size={20} fill="#00b958" color="white"/>}</h2><small>{profile.business_name||'JiTap Service Provider'}</small></div>
   <div className="jpf-online"><span><BriefcaseBusiness size={20}/> {profile.is_online?'Online':'Offline'}</span>{toggle(profile.is_online,()=>setOnline(!profile.is_online),review!=='approved')}</div>
   <div className="jpf-group">{item('My Services',services.length+' services',<BriefcaseBusiness/>, 'services')}{item('Availability','Set your working hours',<Clock3/>,'availability')}{item('Account Details','Personal information',<UserRound/>,'account')}{item('Identity Verification',review==='approved'?'Verified':'Review '+review.replaceAll('_',' '),<ShieldCheck/>,'verification',review==='approved'?<CheckCircle2 color="#00b958"/>:<ChevronRight/>)}{item('Help & Support','',<HelpCircle/>,'support')}</div>
   <div id="jpf-photo" className="jpf-photo-upload"><strong>Profile photo</strong><p>{photo?'Your profile photo is saved.':'Add a photo so customers can recognize you.'}</p><ProviderMediaFields uploaded={media} kinds={['profile_photo']} onUploaded={uploadRefresh}/></div>
  </>}
  {pane==='services'&&<><div className="jpf-list">{services.map(s=><button className="jpf-service-row" key={s.id} onClick={()=>{setEditing(s);setCurrent(s.id);navigate('service')}}><span className="jpf-service-thumb"><BriefcaseBusiness size={29}/></span><span><strong>{s.name}</strong><small><span className="jpf-dot"/> Active · {serviceLabel(s.category)}</small></span><ChevronRight size={20}/></button>)}{services.length===0&&<p className="jpf-info">No detailed services added yet. Your approved service categories are {profile.categories.map(serviceLabel).join(', ')}.</p>}</div><button className="jpf-add" onClick={()=>{setCurrent(null);setEditing({id:crypto.randomUUID(),name:'',category:profile.categories[0]||'',description:'',minPrice:null,maxPrice:null});navigate('service')}}><Plus size={21}/> Add New Service</button><p className="jpf-helper">Only JiTap-approved service categories can be activated. Request additional categories through Service Operations.</p></>}
  {pane==='service'&&<form className="jpf-form" onSubmit={async e=>{e.preventDefault();const next=current?services.map(s=>s.id===current?editing:s):[...services,editing];if(await persist(next)){navigate('services');setNotice('Service saved.')}}}><label>Service name<input required maxLength={80} placeholder="e.g. Home Cleaning" value={editing.name} onChange={e=>setEditing(v=>({...v,name:e.target.value}))}/></label><label>Category<select value={editing.category} required onChange={e=>setEditing(v=>({...v,category:e.target.value}))}>{profile.categories.map(c=><option value={c} key={c}>{serviceLabel(c)}</option>)}</select></label><label>Description<textarea rows={4} maxLength={500} placeholder="Briefly describe your service..." value={editing.description} onChange={e=>setEditing(v=>({...v,description:e.target.value}))}/></label><strong>Price range (optional)</strong><div className="jpf-two"><label>From (KES)<input type="number" min={0} placeholder="500" value={editing.minPrice??''} onChange={e=>setEditing(v=>({...v,minPrice:e.target.value===''?null:Number(e.target.value)}))}/></label><label>To (KES)<input type="number" min={0} placeholder="1500" value={editing.maxPrice??''} onChange={e=>setEditing(v=>({...v,maxPrice:e.target.value===''?null:Number(e.target.value)}))}/></label></div><button className="jpf-save" disabled={saving}>{saving?'Saving…':'Save Service'}</button>{current&&<button type="button" className="jpf-delete" disabled={saving} onClick={async()=>{if(await persist(services.filter(s=>s.id!==current)))navigate('services')}}><Trash2 size={17}/> Remove service</button>}</form>}
  {pane==='availability'&&<><div className="jpf-online"><span><BriefcaseBusiness size={20}/> Available for requests</span>{toggle(profile.is_online,()=>setOnline(!profile.is_online),review!=='approved')}</div><h2 className="jpf-section-title">Working hours</h2><div className="jpf-group">{DAYS.map(d=><button key={d} className="jpf-day-row" onClick={()=>{setDay(d);navigate('day')}}><span>{d[0].toUpperCase()+d.slice(1)}</span><span>{hours[d]?.enabled?time(hours[d].from)+' – '+time(hours[d].to):'Not available'}</span><ChevronRight size={18}/></button>)}</div><p className="jpf-helper">Working hours guide availability. Switching offline pauses new BUZZ opportunities regardless of schedule.</p></>}
  {pane==='day'&&<div className="jpf-form"><div className="jpf-online"><strong>Available</strong>{toggle(hours[day].enabled,()=>setHours(v=>({...v,[day]:{...v[day],enabled:!v[day].enabled}})))}</div><h3>Working hours</h3><div className="jpf-two">{(['from','to'] as const).map(field=><label key={field}>{field==='from'?'From':'To'}<input type="time" value={hours[day][field]} onChange={e=>setHours(v=>({...v,[day]:{...v[day],[field]:e.target.value}}))}/></label>)}</div><h3>Break (optional)</h3><div className="jpf-two">{(['breakFrom','breakTo'] as const).map(field=><label key={field}>{field==='breakFrom'?'From':'To'}<input type="time" value={hours[day][field]||''} onChange={e=>setHours(v=>({...v,[day]:{...v[day],[field]:e.target.value||undefined}}))}/></label>)}</div><button className="jpf-save" disabled={saving} onClick={async()=>{if(await persist(services,hours))navigate('availability')}}>{saving?'Saving…':'Save'}</button></div>}
  {pane==='account'&&<div className="jpf-group">{item('Full Name',profile.full_name,<UserRound/>,'account',<LockKeyhole size={18}/>)}{item('Phone Number',phone||'Verified via OTP',<Phone/>,'account',<LockKeyhole size={18}/>)}{item('Location',profile.base_area+', Kenya',<MapPin/>,'account',<LockKeyhole size={18}/>) }<p className="jpf-helper">Verified identity and contact details are protected. Contact JiTap Service Operations to request corrections. Your service coverage: {profile.service_areas.join(', ')}.</p></div>}
  {pane==='verification'&&<div className="jpf-verification"><span className="jpf-verify-symbol"><CheckCircle2 size={43}/></span><h2>{review==='approved'?'Verified':'Verification '+review.replaceAll('_',' ')}</h2><p>{review==='approved'?'Your identity has been successfully verified.':'Your verification is managed by JiTap Service Operations.'}</p><div className="jpf-group">{item('National ID',review==='approved'?'Verified':'Under review',<ShieldCheck/>,'verification',review==='approved'?<CheckCircle2 color="#00b958"/>:<ChevronRight/>)}</div></div>}
  {pane==='support'&&<div className="jpf-group"><a className="jpf-menu-row" href="mailto:providers@jitap.app?subject=JiTap%20Provider%20Support"><span className="jpf-icon"><HelpCircle/></span><span className="jpf-menu-text"><strong>FAQs & Support</strong><small>Ask JiTap Service Operations</small></span><ChevronRight/></a><Link className="jpf-menu-row" href="/terms"><span className="jpf-icon"><FileText/></span><span className="jpf-menu-text"><strong>Terms & Conditions</strong></span><ChevronRight/></Link><Link className="jpf-menu-row" href="/privacy"><span className="jpf-icon"><ShieldCheck/></span><span className="jpf-menu-text"><strong>Privacy Policy</strong></span><ChevronRight/></Link></div>}
  {pane==='settings'&&<div className="jpf-group"><div className="jpf-menu-row"><span className="jpf-icon"><Bell/></span><span className="jpf-menu-text"><strong>Notifications</strong></span>{toggle(notifications,()=>void persist(services,hours,language,!notifications))}</div><div className="jpf-menu-row"><span className="jpf-icon"><Globe/></span><span className="jpf-menu-text"><strong>Language</strong></span><select aria-label="Language" value={language} onChange={e=>void persist(services,hours,e.target.value as 'en'|'sw',notifications)}><option value="en">English</option><option value="sw">Kiswahili</option></select></div><div className="jpf-menu-row"><span className="jpf-icon"><LockKeyhole/></span><span className="jpf-menu-text"><strong>Account security</strong><small>Phone OTP sign-in — no password to change</small></span></div><button className="jpf-menu-row jpf-logout" onClick={logout} disabled={saving}><LogOut size={22}/> Log Out</button></div>}
  <nav className="jpf-bottom" aria-label="Provider navigation"><Link href="/provider">Home</Link><Link href="/provider">Requests</Link><span aria-disabled="true">Wallet</span><button onClick={()=>navigate('availability')}>Calendar</button><button className="selected" onClick={()=>navigate('profile')}>Profile</button></nav>
  </>}
 </div></main>;
}
