'use client';
import {useState,useMemo} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {ChevronRight,ChevronLeft,X,MapPin,SlidersHorizontal,Search,UserRound,ShieldAlert} from 'lucide-react';
import {publicFundis} from '@/lib/providers-public';
import {areas,categories,inferService} from '@/lib/data';

const cleaningQuestions=[
 {title:'How often do you need cleaning?',key:'frequency',answers:['Just once','Every week','Every 2 weeks','Once a month']},
 {title:'How many bedrooms are there?',key:'bedrooms',answers:['1 bedroom','2 bedrooms','3 bedrooms','4 bedrooms','5 bedrooms','6+ bedrooms']},
 {title:"What's your timeline?",key:'timing',answers:['Urgent — within 48 hours','Within a week','Flexible — no rush']}
] as const;
const group=(s:string)=>{const v=s.toLowerCase();if(v.includes('plumb'))return 'plumbing';if(v.includes('electri'))return 'electrical';if(v.includes('clean'))return 'cleaning';if(v.includes('paint'))return 'painting';if(v.includes('carpent')||v.includes('furniture'))return 'carpentry';if(v.includes('appliance'))return 'appliance-repair';return 'other-services'};

export function FundiDirectory(){
 const router=useRouter(),params=useSearchParams();
 const [area,setArea]=useState(params.get('area')||'All areas');
 const [cat,setCat]=useState(params.get('category')||'all');
 const [q,setQ]=useState('');
 const [wizard,setWizard]=useState(false),[step,setStep]=useState(0),[answers,setAnswers]=useState<Record<string,string>>({});
 const filtered=useMemo(()=>publicFundis.filter(p=>(area==='All areas'||p.areas.includes(area))&&(cat==='all'||p.categories.some(c=>group(c)===cat))&&(!q||[p.name,p.business,...p.categories].join(' ').toLowerCase().includes(q.toLowerCase()))),[area,cat,q]);
 function request(p?:typeof publicFundis[number]){
  const c=p?group(p.categories[0]):cat==='all'?'other-services':cat;
  const desc=p?'I need help with '+(p.business||p.categories[0])+'; interested in provider '+p.name+'. Please confirm whether they are available.':'I need '+(categories.find(x=>x.slug===c)?.name||'local service')+' help in '+(area==='All areas'?'Mombasa':area)+'. '+Object.entries(answers).map(([k,v])=>k+': '+v).join('; ');
  router.push('/request?category='+encodeURIComponent(c)+'&area='+encodeURIComponent(area==='All areas'?'Bamburi':area)+'&description='+encodeURIComponent(desc));
 }
 return <div className="fundi-directory">
  <div className="directory-head container">
   <span className="micro-eyebrow">JITAP • LOCAL FUNDIS</span>
   <h1>Find a fundi around you.</h1>
   <p>Explore service professionals who have registered interest in JiTap. Ask about a job and we’ll capture the request. Listings are not yet verified, booked or shown as online.</p>
   <div className="directory-filters">
    <label><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search fundi, skill or business" aria-label="Search providers"/></label>
    <label><MapPin size={18}/><select value={area} onChange={e=>setArea(e.target.value)} aria-label="Filter by area"><option>All areas</option>{areas.map(a=><option key={a}>{a}</option>)}</select></label>
    <label><SlidersHorizontal size={18}/><select value={cat} onChange={e=>setCat(e.target.value)} aria-label="Filter by service"><option value="all">All services</option>{categories.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
   </div>
  </div>
  <section className="container directory-results" aria-label="Provider directory">
   <div className="directory-side"><h2>Need help around the house?</h2><p>Not sure which fundi? Describe the work and your neighbourhood.</p><button className="action-primary" onClick={()=>setWizard(true)}>Help me describe my job <ChevronRight size={17}/></button><p className="fineprint"><ShieldAlert size={15}/> Provider details shown here are sign-up information, not verified ratings or guaranteed availability.</p></div>
   <div className="directory-list"><div className="directory-list-head"><h2>Local fundis & businesses</h2><span>{filtered.length} listed</span></div>
    {filtered.length?filtered.map(p=><article className="directory-card" key={p.id}><div className="directory-avatar"><UserRound size={32}/></div><div className="directory-card-main"><h3>{p.business&&p.business.toLowerCase()!==p.name.toLowerCase()?p.business:p.name}</h3>{p.business&&p.business.toLowerCase()!==p.name.toLowerCase()&&<p className="directory-person">{p.name}</p>}<div className="directory-tags">{p.categories.map(c=><span key={c}>{c}</span>)}</div><div className="directory-location"><MapPin size={15}/>{p.areas.join(' · ')}</div><p className="directory-unverified">Registered interest • Verification and availability pending</p></div><button className="directory-ask" onClick={()=>request(p)}>Ask about this fundi <ChevronRight size={15}/></button></article>):<div className="directory-empty">No sign-ups match these filters yet. You can still describe a service request for this area. <button onClick={()=>request()}>Submit a request</button></div>}
   </div>
  </section>
  {wizard&&<div className="wizard-shade" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target)setWizard(false)}}><div className="wizard-panel" role="dialog" aria-modal="true" aria-label="Service request questions"><div className="wizard-top"><button aria-label="Back" onClick={()=>setStep(Math.max(0,step-1))} disabled={step===0}><ChevronLeft/></button><div>HOUSE CLEANING <small>Help JiTap understand the job</small></div><button aria-label="Close" onClick={()=>setWizard(false)}><X/></button></div><div className="wizard-bar"><span style={{width:(step+1)/cleaningQuestions.length*100+'%'}}/></div><div className="wizard-body"><h2>{cleaningQuestions[step].title}</h2><div className="wizard-options">{cleaningQuestions[step].answers.map(value=><label key={value}><input type="radio" name={cleaningQuestions[step].key} value={value} checked={answers[cleaningQuestions[step].key]===value} onChange={()=>setAnswers(x=>({...x,[cleaningQuestions[step].key]:value}))}/>{value}</label>)}</div></div><div className="wizard-footer"><button type="button" onClick={()=>step<2?setStep(step+1):request()} className="action-primary">{step===2?'Continue to JiTap request':'Next'} <ChevronRight size={17}/></button></div></div></div>}
 </div>;
}
