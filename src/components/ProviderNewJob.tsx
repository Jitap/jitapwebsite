'use client';
import {useState,type FormEvent} from 'react';
import {X,CalendarPlus,CheckCircle2} from 'lucide-react';
type Repeat='none'|'daily'|'weekdays'|'weekly'|'monthly'|'yearly'|'custom';
type Rule={repeat:Repeat;count:number;interval:number;unit:'days'|'weeks'|'months'};
const options=[['none','Does not repeat'],['daily','Daily'],['weekdays','Monday to Friday'],['weekly','Weekly'],['monthly','Monthly'],['yearly','Yearly'],['custom','Custom']] as const;
export function ProviderNewJob({date,onClose,onCreated}:{date:string;onClose:()=>void;onCreated:(requestId:string)=>Promise<void>|void}){
 const [form,setForm]=useState({title:'',customerName:'',phone:'',location:'',description:'',
 date,startTime:'09:00',endTime:'10:00',repeat:'none' as Repeat,interval:1,unit:'weeks' as Rule['unit'],
 count:1,reminderMinutes:30,reminderChannel:'in_app' as 'in_app'|'whatsapp_manual',whatsappOptIn:false});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const put=<K extends keyof typeof form>(key:K,value:(typeof form)[K])=>setForm(x=>({...x,[key]:value}));
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setError('');setSuccess('');
  if(form.startTime>=form.endTime){setError('End time must be after start time.');return}
  if(form.reminderChannel==='whatsapp_manual'&&!form.whatsappOptIn){setError('Confirm customer permission before using WhatsApp reminders.');return}
  setBusy(true);
  try{
   const response=await fetch('/api/provider/calendar/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Unable to create booking.');
   setSuccess('Created '+data.count+' confirmed '+(data.count===1?'booking':'bookings')+'. Service ID: '+data.reference);
   await onCreated(data.requestId);
  }catch(e){setError(e instanceof Error?e.message:'Could not save booking')}finally{setBusy(false)}
 }
 return <div className="jcal-new-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="jcal-new-sheet" role="dialog" aria-modal="true" aria-labelledby="jcal-new-job-heading">
   <header><div><span className="jcal-new-eyebrow"><CalendarPlus size={16}/> PROVIDER BOOKING</span><h2 id="jcal-new-job-heading">Create a job</h2><p>Record a booking received by call or WhatsApp.</p></div><button type="button" onClick={onClose} aria-label="Close create job"><X size={23}/></button></header>
   {success?<div className="jcal-new-success"><CheckCircle2 size={34}/><strong>{success}</strong><p>This booking is now in your calendar and JiTap Service Operations. Your customer can track it after phone verification.</p><button type="button" onClick={onClose}>View calendar</button></div>:
   <form onSubmit={submit}>
    <label>Job title<input required maxLength={120} placeholder="e.g. Repair kitchen sink" value={form.title} onChange={e=>put('title',e.target.value)}/></label>
    <div className="jcal-new-pair"><label>Customer name<input required maxLength={120} placeholder="Full name" value={form.customerName} onChange={e=>put('customerName',e.target.value)}/></label><label>Mobile number<input required type="tel" inputMode="tel" placeholder="07XXXXXXXX" value={form.phone} onChange={e=>put('phone',e.target.value)}/></label></div>
    <label>Customer location<input required maxLength={180} placeholder="e.g. Vescon 1, Bamburi, Mombasa" value={form.location} onChange={e=>put('location',e.target.value)}/><small>Use the customer's exact place or building name, not an approximate area.</small></label>
    <div className="jcal-new-pair"><label>Date<input required type="date" value={form.date} onChange={e=>put('date',e.target.value)}/></label><label>Repeat<select value={form.repeat} onChange={e=>{const repeat=e.target.value as Repeat;setForm(x=>({...x,repeat,count:repeat==='none'?1:repeat==='yearly'?2:Math.max(2,x.count)}) )}}>{options.map(([v,label])=><option value={v} key={v}>{label}</option>)}</select></label></div>
    <div className="jcal-new-pair"><label>From<input type="time" required value={form.startTime} onChange={e=>put('startTime',e.target.value)}/></label><label>To<input type="time" required value={form.endTime} onChange={e=>put('endTime',e.target.value)}/></label></div>
    {form.repeat!=='none'&&<div className="jcal-new-repeat">
      {form.repeat==='custom'&&<div className="jcal-new-pair"><label>Repeat every<input type="number" min={1} max={12} value={form.interval} onChange={e=>put('interval',Number(e.target.value))}/></label><label>Interval<select value={form.unit} onChange={e=>put('unit',e.target.value as Rule['unit'])}><option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option></select></label></div>}
      <label>Number of appointments<input type="number" min={2} max={24} value={form.count} onChange={e=>put('count',Number(e.target.value))}/></label><small>Creates up to 24 separately tracked bookings, within the next 12 months. Each visit gets its own Service ID.</small>
    </div>}
    <div className="jcal-new-pair"><label>Reminder<select value={form.reminderMinutes} onChange={e=>put('reminderMinutes',Number(e.target.value))}><option value={0}>At start</option><option value={5}>5 minutes before</option><option value={15}>15 minutes before</option><option value={30}>30 minutes before</option><option value={60}>1 hour before</option><option value={1440}>1 day before</option></select></label><label>Reminder method<select value={form.reminderChannel} onChange={e=>put('reminderChannel',e.target.value as 'in_app'|'whatsapp_manual')}><option value="in_app">JiTap notification</option><option value="whatsapp_manual">WhatsApp (send yourself)</option></select></label></div>
    {form.reminderChannel==='whatsapp_manual'&&<label className="jcal-new-checkbox"><input type="checkbox" checked={form.whatsappOptIn} onChange={e=>put('whatsappOptIn',e.target.checked)}/>Customer has agreed to receive a WhatsApp reminder. JiTap will prepare a message for me to send; it will not send automatically.</label>}
    <label>Job description / notes<textarea rows={3} maxLength={2000} placeholder="e.g. Sink model, part number, replacement parts or additional customer instructions" value={form.description} onChange={e=>put('description',e.target.value)}/></label>
    <p className="jcal-new-explain">Saving confirms your direct customer booking, creates a trackable JiTap Service ID, and records it in SOD.</p>
    {error&&<p role="alert" className="jcal-new-error">{error}</p>}
    <div className="jcal-new-actions"><button type="button" className="jcal-new-secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={busy} className="jcal-new-primary">{busy?'Creating…':'Create booking'}</button></div>
   </form>}
  </section>
 </div>;
}
