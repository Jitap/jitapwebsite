'use client';
import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowRight,CalendarCheck,CheckCircle2,Eye,EyeOff,MapPin,ShieldCheck,Smartphone,UsersRound,Wrench} from 'lucide-react';
type Role='customer'|'provider';
type Mode='signup'|'login';
export function AccountAuth(){
 const router=useRouter();
 const [role,setRole]=useState<Role>('provider');
 const [mode,setMode]=useState<Mode>('signup');
 const [stage,setStage]=useState<'details'|'otp'>('details');
 const [phone,setPhone]=useState('');
 const [fullName,setFullName]=useState('');
 const [code,setCode]=useState('');
 const [consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const isProvider=role==='provider';
 function switchRole(next:Role){if(busy)return;setRole(next);setStage('details');setCode('');setError('');setNotice('')}
 function switchMode(next:Mode){if(busy)return;setMode(next);setStage('details');setCode('');setError('');setNotice('')}
 async function submit(e:FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/auth/phone',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:stage==='details'?'send':'verify',intent:mode,role,phone,fullName,consent,code})});
   const json=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(json.error||'JiTap could not complete this request.');
   if(stage==='details'){setStage('otp');setNotice('A verification code has been requested for your mobile number.');}
   else{
    if(json.accountType!==role)setNotice('This number already has a '+json.accountType+' account. Opening its dashboard.');
    router.replace('/account');router.refresh();
   }
  }catch(err){setError(err instanceof Error?err.message:'Something went wrong. Please try again.')}
  finally{setBusy(false)}
 }
 return <main className={'jt-auth-page'+(isProvider?' jt-auth-provider':' jt-auth-customer')}>
  <section className="jt-auth-promo" aria-label="JiTap service network">
   <div className="jt-auth-promo-content">
    <Link href="/" className="jt-auth-promo-brand"><img src="/images/jitap-logo.svg" alt="JiTap" width={185} height={85}/></Link>
    <p className="jt-auth-motto">Neighbourhood Services.<br/>Just a Tap Away.</p>
    <h1>{isProvider?<>Grow Your Business with <em>JiTap</em></>:<>Local Help Starts with <em>JiTap</em></>}</h1>
    <p className="jt-auth-promo-lead">{isProvider?'Get discovered by customers in your area, receive service enquiries and grow your local reputation.':'From a leaking sink to a moving day, find different local services through one simple place to ask.'}</p>
    <div className="jt-auth-benefits">
     <div><span><UsersRound size={25}/></span><p><strong>{isProvider?'Get discovered locally':'Find local skills'}</strong><small>{isProvider?'Show customers the areas and services you cover.':'Start with your location and the help you need.'}</small></p></div>
     <div><span><CalendarCheck size={25}/></span><p><strong>{isProvider?'Manage service requests':'Ask in your own words'}</strong><small>{isProvider?'Keep enquiries and scheduling easier to follow.':'Describe the problem without complicated searching.'}</small></p></div>
     <div><span><ShieldCheck size={25}/></span><p><strong>{isProvider?'Build your profile':'Your number stays private'}</strong><small>{isProvider?'Show your skills as JiTap grows.':'Your contact number is not displayed publicly.'}</small></p></div>
    </div>
    <div className="jt-auth-network"><span className="jt-auth-avatar-cluster" aria-hidden="true"><span>J</span><span>M</span><span>A</span></span><p>Join the JiTap community across Mombasa.</p></div>
   </div>
  </section>
  <section className="jt-auth-panel" aria-labelledby="jt-auth-heading">
   <div className="jt-auth-panel-inner">
    <p className="jt-auth-switch-hint">{mode==='signup'?'Already have an account?':'New to JiTap?'} <button type="button" onClick={()=>switchMode(mode==='signup'?'login':'signup')}>{mode==='signup'?'Log in':'Sign up'}</button></p>
    <div className="jt-auth-eyebrow"><UsersRound size={20}/>{mode==='signup'?'CREATE YOUR ACCOUNT':'WELCOME BACK'}</div>
    <h2 id="jt-auth-heading">{mode==='signup'?'Join JiTap':'Log in to JiTap'}</h2>
    <p className="jt-auth-subtitle">{mode==='signup'?'Choose how you want to use JiTap.':'Select your account type and verify your mobile number.'}</p>
    <div className="jt-auth-roles" role="group" aria-label="Choose account type">
     <button className={role==='customer'?'selected':''} type="button" onClick={()=>switchRole('customer')} aria-pressed={role==='customer'}><MapPin size={22}/><span><strong>I need services</strong><small>Customer account</small></span></button>
     <button className={role==='provider'?'selected':''} type="button" onClick={()=>switchRole('provider')} aria-pressed={role==='provider'}><Wrench size={22}/><span><strong>I provide services</strong><small>Service provider account</small></span></button>
    </div>
    <div className="jt-auth-form-title"><h3>{stage==='otp'?'Verify your mobile number':mode==='signup'?isProvider?'Create your provider account':'Create your customer account':'Log in with your mobile number'}</h3><p>{stage==='otp'?<>Enter the 6-digit SMS code sent to your number. <button type="button" className="jt-auth-edit" onClick={()=>{setStage('details');setCode('');setNotice('')}}>Change number</button></>:<>We use SMS verification, so you don’t need to remember a password.</>}</p></div>
    <form className="jt-auth-form" onSubmit={submit}>
     {stage==='details'?<>
      <label className="jt-auth-label" htmlFor="jt-auth-phone">Mobile number</label>
      <div className="jt-auth-phone-row"><span className="jt-auth-country">🇰🇪 &nbsp; +254</span><input id="jt-auth-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="712 345 678" value={phone} onChange={e=>setPhone(e.target.value)} required minLength={9} maxLength={18}/></div>
      {mode==='signup'&&<><label className="jt-auth-label" htmlFor="jt-auth-name">Full name <span>(optional)</span></label><input id="jt-auth-name" className="jt-auth-input" autoComplete="name" placeholder="Your first and last name" value={fullName} onChange={e=>setFullName(e.target.value)} maxLength={120}/></>}
      {mode==='signup'&&<label className="jt-auth-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>I agree to JiTap's <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.</span></label>}
     </>:<><label className="jt-auth-label" htmlFor="jt-auth-code">6-digit verification code</label><input className="jt-auth-input jt-auth-otp" id="jt-auth-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" placeholder="000000" required/></>}
     {error&&<p className="jt-auth-error" role="alert">{error}</p>}{notice&&<p className="jt-auth-notice" role="status">{notice}</p>}
     <button className="jt-auth-submit" type="submit" disabled={busy}>{busy?'Please wait…':stage==='otp'?'Verify & continue':mode==='signup'?'Continue with mobile':'Send login code'}<ArrowRight size={19}/></button>
     {stage==='otp'&&<button type="button" className="jt-auth-resend" disabled={busy} onClick={()=>{setStage('details');setCode('');setNotice('Request a new SMS code using your mobile number.')}}>Request a new code</button>}
    </form>
    <div className="jt-auth-help"><Smartphone size={18}/><span>SMS delivery requires JiTap's phone authentication service to be enabled. No code is generated on this page.</span></div>
    {isProvider&&<p className="jt-auth-existing">Already registered as a provider? <Link href="/providers/apply">View provider onboarding</Link></p>}
   </div>
  </section>
 </main>;
}
