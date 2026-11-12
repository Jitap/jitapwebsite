'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Copy,ExternalLink,RefreshCw,MessageSquare,UserRoundCheck,AlertCircle} from 'lucide-react';
import {providerMatchesTrade} from '@/lib/trade-categories';

type Provider={id:string;business_name:string;service_categories:string[];service_areas:string[];base_area:string|null};
type Assignment={id:string;provider_id:string;state:string;quoted_amount_kes:number|null;notes:string|null;assigned_at:string;responded_at:string|null};
type ProviderSmsDraft={id:string;assignment_id:string;message:string};
type ProviderSmsContact={providerId:string;enabled:boolean;whatsappEnabled:boolean;maskedPhone:string};
type TechnicalBrief={technical_summary:string;proposed_scope:string;urgency:string;source:string};
type SmsAttempt={id:string;customer_update_id:string|null;assignment_id:string|null;recipient_kind:string;gateway?:string;state:string;requested_at:string;http_status:number|null;provider_message_id:string|null};
type Update={id:string;kind:string;channel:'whatsapp'|'sms'|'phone';message:string;state:'draft'|'sent_manually'|'cancelled';created_at:string;sent_at:string|null};
type Case={id:string;reference:string;category:string;description:string;area:string;phone:string;status:string;canContact:boolean;whatsappOptIn:boolean;source_kind:string;name:string;locationLabel:string;notifyOptIn:boolean;preferredDate?:string;preferredTime?:string;jobStatus?:string|null;providerName?:string|null;appointmentId?:string|null};
const responseStates=[['contacted','Contacted'],['accepted','Accepted'],['declined','Declined'],['needs_clarification','Needs clarification'],['quote_requested','Quote requested'],['quote_received','Quote received'],['cancelled','Cancelled']] as const;
const updateKinds=[['request_received','Request received'],['provider_search','Searching for provider'],['provider_found','Provider found'],['quote_update','Quotation update'],['scheduled','Scheduled'],['progress','Job progress'],['completion','Completion'],['clarification','Clarification needed']] as const;
function toKenyanWhatsApp(phone:string){
 const n=phone.replace(/\D/g,'');
 const number=n.startsWith('0')?'254'+n.slice(1):n;
 return /^254[17]\d{8}$/.test(number)?number:null;
}
function conciseReportedFault(raw:string){
 const text=raw.replace(/(?:\+?254|0)[17]\d{8}/g,'[phone withheld]').replace(/https?:\/\/\S+/gi,'[link withheld]').replace(/\s+/g,' ').trim();
 // Older requests retain their question-and-answer transcript in the ticket, not the provider alert.
 const first=text.split(/\s*(?:Where exactly|How serious|When did|What type|Which type|Is there|Are there|Preferred appointment|Preferred date|Preferred time|What is|Can you|Please select)\s*[:?]/i)[0];
 return (first||text.split(';')[0]||'Service assessment requested').replace(/[.;\s]+$/,'').slice(0,230);
}
function makeProviderBuzz(c:Case,provider:string,technical?:TechnicalBrief|null){
 const summary=(technical?.technical_summary||'').replace(/(?:\+?254|0)[17]\d{8}/g,'[phone withheld]').replace(/https?:\/\/\S+/gi,'[link withheld]').replace(/\s+/g,' ').trim();
 const issue=(summary||conciseReportedFault(c.description)).slice(0,245);
 const scope=(technical?.proposed_scope||'').replace(/\s+/g,' ').trim().slice(0,125);
 const trade=c.category.replaceAll('-',' ').replace(/\b\w/g,ch=>ch.toUpperCase());
 const place=(c.locationLabel||c.area||'Location to confirm').replace(/\s+/g,' ').slice(0,95);
 const date=[c.preferredDate,c.preferredTime].filter(Boolean).join(' at ')||'To be arranged';
 const fields=[
  'JiTap BUZZ | JT-'+c.reference,
  'Provider: '+provider,
  'Service: '+trade,
  'Reported issue: '+issue,
  ...(scope?['Preliminary scope: '+scope]:[]),
  'Location: '+place,
  'Preferred visit: '+date+' EAT (subject to confirmation)',
  'Review and respond via the secure link. Accepting the request follows the booking process; visit time is not confirmed until JiTap confirms.'
 ];
 return fields.join('\n').slice(0,600);
}
function makeMessage(c:Case,kind:string,providerName?:string){
 const ref='JT-'+c.reference;
 const area=c.locationLabel||c.area||'your area';
 switch(kind){
  case 'request_received':return `JiTap: We have received your request (${ref}) for ${c.category.replaceAll('-',' ')} in ${area}. Our team is coordinating the next steps. We will update you as soon as we have progress.`;
  case 'provider_search':return `JiTap update (${ref}): We are checking for an available service provider for your request in ${area}. We will contact you with an update. No booking has been confirmed yet.`;
  case 'provider_found':return `JiTap update (${ref}): We have identified ${providerName||'a potential provider'} for your request. We are confirming their response and availability. Please wait for confirmation before making arrangements.`;
  case 'quote_update':return `JiTap update (${ref}): We are following up on the quotation for your service request. We will share confirmed details with you once available.`;
  case 'scheduled':return `JiTap update (${ref}): Your request has moved to scheduling. We will confirm the exact date, time and provider with you directly.`;
  case 'progress':return `JiTap update (${ref}): We are following up on the progress of your service request. Please reply if you have further information or concerns.`;
  case 'completion':return `JiTap update (${ref}): Our records indicate that your service request is nearing completion. Please confirm whether the work has been completed satisfactorily.`;
  default:return `JiTap update (${ref}): We need a little more information about your request for ${c.category.replaceAll('-',' ')} in ${area}. Please reply with any missing details so we can assist.`;
 }
}
export function CoordinatorWorkflow({caseItem,onChanged}:{caseItem:Case;onChanged:()=>Promise<void>}){
 const [providers,setProviders]=useState<Provider[]>([]);
 const [assignments,setAssignments]=useState<Assignment[]>([]);
 const [updates,setUpdates]=useState<Update[]>([]);
 const [smsAttempts,setSmsAttempts]=useState<SmsAttempt[]>([]);
 const [providerDrafts,setProviderDrafts]=useState<ProviderSmsDraft[]>([]);
 const [buzzText,setBuzzText]=useState<Record<string,string>>({});
 const [providerSmsContacts,setProviderSmsContacts]=useState<ProviderSmsContact[]>([]);
 const [technicalBrief,setTechnicalBrief]=useState<TechnicalBrief|null>(null);
 const [isAdmin,setIsAdmin]=useState(false);
 const [newProviderPhone,setNewProviderPhone]=useState('');
 const [consentSource,setConsentSource]=useState('');
 const [providerConsent,setProviderConsent]=useState(false);
 const [providerWhatsAppConsent,setProviderWhatsAppConsent]=useState(false);
 const [smsEnabled,setSmsEnabled]=useState(false);
 const [smsReady,setSmsReady]=useState(false);
 const [smsDiagnostics,setSmsDiagnostics]=useState<{ok:boolean;httpStatus?:number;balanceKes?:number;senderId?:string;errorCode?:string;error?:string}|null>(null);
 const [checkingSms,setCheckingSms]=useState(false);
 const [providerId,setProviderId]=useState('');
 const [providerNote,setProviderNote]=useState('');
 const [responses,setResponses]=useState<Record<string,string>>({});
 const [quote,setQuote]=useState<Record<string,string>>({});
 const [responseNotes,setResponseNotes]=useState<Record<string,string>>({});
 const [kind,setKind]=useState('provider_search');
 const [channel,setChannel]=useState<'whatsapp'|'sms'|'phone'>('whatsapp');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [feedback,setFeedback]=useState('');
 const [loading,setLoading]=useState(true);
 const onChangedRef=useRef(onChanged);
 onChangedRef.current=onChanged;
 const load=useCallback(async()=>{
  const res=await fetch('/api/coordinator/workflow?caseId='+encodeURIComponent(caseItem.id),{cache:'no-store'});
  if(!res.ok)throw new Error('Unable to load workflow');
  const data=await res.json();
  setProviders(data.providers||[]);setAssignments(data.assignments||[]);setUpdates(data.updates||[]);setSmsAttempts(data.smsAttempts||[]);setProviderDrafts(data.providerDrafts||[]);setSmsEnabled(data.smsEnabled===true);setSmsReady(data.smsReady===true);setProviderSmsContacts(data.providerSmsContacts||[]);setTechnicalBrief(data.technicalBrief||null);setIsAdmin(data.staffRole==='admin');
 },[caseItem.id]);
 useEffect(()=>{
  let alive=true;
  setLoading(true);setFeedback('');
  load().catch(()=>{if(alive)setFeedback('Unable to load provider assignments.')}).finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[load]);
 // Refresh active requests so incoming provider replies show in SOD without a page reload.
 useEffect(()=>{
  const interval=window.setInterval(()=>{
   if(document.visibilityState!=='visible')return;
   load().then(()=>onChangedRef.current()).catch(()=>{});
  },30000);
  return()=>window.clearInterval(interval);
 },[load]);
 const accepted=assignments.find(x=>x.state==='accepted');
 const acceptedName=providers.find(p=>p.id===accepted?.provider_id)?.business_name;
 const matches=useMemo(()=>providers.filter(p=>
  providerMatchesTrade(caseItem.category,p.service_categories)&&
  p.service_areas.some(area=>area.toLowerCase()===caseItem.area.toLowerCase())
 ),[providers,caseItem.category,caseItem.area]);
 async function action(payload:Record<string,unknown>,success:string){
  setBusy(true);setFeedback('');
  try{
   const res=await fetch('/api/coordinator/workflow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({caseId:caseItem.id,...payload})});
   const data=await res.json();
   if(!res.ok)throw new Error(data.error||'Could not save');
   await load();await onChanged();setFeedback(success);
  }catch(e){setFeedback(e instanceof Error?e.message:'Operation failed')}
  finally{setBusy(false)}
 }
 async function saveProviderContact(){
  if(!providerId||!providerConsent)return;
  setBusy(true);setFeedback('');
  try{
   const res=await fetch('/api/coordinator/provider-contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    providerId,phone:newProviderPhone,consentConfirmed:true,consentSource,whatsappConsent:providerWhatsAppConsent
   })});
   const data=await res.json();
   if(!res.ok)throw new Error(data.error||'Provider contact was not saved');
   setNewProviderPhone('');setConsentSource('');setProviderConsent(false);setProviderWhatsAppConsent(false);await load();
   setFeedback(providerWhatsAppConsent?'Private provider SMS and WhatsApp consent recorded.':'Private provider SMS contact saved with documented consent.');
  }catch(e){setFeedback(e instanceof Error?e.message:'Could not save provider contact')}
  finally{setBusy(false)}
 }
 async function checkSmsDiagnostics(){
  setCheckingSms(true);setFeedback('');
  try{
   const res=await fetch('/api/coordinator/sms',{cache:'no-store'});
   const body=await res.json();
   setSmsDiagnostics(body);
   if(!res.ok)setFeedback(body.error||'SMS account diagnostic request failed.');
  }catch{setSmsDiagnostics({ok:false,error:'Could not connect to the SMS diagnostic endpoint'});}
  finally{setCheckingSms(false)}
 }
 async function sendSms(recipientKind:'customer'|'provider',id:string){
  const recipient=recipientKind==='customer'?caseItem.phone:'the opted-in provider contact';
  if(!window.confirm('Send a real SMS via Wasiliana to '+recipient+'? This will use JiTap SMS credits. Make sure the recipient has consented.'))return;
  setBusy(true);setFeedback('');
  try{
   const res=await fetch('/api/coordinator/sms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    caseId:caseItem.id,recipientKind,confirm:true,
    ...(recipientKind==='customer'?{updateId:id}:{assignmentId:id})
   })});
   const data=await res.json();
   if(!res.ok)throw new Error(data.error||'SMS was not accepted');
   await load();await onChanged();
   setFeedback('SMS submitted to Wasiliana. Delivery to the handset is not yet confirmed. Attempt: '+data.attemptId.slice(0,8));
  }catch(e){await load().catch(()=>{});setFeedback(e instanceof Error?e.message:'Unable to submit SMS')}
  finally{setBusy(false)}
 }
 async function copyUpdate(body:string){
  try{await navigator.clipboard.writeText(body);setFeedback('Message copied. Send it manually, then confirm it was sent.')}
  catch{setFeedback('Clipboard unavailable. Select the message text and copy it manually.')}
 }
 async function openReviewedWhatsApp(recipientKind:'customer'|'provider',id:string){
  const recipient=recipientKind==='provider'?'provider':'customer';
  if(!window.confirm('Open a WhatsApp message to the '+recipient+'? This opens WhatsApp for you to review and press Send manually; JiTap cannot confirm delivery automatically.'))return;
  setBusy(true);setFeedback('');
  try{
   const response=await fetch('/api/coordinator/whatsapp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({caseId:caseItem.id,recipientKind,...(recipientKind==='provider'?{assignmentId:id}:{updateId:id})})});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'WhatsApp message could not be prepared.');
   if(typeof result.url!=='string'||!result.url.startsWith('https://wa.me/'))throw Error('WhatsApp destination unavailable');
   // Use a real user-triggered popup and never claim a message has been delivered.
   window.location.assign(result.url);
  }catch(error){setFeedback(error instanceof Error?error.message:'Could not open WhatsApp')}
  finally{setBusy(false)}
 }
 function openWhatsApp(body:string){
  const to=toKenyanWhatsApp(caseItem.phone);
  if(!to){setFeedback('Confirm the customer phone before opening WhatsApp.');return}
  window.open('https://wa.me/'+to+'?text='+encodeURIComponent(body),'_blank','noopener,noreferrer');
 }
 if(loading)return <section className="coordinator-workflow">Loading provider workflow…</section>;
 return <section className="coordinator-workflow">
  <div className="coordinator-contact-summary"><h3>Customer contact</h3><dl><dt>Service ID</dt><dd className="coordinator-service-id">JT-{caseItem.reference}</dd><dt>Name</dt><dd>{caseItem.name||'Not supplied (historical enquiry)'}</dd><dt>Mobile</dt><dd>{caseItem.phone||'Not supplied'}</dd><dt>Service location</dt><dd>{caseItem.locationLabel||caseItem.area||'Not supplied'}</dd><dt>SMS updates</dt><dd>{caseItem.notifyOptIn?'Opted in':'Not opted in / not recorded'}</dd></dl></div>
  <h3><UserRoundCheck size={18}/> Provider assignment</h3>
  {caseItem.jobStatus&&caseItem.jobStatus!=='cancelled'&&<div className="coordinator-auto-assignment"><strong>Confirmed booking from the provider app</strong><p>{caseItem.providerName||'Assigned provider'} · {caseItem.jobStatus.replaceAll('_',' ')}</p><small>This booking was accepted directly by the provider. SOD records the milestones automatically; do not create a second assignment.</small></div>}
  <p className="coordinator-help">Manual proposals are for requests without an active booking. Provider acceptance in the JiTap app immediately confirms the customer booking.</p>
  <label>Choose verified provider
   <select value={providerId} onChange={e=>setProviderId(e.target.value)} disabled={busy||caseItem.status==='incomplete'}>
    <option value="">Select a verified provider…</option>
    <optgroup label="Matching trade and area">
     {matches.map(p=><option key={p.id} value={p.id}>{p.business_name} · {p.base_area||p.service_areas.join(', ')}</option>)}
    </optgroup>
    <optgroup label="Other providers — manually verify suitability">
     {providers.filter(p=>!matches.some(m=>m.id===p.id)).map(p=><option key={p.id} value={p.id}>{p.business_name} · {p.base_area||p.service_areas.join(', ')}</option>)}
    </optgroup>
   </select>
  </label>
  {matches.length===0&&<p className="coordinator-help"><AlertCircle size={15}/> No verified provider category match confirmed. Use <strong>Needs sourcing</strong> for human intervention.</p>}
  {providerId&&<p className="coordinator-help">Provider SMS contact: {providerSmsContacts.find(p=>p.providerId===providerId)?.enabled?'SMS consent recorded · '+providerSmsContacts.find(p=>p.providerId===providerId)?.maskedPhone:'No opted-in phone on file'}</p>}
  {providerId&&isAdmin&&!providerSmsContacts.find(p=>p.providerId===providerId)?.enabled&&<div className="coordinator-provider-contact">
   <h4>Private provider SMS onboarding</h4>
   <p className="coordinator-help">Only enter a provider's number after the provider has agreed to JiTap SMS job alerts. This number remains private.</p>
   <label>Provider mobile number<input inputMode="tel" autoComplete="off" placeholder="07XXXXXXXX" value={newProviderPhone} maxLength={25} onChange={e=>setNewProviderPhone(e.target.value)}/></label>
   <label>Consent evidence<input placeholder="e.g. agreed during onboarding call on 5 Nov" value={consentSource} maxLength={300} onChange={e=>setConsentSource(e.target.value)}/></label>
   <label className="coordinator-check"><input type="checkbox" checked={providerConsent} onChange={e=>setProviderConsent(e.target.checked)}/> I confirm the provider gave permission to receive JiTap SMS alerts.</label><label className="coordinator-check"><input type="checkbox" checked={providerWhatsAppConsent} onChange={e=>setProviderWhatsAppConsent(e.target.checked)}/> The provider separately agreed to receive JiTap WhatsApp job notifications (optional).</label>
   <button disabled={busy||!providerConsent||consentSource.trim().length<5||newProviderPhone.trim().length<10} onClick={saveProviderContact}>Save private SMS contact</button>
  </div>}
  <input aria-label="Provider assignment note" maxLength={1000} value={providerNote} onChange={e=>setProviderNote(e.target.value)} placeholder="Private note for sourcing or proposed provider"/>
  <button disabled={busy||!providerId||caseItem.status==='incomplete'||['closed','completed','cancelled'].includes(caseItem.status)||!!(caseItem.jobStatus&&['confirmed','on_my_way','arrived','in_progress','completed'].includes(caseItem.jobStatus))} onClick={()=>action({action:'assign_provider',providerId,note:providerNote},'Provider proposal saved')}>Assign selected provider</button>
  {assignments.length? <div className="coordinator-assignment-list">{assignments.map(a=>{
   const p=providers.find(p=>p.id===a.provider_id);
   return <div className="coordinator-assignment" key={a.id}>
    <strong>{p?.business_name||'Provider '+a.provider_id}</strong><span className="coordinator-status">{a.state.replaceAll('_',' ')}</span>
    <small>Private SMS contact: {providerSmsContacts.find(x=>x.providerId===a.provider_id)?.enabled?'On file · '+providerSmsContacts.find(x=>x.providerId===a.provider_id)?.maskedPhone:'No consented SMS contact'}</small>
    {a.quoted_amount_kes!==null&&<small>Quoted: KES {Number(a.quoted_amount_kes).toLocaleString('en-KE')}</small>}
    <label>Provider response
     <select disabled={busy||['completed','closed','cancelled'].includes(caseItem.status)} value={responses[a.id]||a.state} onChange={e=>setResponses(s=>({...s,[a.id]:e.target.value}))}>
      <option value="proposed" disabled>Proposed</option>
      {responseStates.map(([v,l])=><option key={v} value={v}>{l}</option>)}
     </select>
    </label>
    {(responses[a.id]||a.state)==='quote_received'&&<label>Quoted amount (KES)<input type="number" min="0" max="100000000" value={quote[a.id]||''} onChange={e=>setQuote(s=>({...s,[a.id]:e.target.value}))} placeholder="Enter provider's quotation"/></label>}
    <input aria-label="Response notes" maxLength={1000} placeholder="Provider reply or clarification (private)" value={responseNotes[a.id]||''} onChange={e=>setResponseNotes(s=>({...s,[a.id]:e.target.value}))}/>
    <button disabled={busy||!responses[a.id]||responses[a.id]===a.state} onClick={()=>action({action:'provider_response',assignmentId:a.id,state:responses[a.id],quote:responses[a.id]==='quote_received'&&quote[a.id]!==''?Number(quote[a.id]):null,note:responseNotes[a.id]||''},'Provider response saved')}>Record provider response</button>
    <div className="coordinator-provider-buzz">
      <h4>Provider BUZZ — review message</h4>
      <p className="coordinator-help">JiTap uses the provider's saved private SMS contact. A unique secure response link is added automatically when sending. Review and save this service brief first.</p>
      {smsAttempts.some(s=>s.assignment_id===a.id)&&providerDrafts.find(d=>d.assignment_id===a.id)&&<p className="coordinator-provider-buzz-sent">{providerDrafts.find(d=>d.assignment_id===a.id)?.message}</p>}
      {!smsAttempts.some(s=>s.assignment_id===a.id)&&<>
        <button type="button" disabled={busy} onClick={()=>setBuzzText(x=>({...x,[a.id]:makeProviderBuzz(caseItem,p?.business_name||'provider',technicalBrief)}))}>Generate BUZZ draft</button>
        <textarea aria-label="Provider BUZZ draft" rows={5} maxLength={600}
          value={buzzText[a.id]??providerDrafts.find(x=>x.assignment_id===a.id)?.message??makeProviderBuzz(caseItem,p?.business_name||'provider')}
          onChange={e=>setBuzzText(x=>({...x,[a.id]:e.target.value}))}/>
        <button type="button" disabled={busy} onClick={()=>action({action:'provider_sms_draft',assignmentId:a.id,message:buzzText[a.id]??providerDrafts.find(x=>x.assignment_id===a.id)?.message??makeProviderBuzz(caseItem,p?.business_name||'provider')},'Provider BUZZ draft saved.')}>Save BUZZ draft — do not send</button>
        {providerDrafts.some(x=>x.assignment_id===a.id)&&<small>Saved draft ready. Save again after any edit before sending.</small>}
      </>}
    </div>
    {smsAttempts.filter(s=>s.assignment_id===a.id).map(s=><small key={s.id}>Provider SMS: {s.state} · {new Date(s.requested_at).toLocaleString('en-KE')}</small>)}
    {!smsAttempts.some(s=>s.assignment_id===a.id)&&<button disabled={busy||!smsEnabled||!smsReady||!providerDrafts.some(d=>d.assignment_id===a.id)||(buzzText[a.id]!==undefined&&buzzText[a.id]!==providerDrafts.find(d=>d.assignment_id===a.id)?.message)||!providerSmsContacts.some(p=>p.providerId===a.provider_id&&p.enabled)||!['proposed','contacted','needs_clarification','quote_requested'].includes(a.state)} onClick={()=>sendSms('provider',a.id)}>Send provider SMS via Wasiliana</button>}
    <div className="coordinator-wa-actions">
     <strong>WhatsApp provider notification</strong>
     <p className="coordinator-help">Uses the reviewed saved technical BUZZ, not the customer's intake transcript. Opens WhatsApp for staff to send manually; no automatic delivery claim.</p>
     <button type="button" disabled={busy||!providerDrafts.some(d=>d.assignment_id===a.id)||!providerSmsContacts.some(p=>p.providerId===a.provider_id&&p.whatsappEnabled)||!['proposed','contacted','needs_clarification','quote_requested'].includes(a.state)} onClick={()=>openReviewedWhatsApp('provider',a.id)}><ExternalLink size={15}/> Open provider WhatsApp</button>
     {!providerSmsContacts.some(p=>p.providerId===a.provider_id&&p.whatsappEnabled)&&<small>Provider WhatsApp requires separately recorded opt-in. An SMS opt-in alone is not sufficient.</small>}
    </div>
    {!providerSmsContacts.some(p=>p.providerId===a.provider_id&&p.enabled)&&<small>Provider SMS requires documented opt-in and a private mobile number.</small>}
    {!providerDrafts.some(d=>d.assignment_id===a.id)&&!smsAttempts.some(s=>s.assignment_id===a.id)&&<small>Save the provider BUZZ draft to unlock SMS sending.</small>}
    {!smsEnabled&&<small>Coordinator SMS sending is not activated.</small>}
   </div>
  })}</div>:<p className="coordinator-help">No separate manual provider proposal. If the booking is already confirmed above, SOC can monitor its progress here; otherwise the request remains available for manual sourcing.</p>}
  <h3><MessageSquare size={18}/> Customer updates</h3>
  <div className="coordinator-sms-health">
   <button disabled={checkingSms||busy} onClick={checkSmsDiagnostics}>{checkingSms?'Checking Wasiliana…':'Check Wasiliana setup (no SMS sent)'}</button>
   {smsDiagnostics&&<p role="status">{smsDiagnostics.ok?
    'Wasiliana key and Sender ID are present in Vercel. Sender: '+(smsDiagnostics.senderId||'not configured')+'. App/key authorization is NOT verified. Balance must be checked in Wasiliana dashboard.':
    'Wasiliana setup incomplete: '+(smsDiagnostics.error||'Check the API key and Sender ID in Vercel.')}</p>}
  </div>
  <p className="coordinator-help">Step 1: Generate and save the message draft. Step 2: In the saved draft below, press <strong>Send SMS now</strong> to actually submit it to Wasiliana. Saving a draft alone does NOT send a text.</p>
  {!caseItem.canContact&&<p className="coordinator-help"><AlertCircle size={15}/> Customer phone is missing; confirm contact details before messaging.</p>}
  <label>Update type<select value={kind} onChange={e=>{setKind(e.target.value);setMessage('')}}>{updateKinds.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
  <label>Channel<select value={channel} onChange={e=>setChannel(e.target.value as 'whatsapp'|'sms'|'phone')}><option value="whatsapp">WhatsApp (manual)</option><option value="sms">SMS via Wasiliana</option><option value="phone">Phone call (log only)</option></select></label>
  <button className="coordinator-secondary" onClick={()=>setMessage(makeMessage(caseItem,kind,acceptedName))}>Generate update draft</button>
  <textarea rows={5} maxLength={1200} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write a factual update to the customer. Do not promise availability or a booking unless it is confirmed."/>
  <button disabled={busy||message.trim().length<10||!caseItem.canContact||(channel==='sms'&&message.length>600)} onClick={()=>action({action:'customer_update_draft',kind,channel,message},'Draft saved. Scroll down to the saved draft and press Send SMS now to actually send it.')}>Save draft — do not send</button>
  {channel==='sms'&&message.length>600&&<p className="coordinator-help">SMS content must be 600 characters or fewer.</p>}
  {updates.length>0&&<div className="coordinator-updates">{updates.map(u=><div key={u.id} className="coordinator-update-item">
   <div><strong>{u.kind.replaceAll('_',' ')}</strong><span className="coordinator-status">{u.state.replaceAll('_',' ')}</span></div>
   <p>{u.message}</p>{u.state==='draft'&&u.channel==='sms'&&<p className="coordinator-sms-unsent">NOT SENT — this message is saved as a draft only. Press Send SMS now below.</p>}<small>{u.channel} · {new Date(u.created_at).toLocaleString('en-KE',{timeZone:'Africa/Nairobi'})}</small>
   {u.state==='draft'&&<div className="coordinator-update-actions">
    <button disabled={busy} onClick={()=>copyUpdate(u.message)}><Copy size={14}/> Copy message</button>
    {u.channel==='sms'&&<>{!caseItem.notifyOptIn&&<small>Customer has not opted in to SMS notifications.</small>}{smsAttempts.filter(s=>s.customer_update_id===u.id).map(s=><small key={s.id}>{s.gateway==='wasiliana'?'Wasiliana':'SMSLeopard'} API: {s.state} (HTTP {s.http_status||'unknown'}) · attempt {s.id.slice(0,8)}</small>)}
    {!smsAttempts.some(s=>s.customer_update_id===u.id)&&<button className="coordinator-send-sms" disabled={busy||!smsEnabled||!smsReady||!caseItem.notifyOptIn||!caseItem.canContact} onClick={()=>sendSms('customer',u.id)}>Send SMS now — via Wasiliana</button>}</>}
    {u.channel==='whatsapp'&&caseItem.canContact&&<button disabled={busy||!caseItem.whatsappOptIn} onClick={()=>openReviewedWhatsApp('customer',u.id)}><ExternalLink size={14}/> Open customer WhatsApp</button>}{u.channel==='whatsapp'&&!caseItem.whatsappOptIn&&<small>Customer has not opted in to WhatsApp updates.</small>}
    {u.channel!=='sms'&&<button disabled={busy} onClick={()=>{if(window.confirm('Have you actually delivered this update to the customer using '+u.channel+'?'))action({action:'customer_update_mark_sent',updateId:u.id},'Manual customer update recorded')}}>Confirm manual delivery</button>}
   </div>}
  </div>)}</div>}
  {!smsEnabled&&<p className="coordinator-help">SMS sending is configured for staff-controlled testing but not yet enabled. No messages will be sent until the coordinator SMS switch is activated.</p>}
  {feedback&&<p className="coordinator-feedback" role="status">{feedback}</p>}
 </section>;
}
