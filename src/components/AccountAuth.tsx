'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowRight,MapPin,UsersRound,Wrench} from 'lucide-react';
type Role='customer'|'provider';
type ExistingSession={authenticated:boolean;accountType:Role;primaryAccountType?:Role};
const trackLink=(value:string)=>/^\/track\?ref=JT-[0-9A-F]{8}$/.test(value);
export function AccountAuth(){
 const router=useRouter();
 const [role,setRole]=useState<Role>('customer');
 const [stage,setStage]=useState<'phone'|'otp'>('phone');
 const [phone,setPhone]=useState('');
 const [code,setCode]=useState('');
 const [consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [existing,setExisting]=useState<ExistingSession|null>(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  const q=new URLSearchParams(window.location.search);
  if(q.get('role')==='provider'&&!trackLink(q.get('next')||''))setRole('provider');
  if(trackLink(q.get('next')||''))setRole('customer');
  let active=true;
  fetch('/api/auth/session',{cache:'no-store'}).then(async r=>r.ok?r.json():null)
   .then(data=>{if(active&&data?.authenticated)setExisting(data)}).catch(()=>{});
  return()=>{active=false};
 },[]);
 const isProvider=role==='provider';
 async function switchRole(next:Role){
  if(busy)return;
  setRole(next);setStage('phone');setCode('');setError('');setNotice('');
  if(!existing)return;
  // A previously verified user changes modes immediately on tab selection;
  // there is no repeated OTP or second registration.
  setBusy(true);
  try{
   const res=await fetch('/api/auth/mode',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({mode:next})});
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(data.error||'Unable to switch JiTap mode');
   const linked=new URLSearchParams(window.location.search).get('next')||'';
   complete(next==='customer'&&trackLink(linked)?linked:data.redirect||(next==='provider'?'/provider':'/account'));
  }catch(e){setError(e instanceof Error?e.message:'Unable to switch JiTap mode')}
  finally{setBusy(false)}
 }
 function complete(destination:string){
  window.dispatchEvent(new Event('jitap:auth-changed'));
  router.replace(destination);router.refresh();
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   if(existing){
    const res=await fetch('/api/auth/mode',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({mode:role})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(data.error||'Unable to open your JiTap account');
    const next=new URLSearchParams(window.location.search).get('next')||'';
    complete(role==='customer'&&trackLink(next)?next:data.redirect|| (isProvider?'/provider':'/account'));
    return;
   }
   const res=await fetch('/api/auth/phone',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:stage==='phone'?'send':'verify',role,phone,code,consent})});
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(data.error||'Unable to complete sign in');
   if(stage==='phone'){
    setStage('otp');setNotice('We sent a six-digit verification code to your mobile number.');
   }else{
    const next=new URLSearchParams(window.location.search).get('next')||'';
    complete(role==='customer'&&trackLink(next)?next:(data.redirect|| (isProvider?'/provider':'/account')));
   }
  }catch(err){setError(err instanceof Error?err.message:'Something went wrong. Please try again.')}
  finally{setBusy(false)}
 }
 return <main className={'jt-auth-page'+(isProvider?' jt-auth-provider':' jt-auth-customer')}>
  <section className="jt-auth-panel" aria-labelledby="jt-auth-heading">
   <div className="jt-auth-panel-inner">
    <div className="jt-auth-eyebrow"><UsersRound size={20}/> WELCOME TO JITAP</div>
    <h2 id="jt-auth-heading">Sign In to JiTap</h2>
    <p className="jt-auth-subtitle">One mobile number, one account. Choose how you want to use JiTap.</p>
    <div className="jt-auth-roles" role="group" aria-label="Choose how to use JiTap">
     <button className={role==='customer'?'selected':''} type="button" onClick={()=>switchRole('customer')} aria-pressed={role==='customer'}><MapPin size={22}/><span><strong>Customer</strong><small>Find and request services</small></span></button>
     <button className={role==='provider'?'selected':''} type="button" onClick={()=>switchRole('provider')} aria-pressed={role==='provider'}><Wrench size={22}/><span><strong>Provider</strong><small>Manage jobs and availability</small></span></button>
    </div>
    <div className="jt-auth-form-title"><h3>{stage==='otp'?'Verify your mobile number':existing?'Continue with your JiTap account':'Sign in with your mobile number'}</h3>
     <p>{stage==='otp'?<>Enter the 6-digit SMS code sent to your number. <button className="jt-auth-edit" type="button" onClick={()=>{setStage('phone');setCode('');setNotice('')}}>Change number</button></>:
       existing?'You are already verified. Select Customer or Provider to continue.':'New to JiTap? Your account will be created automatically after verification. No password needed.'}</p>
    </div>
    <form className="jt-auth-form" onSubmit={submit}>
     {!existing&&(stage==='phone'?<>
      <label className="jt-auth-label" htmlFor="jt-auth-phone">Mobile number</label>
      <div className="jt-auth-phone-row"><span className="jt-auth-country">🇰🇪 &nbsp; +254</span><input id="jt-auth-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="712 345 678" value={phone} onChange={e=>setPhone(e.target.value)} required minLength={9} maxLength={18}/></div>
      <label className="jt-auth-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>I agree to JiTap's <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.</span></label>
     </>:<>
      <label className="jt-auth-label" htmlFor="jt-auth-code">6-digit verification code</label>
      <input className="jt-auth-input jt-auth-otp" id="jt-auth-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" placeholder="000000" required/>
     </>)}
     {error&&<p className="jt-auth-error" role="alert">{error}</p>}{notice&&<p className="jt-auth-notice" role="status">{notice}</p>}
     <button className="jt-auth-submit" type="submit" disabled={busy}>{busy?'Please wait…':existing?'Continue as '+(isProvider?'Provider':'Customer'):stage==='otp'?'Verify & Continue':'Send Sign In Code'}<ArrowRight size={19}/></button>
     {!existing&&stage==='otp'&&<button className="jt-auth-resend" type="button" disabled={busy} onClick={()=>{setStage('phone');setCode('');setNotice('Request another code using the same mobile number.')}}>Request another code</button>}
    </form>
    {isProvider&&<p className="jt-auth-existing">New providers can complete their profile and verification after signing in.</p>}
   </div>
  </section>
 </main>;
}
