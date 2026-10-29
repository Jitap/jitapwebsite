'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,CheckCircle2,ChevronLeft,MapPin,Search,X} from 'lucide-react';
import {areas,categories} from '@/lib/data';
import {IntakeForm} from '@/components/Interactive';

type Question={id:string;title:string;hint?:string;options:{value:string;label:string;hint?:string}[]};
const time:Question={id:'timing',title:"When would you like the job done?",hint:"We'll capture your preference. No arrival time is guaranteed.",options:[{value:'today',label:'Urgent — as soon as possible',hint:'Today or within 48 hours, if available'},{value:'this-week',label:'Within the week',hint:'I can agree on a time with a fundi'},{value:'flexible',label:'Flexible',hint:'Just researching or planning ahead'}]};
const byCategory:Record<string,Question[]>={
 cleaning:[
 {id:'frequency',title:'How often would you like your space cleaned?',options:[{value:'Once',label:'Just once'},{value:'Weekly',label:'Every week'},{value:'Every 2 weeks',label:'Every two weeks'},{value:'Monthly',label:'Once a month'}]},
 {id:'size',title:'How big is the place?',options:[{value:'Bedsitter or studio',label:'Bedsitter / studio'},{value:'1 bedroom',label:'1 bedroom'},{value:'2 bedrooms',label:'2 bedrooms'},{value:'3 bedrooms',label:'3 bedrooms'},{value:'4 or more bedrooms',label:'4 or more bedrooms'}]},
 {id:'cleanType',title:'What kind of cleaning do you need?',options:[{value:'Standard home cleaning',label:'Regular house cleaning'},{value:'Deep cleaning',label:'Deep cleaning'},{value:'Move-in/move-out',label:'Moving in or moving out'},{value:'Office/Airbnb cleaning',label:'Office / Airbnb cleaning'}]},time],
 plumbing:[
 {id:'job',title:'What plumbing issue needs a fundi?',options:[{value:'Leaking tap or pipe',label:'Leaking tap or pipe'},{value:'Blocked sink or drain',label:'Blocked sink / drain'},{value:'Toilet or shower repair',label:'Toilet / shower issue'},{value:'Install new fittings',label:'Install taps, pipes or fittings'},{value:'Other plumbing',label:'Something else'}]},time],
 electrical:[
 {id:'job',title:'What electrical work do you need?',hint:'Avoid contact with exposed wires and unsafe equipment.',options:[{value:'Lights and fittings',label:'Lights or fittings'},{value:'Sockets or switches',label:'Faulty sockets / switches'},{value:'Wiring inspection',label:'Wiring or safety inspection'},{value:'Hot shower/installation',label:'Hot shower / appliance installation'},{value:'Other electrical fault',label:'Something else'}]},time],
 painting:[
 {id:'job',title:'What would you like painted?',options:[{value:'Interior room or wall',label:'Interior walls / room'},{value:'Exterior walls',label:'Exterior walls'},{value:'Touch ups',label:'Touch-ups and repairs'},{value:'Full house',label:'Whole home'}]},time],
 carpentry:[
 {id:'job',title:'What kind of woodwork needs doing?',options:[{value:'Furniture assembly',label:'Furniture assembly'},{value:'Wardrobe/cabinet',label:'Wardrobes or cabinets'},{value:'Door repair',label:'Door repairs'},{value:'Custom woodwork',label:'Custom carpentry'}]},time],
 'appliance-repair':[
 {id:'appliance',title:'Which appliance needs attention?',options:[{value:'Fridge or freezer',label:'Fridge / freezer'},{value:'Washing machine',label:'Washing machine'},{value:'Cooker or oven',label:'Cooker / oven'},{value:'Other appliance',label:'Other appliance'}]},time],
 'general-repairs':[
 {id:'job',title:'What would you like mounted or repaired?',options:[{value:'TV mounting',label:'Mount my TV'},{value:'Wall shelving',label:'Shelves / wall fittings'},{value:'Door, handle or fixture',label:'Door, handle or fixture'},{value:'Other home repair',label:'Other repairs'}]},time],
 'other-services':[
 {id:'job',title:'Which service best describes the job?',options:[{value:'Computer or phone repairs',label:'Computer / phone repairs'},{value:'Moving or delivery',label:'Moving / delivery'},{value:'Gardening',label:'Gardening / outdoors'},{value:'Other local service',label:'Something else'}]},time]
};
export function GuidedRequest(){
 const [category,setCategory]=useState('other-services');
 const [area,setArea]=useState('Bamburi');
 const [description,setDescription]=useState('');
 const [stage,setStage]=useState(0);
 const [answers,setAnswers]=useState<Record<string,string>>({});
 const [ready,setReady]=useState(false);
 const [finalDescription,setFinalDescription]=useState('');
 useEffect(()=>{const s=new URLSearchParams(window.location.search);const c=s.get('category');const a=s.get('area');const d=s.get('description');if(c&&categories.some(x=>x.slug===c))setCategory(c);if(a&&areas.includes(a))setArea(a);else try{const stored=localStorage.getItem('jitap:area');if(stored&&areas.includes(stored))setArea(stored)}catch{}if(d)setDescription(d)},[]);
 const questions=useMemo(()=>byCategory[category]||byCategory['other-services'],[category]);
 const question=questions[stage];
 const answer=question?answers[question.id]||'':'';
 const label=categories.find(x=>x.slug===category)?.name||'Local service';
 const finished=()=>{const details=questions.filter(x=>x.id!=='timing').map(q=>answers[q.id]?q.title.replace('?','')+': '+answers[q.id]:null).filter(Boolean).join('; ');const full=[description.trim()||('I need help with '+label.toLowerCase()+' in '+area+'.'),details].filter(Boolean).join('. ').slice(0,1500);const t=answers.timing==='today'||answers.timing==='this-week'?answers.timing:'flexible';const params=new URLSearchParams(window.location.search);params.set('category',category);params.set('area',area);const finalBrief=full.length<12?'I need a local service fundi in '+area+'.':full;setFinalDescription(finalBrief);params.set('description',finalBrief);params.set('timing',t);window.history.replaceState(window.history.state,'','/request?'+params.toString());setReady(true)};
 function next(){if(stage>=questions.length-1){finished()}else setStage(n=>n+1)}
 function skip(){if(stage>=questions.length-1)finished();else setStage(n=>n+1)}
 return <div className="th-request-flow">
  <div className="container th-request-layout">
   <aside className="th-request-aside"><span className="th-overline">JITAP REQUEST</span><h2>Habari! What needs fixing?</h2><p>Help us understand your job so we can review your service request accurately.</p><div className="th-request-summary"><div><Search size={18}/><span><strong>{label}</strong><small>{description||'Describe your job below'}</small></span></div><div><MapPin size={18}/><span><strong>{area}</strong><small>Service neighbourhood</small></span></div></div><div className="th-request-notice"><CheckCircle2 size={18}/><p>We will collect your mobile number in the final step. It will not appear on a public fundi profile.</p></div><Link href="/fundis" className="th-request-directory-link">Browse registered fundis <ArrowRight size={15}/></Link></aside>
   {ready?<div className="th-request-final"><div className="th-request-final-title"><span className="th-overline">FINAL STEP</span><h2>How can JiTap reach you?</h2><p>Review and submit your enquiry. Submitting isn't a booking or a guaranteed match.</p><button type="button" onClick={()=>setReady(false)}><ChevronLeft size={18}/> Edit job details</button></div><IntakeForm kind="request" initialCategory={category} initialArea={area} initialTiming={answers.timing==="today"||answers.timing==="this-week"?answers.timing:"flexible"} initialDescription={finalDescription}/></div>:
   <div className="th-questions" role="region" aria-label="Service request questions"><div className="th-question-nav"><button type="button" onClick={()=>stage>0?setStage(n=>n-1):window.location.assign('/services')} aria-label="Back"><ArrowLeft size={20}/></button><div><strong>{label}</strong><span>{stage+1} of {questions.length} · Tell us about your job</span></div><Link href="/" aria-label="Close questionnaire"><X size={20}/></Link></div>
    <div className="th-progress"><span style={{width:((stage+1)/questions.length)*100+'%'}}/></div>
    <div className="th-question-body"><div className="th-edit-brief"><label htmlFor="brief">Your description</label><textarea id="brief" value={description} rows={2} onChange={e=>setDescription(e.target.value)} placeholder="e.g. need cleaner in Nyali this Saturday"/></div><label className="th-question-area" htmlFor="areaSelect">Service area <select id="areaSelect" value={area} onChange={e=>setArea(e.target.value)}>{areas.map(a=><option key={a}>{a}</option>)}</select></label><h2>{question.title}</h2>{question.hint&&<p className="th-question-hint">{question.hint}</p>}<div className="th-choice-list">{question.options.map(x=><button key={x.value} type="button" className={'th-choice'+(answer===x.value?' selected':'')} aria-pressed={answer===x.value} onClick={()=>setAnswers(y=>({...y,[question.id]:x.value}))}><span className="th-radio-indicator"/><span><strong>{x.label}</strong>{x.hint&&<small>{x.hint}</small>}</span></button>)}</div></div>
    <div className="th-question-actions"><button type="button" className="th-skip" onClick={skip}>Skip</button><button type="button" className="th-next" onClick={next} disabled={!answer}> {stage===questions.length-1?'Continue to contact details':'Next'} <ArrowRight size={18}/></button></div>
   </div>}
  </div>
 </div>;
}
