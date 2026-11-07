'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Bell,BriefcaseBusiness,CheckCircle2,ChevronRight,ClipboardList,Clock3,MapPin,Radio,ShieldCheck,UserRound,Wifi,WifiOff,Wrench,ArrowRight} from 'lucide-react';
import {KENYAN_SERVICE_AREAS,SERVICE_OPTIONS} from '@/lib/provider-options';
import {ProviderMediaFields,type MediaKind} from '@/components/ProviderMediaFields';
import './provider-dashboard.css';

type ProviderProfile={
 full_name:string;business_name:string;categories:string[];service_areas:string[];
 base_area:string;experience_years:number;skills:string;is_online:boolean;submitted_at:string|null;
};
type Opportunity={request_id:string;category:string;area:string;preferred_date:string;preferred_time:string;created_at:string;technical_summary:string;proposed_scope:string;urgency:'high'|'normal'|'low'|'unspecified';brief_source:'ai'|'reported';requested_timing:string};
type PastResponse={request_id:string;decision:string;created_at:string};
type Dashboard={profile:ProviderProfile|null;reviewStatus:string;opportunities:Opportunity[];recentResponses:PastResponse[];uploadedMedia:{kind:MediaKind;uploadedAt:string}[]};
type Tab='home'|'profile'|'requests'|'verification';
const empty={full_name:'',business_name:'',categories:[] as string[],service_areas:[] as string[],
 base_area:'Bamburi',experience_years:0,skills:'',is_online:false,submitted_at:null};
export default function ProviderDashboardPage(){
 const router=useRouter();
 const [dashboard,setDashboard]=useState<Dashboard|null>(null);
 const [form,setForm]=useState<ProviderProfile>(empty);
 const [tab,setTab]=useState<Tab>('home');
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [decision,setDecision]=useState<Record<string,'accepted'|'declined'|'needs_clarification'>>({});
 const [notes,setNotes]=useState<Record<string,string>>({});
 const refresh=useCallback(async()=>{
  const res=await fetch('/api/provider/workspace',{cache:'no-store'});
  if(res.status===401){router.replace('/login?mode=login');return}
  if(!res.ok)throw Error('Unable to load provider account');
  const data:Dashboard=await res.json();
  setDashboard(data);
  setForm(data.profile||empty);
  if(!data.profile?.submitted_at)setTab('profile');
 },[router]);
 const refreshMedia=useCallback(async()=>{
  const res=await fetch('/api/provider/workspace',{cache:'no-store'});
  if(!res.ok)throw Error('Unable to refresh uploaded photos');
  const data:Dashboard=await res.json();
  setDashboard(current=>current?{...current,uploadedMedia:data.uploadedMedia,reviewStatus:data.reviewStatus}:data);
 },[]);
 useEffect(()=>{let active=true;refresh().catch(()=>{if(active)setError('Could not load your provider dashboard. Please refresh.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[refresh]);
 useEffect(()=>{
  if(!dashboard?.profile?.is_online||tab==='profile')return;
  const id=window.setInterval(()=>{
   if(document.visibilityState==='visible')void refresh().catch(()=>{});
  },20000);
  return()=>window.clearInterval(id);
 },[dashboard?.profile?.is_online,tab,refresh]);
 async function logout(){
  const r=await fetch('/api/auth/session',{method:'DELETE'});
  if(r.ok){window.dispatchEvent(new Event('jitap:auth-changed'));router.replace('/login?mode=login');router.refresh()}
  else setError('Unable to sign out. Please try again.');
 }
 async function act(payload:Record<string,unknown>){
  setBusy(true);setError('');setSuccess('');
  try{
   const r=await fetch('/api/provider/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(data.error||'Unable to save changes');
   await refresh();
   return data;
  }catch(e){setError(e instanceof Error?e.message:'Something went wrong');return null}
  finally{setBusy(false)}
 }
 function update<K extends keyof ProviderProfile>(key:K,value:ProviderProfile[K]){setForm(p=>({...p,[key]:value}))}
 function toggle(key:'categories'|'service_areas',value:string){
  setForm(p=>({...p,[key]:p[key].includes(value)?p[key].filter(x=>x!==value):[...p[key],value]}));
 }
 async function save(submit:boolean){
  if(!form.full_name.trim()||!form.categories.length||!form.service_areas.length){setError('Add your name, services and service areas.');return}
  const result=await act({action:'save',fullName:form.full_name,businessName:form.business_name,
   categories:form.categories,areas:form.service_areas,baseArea:form.service_areas.includes(form.base_area)?form.base_area:form.service_areas[0],
   experienceYears:form.experience_years,skills:form.skills,submit});
  if(result){setSuccess(submit?'Profile saved. Upload both sides of your national ID for verification.':'Profile saved.');if(submit)setTab('verification')}
 }
 async function answer(o:Opportunity){
  const d=decision[o.request_id];if(!d)return;
  if(d==='needs_clarification'&&(!notes[o.request_id]||notes[o.request_id].trim().length<3)){setError('Please write your question before submitting.');return}
  const r=await act({action:'respond',requestId:o.request_id,decision:d,note:notes[o.request_id]||''});
  if(r)setSuccess('Your BUZZ response was recorded. JiTap will coordinate the next step; this is not yet a confirmed booking.');
 }
 const approved=dashboard?.reviewStatus==='approved';
 const submitted=!!dashboard?.profile?.submitted_at;
 const online=!!dashboard?.profile?.is_online;
 const firstName=(dashboard?.profile?.full_name||form.full_name||'Provider').split(' ')[0];
 const visible=!approved&&(tab==='profile'||!submitted);
 return <main className="jt-provider-app">
  <div className="jt-provider-shell">
   <header className="jt-provider-app-header">
    <span className="jt-provider-workspace-heading">Provider dashboard</span>
    <div className="jt-provider-header-actions"><div className="jt-provider-badge"><ShieldCheck size={17}/> Provider workspace</div><button type="button" onClick={logout} className="jt-provider-logout">Log out</button></div>
   </header>
   {loading?<div className="jt-provider-card" role="status">Loading your JiTap provider account…</div>:<>
    <div className="jt-provider-greeting">
     <div><p>JITAP FOR PROVIDERS</p><h1>Habari, <span>{firstName}!</span></h1><div className="jt-provider-subtext">{!submitted?'Complete onboarding to get started.':approved?'Manage availability and local BUZZ requests.':'Your provider profile is awaiting JiTap review.'}</div></div>
     <span className="jt-provider-avatar">{dashboard?.uploadedMedia?.some(m=>m.kind==='profile_photo')?<img src={'/api/provider/media?kind=profile_photo&v='+encodeURIComponent(dashboard.uploadedMedia.find(m=>m.kind==='profile_photo')?.uploadedAt||'')} alt="Your profile photo"/>:<UserRound size={32}/>}</span>
    </div>
    <nav className="jt-provider-tabs" aria-label="Provider dashboard">
     {(approved?(['home','requests','profile'] as Tab[]):(['home','requests','profile','verification'] as Tab[])).map(t=><button key={t} aria-current={tab===t?'page':undefined} className={tab===t?'selected':''} onClick={()=>{setTab(t);setError('');setSuccess('')}}>{t==='home'?<Radio size={18}/>:t==='requests'?<ClipboardList size={18}/>:t==='verification'?<ShieldCheck size={18}/>:<UserRound size={18}/>} {t==='home'?'Home':t==='requests'?'Requests':t==='verification'?'Verification':approved?'Verified Profile ✓':'My Profile'}</button>)}
    </nav>
    {error&&<div className="jt-provider-error" role="alert">{error}</div>}
    {success&&<div className="jt-provider-success" role="status">{success}</div>}
    {approved&&tab==='profile'?<section className="jt-provider-card jt-verified-profile" aria-label="Verified provider profile">
     <div className="jt-verified-stamp"><CheckCircle2 size={27}/><div><h2>Verified provider</h2><p>Your account, professional profile and ID verification are approved by JiTap.</p></div></div>
     <dl>
      <dt>Full name</dt><dd>{dashboard?.profile?.full_name}</dd>
      <dt>Business</dt><dd>{dashboard?.profile?.business_name||'Individual provider'}</dd>
      <dt>Services</dt><dd>{dashboard?.profile?.categories.map(c=>SERVICE_OPTIONS.find(x=>x.value===c)?.label||c).join(' · ')}</dd>
      <dt>Coverage</dt><dd>{dashboard?.profile?.service_areas.join(' · ')}</dd>
      <dt>Experience</dt><dd>{dashboard?.profile?.experience_years} years</dd>
      <dt>Skills</dt><dd>{dashboard?.profile?.skills||'Not specified'}</dd>
      <dt>Identity check</dt><dd><span className="jt-verified-tag"><CheckCircle2 size={15}/> Verified ✓</span></dd>
     </dl>
     <p className="jt-provider-disclaimer">Your verified details are locked to protect your account. Contact JiTap Service Operations to request changes.</p>
    </section>:visible?
    <section className="jt-provider-card" aria-labelledby="jt-provider-onboarding-heading">
     <div className="jt-provider-progress"><span><CheckCircle2 size={17}/> Phone verified</span><span>{submitted?'Submitted for review':'Final step · Your profile'}</span></div>
     <div className="jt-provider-progress-line"><span/></div>
     <h2 id="jt-provider-onboarding-heading">Build your provider profile</h2>
     <p className="jt-provider-muted">Tell JiTap what you do and where you work. We match providers with suitable requests in Kenya.</p>
     <form onSubmit={e=>{e.preventDefault();void save(true)}} className="jt-provider-form">
      <label>Full name <strong>*</strong><input required minLength={2} maxLength={120} value={form.full_name} placeholder="Your full name" onChange={e=>update('full_name',e.target.value)}/></label>
      <label>Business name <small>(optional)</small><input maxLength={120} value={form.business_name} placeholder="Business or trading name" onChange={e=>update('business_name',e.target.value)}/></label>
      <fieldset><legend>Services you provide *</legend><div className="jt-provider-choices">{SERVICE_OPTIONS.map(c=><label key={c.value} className={form.categories.includes(c.value)?'checked':''}><input type="checkbox" checked={form.categories.includes(c.value)} onChange={()=>toggle('categories',c.value)}/>{c.label}</label>)}</div></fieldset>
      <fieldset><legend>Areas you cover *</legend><div className="jt-provider-choices">{KENYAN_SERVICE_AREAS.map(a=><label key={a} className={form.service_areas.includes(a)?'checked':''}><input type="checkbox" checked={form.service_areas.includes(a)} onChange={()=>toggle('service_areas',a)}/>{a}</label>)}</div><p className="jt-provider-hint">New opportunities are matched by selected area and service category. Exact customer addresses stay private.</p></fieldset>
      <label>Base area <strong>*</strong><select value={form.base_area} onChange={e=>update('base_area',e.target.value)}>{KENYAN_SERVICE_AREAS.filter(a=>form.service_areas.includes(a)).length?KENYAN_SERVICE_AREAS.filter(a=>form.service_areas.includes(a)).map(a=><option key={a}>{a}</option>):<option value="Bamburi">Bamburi</option>}</select></label>
      <label>Years of experience <input type="number" min={0} max={60} value={form.experience_years} onChange={e=>update('experience_years',Number(e.target.value))}/></label>
      <label>Skills and experience <small>(optional)</small><textarea maxLength={1200} rows={4} value={form.skills} placeholder="Describe your skills and the types of work you do" onChange={e=>update('skills',e.target.value)}/></label>
      <div className="jt-provider-media-profile">
       <h3>Profile & business photos</h3><p>Show customers who you are. These images are stored privately while your account is reviewed.</p>
       <ProviderMediaFields uploaded={dashboard?.uploadedMedia||[]} kinds={['profile_photo','business_logo']} onUploaded={refreshMedia}/>
      </div>
      <div className="jt-provider-verification-note"><ShieldCheck size={22}/><div><strong>Next step: identity verification</strong><p>After saving your profile, upload the front and back of your national ID in the Verification tab. Only approved JiTap staff may inspect your documents.</p></div></div>
      <div className="jt-provider-form-actions"><button type="button" className="jt-provider-secondary" disabled={busy} onClick={()=>save(false)}>{busy?'Saving…':'Save draft'}</button><button className="jt-provider-primary" disabled={busy||!form.categories.length||!form.service_areas.length}>{busy?'Saving…':submitted?'Save profile':'Submit for review'} <ArrowRight size={17}/></button></div>
     </form>
    </section>:tab==='verification'?
    <section className="jt-provider-card jt-provider-identity-stage" aria-labelledby="jt-verify-title">
     <div className="jt-provider-id-progress"><span className="done">✓ Phone</span><span className="done">✓ OTP</span><span className="done">✓ Profile</span><span className={(dashboard?.uploadedMedia?.some(m=>m.kind==='id_front')&&dashboard?.uploadedMedia?.some(m=>m.kind==='id_back'))?'done':'current'}>4 Verification</span></div>
     <h2 id="jt-verify-title">Verify your ID</h2>
     <p className="jt-provider-muted">Upload both sides of your Kenyan national ID. JiTap Service Operations will review your documents before approving the account.</p>
     <ProviderMediaFields uploaded={dashboard?.uploadedMedia||[]} kinds={['id_front','id_back']} lockedIDs={approved} onUploaded={refreshMedia}/>
     {dashboard?.uploadedMedia?.some(m=>m.kind==='id_front')&&dashboard?.uploadedMedia?.some(m=>m.kind==='id_back')
      ?<div className="jt-provider-success" role="status">Both ID images received. {approved?'Your identity has been approved.':'Your application is ready for JiTap Service Operations review.'}</div>
      :<div className="jt-provider-verification-note"><ShieldCheck size={20}/><div><strong>Identity review incomplete</strong><p>Both photos must be uploaded before staff can approve your profile.</p></div></div>}
     <button className="jt-provider-primary jt-provider-verify-done" type="button" disabled={!dashboard?.uploadedMedia?.some(m=>m.kind==='id_front')||!dashboard?.uploadedMedia?.some(m=>m.kind==='id_back')} onClick={()=>setTab('home')}>Continue <ArrowRight size={17}/></button>
    </section>:
    <div className="jt-provider-main">
     {tab==='home'&&approved&&<div className="jt-provider-verified-banner"><CheckCircle2 size={18}/> Identity verified · Provider profile approved</div>}
     {tab==='home'&&<section className="jt-provider-availability">
      <div className="jt-provider-status-row"><div><strong>{online?'You’re online':'You’re offline'}</strong><p>{approved?'Get alerts for matching local service requests.':'Your profile must be reviewed before you can go online.'}</p></div>
       <button className={'jt-provider-toggle '+(online?'active':'')} type="button" role="switch" aria-checked={online} disabled={busy||!approved} onClick={()=>act({action:'availability',online:!online})}><span/></button>
      </div>
      {!approved&&<div className="jt-provider-pending"><Clock3 size={17}/><span>{dashboard?.reviewStatus==='rejected'?'Your application needs changes. Contact JiTap Service Operations.':(!dashboard?.uploadedMedia?.some(m=>m.kind==='id_front')||!dashboard?.uploadedMedia?.some(m=>m.kind==='id_back'))?'Your identity photos are not complete. Upload both sides to request review.':'Your documents are submitted. JiTap staff will review them before enabling BUZZ.'}</span>{(!dashboard?.uploadedMedia?.some(m=>m.kind==='id_front')||!dashboard?.uploadedMedia?.some(m=>m.kind==='id_back'))&&<button type="button" className="jt-provider-id-cta" onClick={()=>setTab('verification')}>Upload ID</button>}</div>}
      <div className="jt-provider-coverage"><MapPin size={19}/><div><strong>Service coverage</strong><p>{dashboard?.profile?.service_areas.join(' · ')||'No areas selected'}</p></div><button onClick={()=>setTab('profile')} aria-label={approved?'View verified coverage':'Edit service coverage'}><ChevronRight size={19}/></button></div>
     </section>}
     {(tab==='home'||tab==='requests')&&<section className="jt-provider-requests">
      <div className="jt-provider-requests-heading"><div><Bell size={19}/><h2>{tab==='home'?'Live Requests':'BUZZ Opportunities'}</h2></div><span>{dashboard?.opportunities.length||0}</span></div>
      {!approved?<div className="jt-provider-empty"><ShieldCheck size={25}/><strong>Verification required</strong><p>Once your profile is approved, you can switch online and review requests that match your services and areas.</p></div>:
       !online?<div className="jt-provider-empty"><WifiOff size={27}/><strong>You are offline</strong><p>Go online to receive available matching requests.</p></div>:
       dashboard?.opportunities.length===0?<div className="jt-provider-empty"><ClipboardList size={27}/><strong>No new matching requests</strong><p>New opportunities will appear here when customers request your services in your selected areas.</p></div>:
       <div className="jt-provider-request-list">{dashboard?.opportunities.map(o=><article className="jt-provider-request jt-buzz-brief-card" key={o.request_id}>
        <div className="jt-provider-request-top"><span className="jt-provider-request-tag"><Wrench size={15}/> {SERVICE_OPTIONS.find(x=>x.value===o.category)?.label||o.category}</span><span className={'jt-buzz-urgency '+o.urgency}>Urgency: {o.urgency==='unspecified'?'Not specified':o.urgency==='normal'?'Normal':o.urgency==='high'?'High':'Low'}</span></div>
        <h3>{SERVICE_OPTIONS.find(x=>x.value===o.category)?.label||'Service'} · {o.area}</h3>
        <div className="jt-buzz-reference">Service ID: JT-{o.request_id.slice(0,8).toUpperCase()}</div>
        <div className="jt-buzz-brief-body"><strong>Service brief</strong><p>{o.technical_summary||'Customer requested a service assessment.'}</p>
         {o.proposed_scope&&<p><b>Proposed scope (subject to assessment):</b> {o.proposed_scope}</p>}
         <small>{o.brief_source==='ai'?'AI-organized from the customer’s description. Fault not independently diagnosed.':'Customer-reported issue. Technical assessment pending.'}</small>
        </div>
        <div className="jt-buzz-schedule">
         <div><MapPin size={17}/><span><strong>Service area</strong>{o.area}, Mombasa · Full site directions provided after job confirmation</span></div>
         <div><Clock3 size={17}/><span><strong>Requested date</strong>{o.preferred_date|| (o.requested_timing==='today'?'Today (date to confirm)':o.requested_timing==='this-week'?'This week (date to confirm)':'To be agreed')}</span></div>
         <div><Clock3 size={17}/><span><strong>Requested time</strong>{o.preferred_time||'To be agreed'}</span></div>
        </div>
        <div className="jt-buzz-card-actions">
         <button className={'jt-buzz-accept '+(decision[o.request_id]==='accepted'?'selected':'')} onClick={()=>setDecision(v=>({...v,[o.request_id]:'accepted'}))}>Accept Job</button>
         <button className={'jt-buzz-decline '+(decision[o.request_id]==='declined'?'selected':'')} onClick={()=>setDecision(v=>({...v,[o.request_id]:'declined'}))}>Decline</button>
         <button className="jt-buzz-clarify" onClick={()=>setDecision(v=>({...v,[o.request_id]:'needs_clarification'}))}>Ask more info</button>
        </div>
        {decision[o.request_id]==='needs_clarification'&&<textarea value={notes[o.request_id]||''} maxLength={500} rows={3} aria-label="Clarification question" placeholder="What details do you need before accepting?" onChange={e=>setNotes(v=>({...v,[o.request_id]:e.target.value}))}/>}
        {decision[o.request_id]&&<button disabled={busy} className="jt-provider-primary jt-provider-send" onClick={()=>answer(o)}>{busy?'Submitting…':decision[o.request_id]==='accepted'?'Send acceptance to JiTap':decision[o.request_id]==='declined'?'Confirm decline':'Send question to SOC'} <ArrowRight size={16}/></button>}
        </article>)}</div>}
      <p className="jt-provider-disclaimer">Accepting a BUZZ expresses interest only. JiTap Service Operations coordinates and confirms appointments. Customer contact information is not shared here.</p>
     </section>}
     {tab==='requests'&&<section className="jt-provider-card jt-provider-response-history"><h2>Your recent BUZZ responses</h2>{dashboard?.recentResponses.length?dashboard.recentResponses.map(r=><div key={r.request_id}><span>JT-{r.request_id.slice(0,8).toUpperCase()}</span><strong>{r.decision.replaceAll('_',' ')}</strong></div>):<p className="jt-provider-muted">No responses recorded yet.</p>}</section>}
    </div>}
    <div className="jt-provider-footer-note">JiTap · Local services in Kenya · Provider registration and BUZZ. Payment and wallet features are not available in this release.</div>
   </>}
  </div>
 </main>;
}
