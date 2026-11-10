'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent,type KeyboardEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Smartphone,UserRound,BriefcaseBusiness} from 'lucide-react';

type Role='customer'|'provider';
type ExistingSession={authenticated:boolean;accountType:Role;primaryAccountType?:Role;reviewer?:boolean};
const trackLink=(value:string)=>/^\/track\?ref=JT-[0-9A-F]{8}$/.test(value);
const fmtPhone=(value:string)=>{
 const digits=value.replace(/\D/g,'');
 if(digits.startsWith('254')&&digits.length>=12)return '+254 '+digits.slice(3,6)+' '+digits.slice(6,9)+' '+digits.slice(9,12);
 if(digits.startsWith('0')&&digits.length>=10)return '+254 '+digits.slice(1,4)+' '+digits.slice(4,7)+' '+digits.slice(7,10);
 return '+254 '+digits.slice(-9);
};
export function AccountAuth(){
 const router=useRouter();
 const [role,setRole]=useState<Role>('customer');
 const [reviewOpen,setReviewOpen]=useState(false);
 const [reviewCode,setReviewCode]=useState('');
 const [stage,setStage]=useState<'phone'|'otp'>('phone');
 const [phone,setPhone]=useState('');
 const [verifiedPhone,setVerifiedPhone]=useState('');
 const [code,setCode]=useState('');
 const [consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [existing,setExisting]=useState<ExistingSession|null>(null);
 const [sessionChecking,setSessionChecking]=useState(true);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [cooldown,setCooldown]=useState(0);
 const codeInput=useRef<HTMLInputElement>(null);
 const phoneInput=useRef<HTMLInputElement>(null);
 const submitting=useRef(false);
 const [nextUrl,setNextUrl]=useState('');
 useEffect(()=>{
  const q=new URLSearchParams(window.location.search);
  const next=q.get('next')||'';
  setNextUrl(next);
  if(q.get('review')==='1')setReviewOpen(true);
  if(trackLink(next))setRole('customer');
  else if(q.get('role')==='provider')setRole('provider');
  let active=true;
  fetch('/api/auth/session',{cache:'no-store',credentials:'same-origin'})
   .then(async r=>r.ok?r.json():null)
   .then(data=>{if(active&&data?.authenticated)setExisting(data)})
   .catch(()=>{})
   .finally(()=>{if(active)setSessionChecking(false)});
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  if(stage==='otp'&&!existing)codeInput.current?.focus();
 },[stage,existing]);
 useEffect(()=>{
  if(cooldown<=0)return;
  const timer=window.setTimeout(()=>setCooldown(n=>Math.max(0,n-1)),1000);
  return()=>window.clearTimeout(timer);
 },[cooldown]);
 const complete=useCallback((destination:string)=>{
  window.dispatchEvent(new Event('jitap:auth-changed'));
  router.replace(destination);router.refresh();
 },[router]);
 const switchRole=async(next:Role)=>{
  if(busy||submitting.current||role===next)return;
  if(stage==='otp'){setCode('');setStage('phone');setVerifiedPhone('')}
  setRole(next);setError('');setNotice('');
  if(!existing)return;
  submitting.current=true;setBusy(true);
  try{
   const res=await fetch('/api/auth/mode',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:next})});
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(data.error||'Unable to switch JiTap mode');
   complete(next==='customer'&&trackLink(nextUrl)?nextUrl:data.redirect||(next==='provider'?'/provider':'/account'));
  }catch(e){setError(e instanceof Error?e.message:'Unable to switch mode')}
  finally{setBusy(false);submitting.current=false}
 };
 async function sendCode(){
  const res=await fetch('/api/auth/phone',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'send',role,phone,consent})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||'Could not send the verification code');
  setVerifiedPhone(phone);
  setCode('');
  setStage('otp');
  setCooldown(45);
  setNotice('We sent a six-digit SMS verification code to your number.');
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(submitting.current)return;
  submitting.current=true;setBusy(true);setError('');setNotice('');
  try{
   if(existing){
    const res=await fetch('/api/auth/mode',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({mode:role})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(data.error||'Unable to open your account');
    complete(role==='customer'&&trackLink(nextUrl)?nextUrl:data.redirect||(role==='provider'?'/provider':'/account'));
    return;
   }
   if(stage==='phone'){
    if(!consent)throw Error('Please agree to the Terms of Service and Privacy Policy.');
    await sendCode();
   }else{
    if(!/^\d{6}$/.test(code))throw Error('Enter the complete 6-digit verification code.');
    const res=await fetch('/api/auth/phone',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({action:'verify',role,phone:verifiedPhone,code,consent})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw Error(data.error||'Unable to verify your code.');
    complete(role==='customer'&&trackLink(nextUrl)?nextUrl:data.redirect||(role==='provider'?'/provider':'/account'));
   }
  }catch(e){setError(e instanceof Error?e.message:'Something went wrong. Try again.')}
  finally{setBusy(false);submitting.current=false}
 }
 async function resend(){
  if(busy||cooldown>0||submitting.current)return;
  submitting.current=true;setBusy(true);setError('');setNotice('');
  try{await sendCode()}catch(e){setError(e instanceof Error?e.message:'Unable to resend SMS code.')}
  finally{setBusy(false);submitting.current=false}
 }
 function changeNumber(){
  if(busy)return;
  setStage('phone');setCode('');setVerifiedPhone('');setError('');setNotice('');
  window.setTimeout(()=>phoneInput.current?.focus(),0);
 }
 async function openReview(){
  if(busy||!reviewCode.trim())return;
  setBusy(true);setError('');setNotice('');
  try{
   const res=await fetch('/api/auth/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:reviewCode,role})});
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(data.error||'Reviewer sign-in unsuccessful');
   setReviewCode('');complete(data.redirect||'/account');
  }catch(e){setError(e instanceof Error?e.message:'Could not open reviewer access')}
  finally{setBusy(false)}
 }
 const isOtp=stage==='otp'&&!existing;
 const selectedLabel=role==='provider'?'Provider':'Customer';
 const otpDigits=Array.from({length:6},(_,i)=>code[i]||'');
 return <main className={'jt-auth-page jt-auth-redesign jt-auth-'+role}>
  <div className="jt-auth-brand">
   <Link href="/" aria-label="JiTap home"><img src="/images/jitap-logo-transparent.svg" alt="JiTap — Ask Match Buzz" width="224" height="110"/></Link>
  </div>
  <section className={'jt-auth-panel '+(isOtp?'jt-auth-verify-panel':'jt-auth-signin-panel')} aria-labelledby="jt-auth-heading">
   <div className="jt-auth-panel-inner">
    {!isOtp?<>
     <div className="jt-auth-eyebrow"><UserRound size={22} aria-hidden="true"/> WELCOME TO JITAP</div>
     <h1 id="jt-auth-heading">Sign In to JiTap</h1>
     <p className="jt-auth-subtitle">One mobile number, one account. Choose how you want to use JiTap.</p>
     <div className="jt-auth-roles" role="group" aria-label="Choose your JiTap role">
      <div className={'jt-auth-role-slider '+(role==='provider'?'to-provider':'to-customer')} aria-hidden="true"/>
      <button type="button" disabled={busy} className={role==='customer'?'selected':''} onClick={()=>void switchRole('customer')} aria-pressed={role==='customer'}><UserRound size={19} aria-hidden="true"/>Customer</button>
      <button type="button" disabled={busy} className={role==='provider'?'selected':''} onClick={()=>void switchRole('provider')} aria-pressed={role==='provider'}><BriefcaseBusiness size={19} aria-hidden="true"/>Provider</button>
     </div>
     <form className="jt-auth-form" onSubmit={e=>void submit(e)}>
      {!existing&&<>
       <label className="jt-auth-label" htmlFor="jt-auth-phone">Mobile number</label>
       <div className="jt-auth-phone-row">
        <span className="jt-auth-country"><span aria-hidden="true">🇰🇪</span> +254</span>
        <input ref={phoneInput} id="jt-auth-phone" type="tel" inputMode="tel" autoComplete="tel-national"
         placeholder="712 345 678" value={phone} onChange={e=>setPhone(e.target.value)}
         required minLength={9} maxLength={18} aria-invalid={!!error}/>
       </div>
       <label className="jt-auth-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/>
        <span>I agree to JiTap's <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.</span>
       </label>
      </>}
      {existing&&<p className="jt-auth-session-notice">Your mobile number is already verified. Continue as {selectedLabel}.</p>}
      {error&&<p className="jt-auth-error" role="alert">{error}</p>}
      {notice&&<p className="jt-auth-notice" role="status">{notice}</p>}
      <button className="jt-auth-submit" type="submit" disabled={busy||sessionChecking}>
       {busy?'Please wait…':sessionChecking?'Checking session…':existing?'Continue as '+selectedLabel:'Continue'}
      </button>
     </form>
     {!existing&&<div className="jt-auth-design-access">
      <button type="button" className="jt-auth-design-toggle" aria-expanded={reviewOpen} aria-controls="jt-auth-design-panel" onClick={()=>{setReviewOpen(v=>!v);setError('');setNotice('')}} disabled={busy}>Design team access</button>
      {reviewOpen&&<form id="jt-auth-design-panel" className="jt-auth-design-form" onSubmit={e=>{e.preventDefault();void openReview()}}>
       <label htmlFor="jt-review-code" className="jt-auth-label">Reviewer access code</label>
       <input id="jt-review-code" className="jt-auth-review-input" type="password" autoComplete="off" value={reviewCode} onChange={e=>setReviewCode(e.target.value)} required placeholder="Enter your design review code"/>
       <p>Choose Customer or Provider above. Preview uses example data; real requests and bookings are not changed.</p>
       {error&&<p className="jt-auth-error" role="alert">{error}</p>}
       <button className="jt-auth-submit" disabled={busy||!reviewCode.trim()} type="submit">{busy?'Opening…':'Open '+(role==='provider'?'Provider':'Customer')+' Review'}</button>
      </form>}
     </div>}
    </>:<>
     <div className="jt-auth-phone-symbol" aria-hidden="true"><span><Smartphone size={37} strokeWidth={2.2}/></span></div>
     <h1 id="jt-auth-heading">Verify Your Mobile Number</h1>
     <p className="jt-auth-verify-subtitle">Enter the 6-digit code sent to your number.</p>
     <p className="jt-auth-code-destination">{fmtPhone(verifiedPhone)}</p>
     <form className="jt-auth-form jt-auth-code-form" onSubmit={e=>void submit(e)}>
      <div className="jt-auth-code-holder" onClick={()=>codeInput.current?.focus()}>
       <input ref={codeInput} className="jt-auth-code-native" type="text" inputMode="numeric"
        autoComplete="one-time-code" name="one-time-code" value={code}
        onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
        onPaste={e=>{e.preventDefault();setCode(e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6))}}
        onKeyDown={(e:KeyboardEvent<HTMLInputElement>)=>{if(e.key==='Escape')changeNumber()}}
        maxLength={6} pattern="[0-9]{6}" aria-label="Six-digit verification code" required/>
       <div className="jt-auth-code-cells" aria-hidden="true">
        {otpDigits.map((digit,i)=><span className={'jt-auth-code-cell '+(i===Math.min(code.length,5)?'active':'')+(digit?' filled':'')} key={i}>{digit||'\u00a0'}</span>)}
       </div>
      </div>
      {error&&<p className="jt-auth-error" role="alert">{error}</p>}
      {notice&&<p className="jt-auth-notice" role="status">{notice}</p>}
      <button className="jt-auth-submit" type="submit" disabled={busy||code.length!==6}>
       {busy?'Verifying…':'Verify Code'}
      </button>
      <button type="button" className="jt-auth-change-number" onClick={changeNumber} disabled={busy}>Change Number</button>
      <button type="button" className="jt-auth-resend" onClick={()=>void resend()} disabled={busy||cooldown>0}>
       {cooldown>0?'Resend code in '+cooldown+'s':'Resend verification code'}
      </button>
     </form>
    </>}
   </div>
  </section>
 </main>;
}
