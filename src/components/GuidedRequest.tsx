'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,ChevronLeft,X} from 'lucide-react';
import {areas,categories} from '@/lib/data';
import {IntakeForm} from '@/components/Interactive';
import {MatchedFundis} from '@/components/FundiDirectory';

type Question={id:string;title:string;hint?:string;options:{value:string;label:string;hint?:string}[]};
const mamaFuaServices=[
 {value:'Basic cleaning + dishes',label:'Cleaning + dishes',price:'KES 300 / bedroom',detail:'Surfaces, floors, dishes and bathroom refresh'},
 {value:'Deep cleaning',label:'Deep cleaning',price:'KES 400 / room',detail:'Thorough room-by-room cleaning'},
 {value:'Hand laundry — small basket',label:'Laundry · Small basket',price:'KES 400 / basket',detail:'About 10–15 clothes'},
 {value:'Hand laundry — large basket',label:'Laundry · Large basket',price:'KES 540 / basket',detail:'About 20–30 clothes'},
 {value:'Shoe cleaning',label:'Shoe cleaning',price:'KES 44 / pair',detail:'Basic shoe wash and care'},
 {value:'House cleaning only',label:'House cleaning only',price:'KES 800 / job',detail:'Routine tidying and mopping'},
 {value:'Duvets and blankets',label:'Duvets & blankets',price:'KES 650 / item',detail:'Wash and dry bedding'},
 {value:'Folding and ironing',label:'Folding & ironing',price:'KES 540 / basket',detail:'Press and fold clothes'}
];
const time:Question={id:'timing',title:"When would you like the job done?",hint:"Choose your preferred date and time. JiTap will confirm the schedule with the provider.",options:[]};
const preferredTimes=[['08:00','8:00 AM'],['09:30','9:30 AM'],['11:00','11:00 AM'],['13:00','1:00 PM'],['15:00','3:00 PM'],['17:00','5:00 PM']];
function nairobiNow(){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
 const get=(type:string)=>parts.find(p=>p.type===type)?.value||'00';
 return {date:get('year')+'-'+get('month')+'-'+get('day'),minutes:Number(get('hour'))*60+Number(get('minute'))};
}
function upcomingDays(today:string){
 const [y,m,d]=today.split('-').map(Number);
 return Array.from({length:7},(_,i)=>{
  const date=new Date(Date.UTC(y,m-1,d+i));
  return {value:date.toISOString().slice(0,10),day:new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',weekday:'short'}).format(date),number:date.getUTCDate(),month:new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',month:'short'}).format(date)};
 });
}
function furthestDate(today:string){
 const [y,m,d]=today.split('-').map(Number);
 return new Date(Date.UTC(y,m-1,d+59)).toISOString().slice(0,10);
}

const byCategory:Record<string,Question[]>={
 cleaning:[
 {id:'cleanServices',title:'What should Mama Fua help with?',hint:'Choose one or more services.',options:mamaFuaServices.map(x=>({value:x.value,label:x.label,hint:x.detail}))},
 {id:'size',title:'How many bedrooms?',hint:'Select the size of your home.',options:[{value:'Bedsitter or studio',label:'Bedsitter / studio'},{value:'1 bedroom',label:'1 bedroom'},{value:'2 bedrooms',label:'2 bedrooms'},{value:'3 bedrooms',label:'3 bedrooms'},{value:'4 or more bedrooms',label:'4+ bedrooms'}]},
 time],
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
 const [preferredDate,setPreferredDate]=useState('');
 const [preferredTime,setPreferredTime]=useState('');
 const [clock,setClock]=useState(()=>nairobiNow());
 useEffect(()=>{setClock(nairobiNow())},[]);
 const [ready,setReady]=useState(false);
 const [showMatches,setShowMatches]=useState(false);
 const [finalDescription,setFinalDescription]=useState('');
 useEffect(()=>{const s=new URLSearchParams(window.location.search);const c=s.get('category');const a=s.get('area');const d=s.get('description');if(c&&categories.some(x=>x.slug===c))setCategory(c);if(a&&areas.includes(a))setArea(a);else try{const stored=localStorage.getItem('jitap:area');if(stored&&areas.includes(stored))setArea(stored)}catch{}if(d)setDescription(d)},[]);
 const questions=useMemo(()=>byCategory[category]||byCategory['other-services'],[category]);
 const question=questions[stage];
 const answer=question?answers[question.id]||'':'';
 const onMamaFua=category==='cleaning'&&question?.id==='cleanServices';
 const selectedCleaning=answer?answer.split(' | ').filter(Boolean):[];
 const onTime=question?.id==='timing';
 const days=useMemo(()=>upcomingDays(clock.date),[clock.date]);
 const validDate=preferredDate>=clock.date&&preferredDate<=furthestDate(clock.date);
 const validTime=preferredTimes.some(([time])=>time===preferredTime)&&!(preferredDate===clock.date&&Number(preferredTime.slice(0,2))*60+Number(preferredTime.slice(3,5))<=clock.minutes);
 const stageNames:string[]=[...questions.map((q,i)=>q.id==='timing'?'Time':q.id==='frequency'?'Frequency':q.id==='size'?'Space':q.id==='cleanType'?'Type':i===0?'Need':'Details'),'Matches','Contact'];
 const label=categories.find(x=>x.slug===category)?.name||'Local service';
 const finished=()=>{const details=questions.filter(x=>x.id!=='timing').map(q=>answers[q.id]?q.title.replace('?','')+': '+answers[q.id]:null).filter(Boolean).join('; ');const full=[description.trim()||('I need help with '+label.toLowerCase()+' in '+area+'.'),details,preferredDate&&preferredTime?'Preferred appointment: '+preferredDate+' at '+preferredTime+' (East Africa Time)':null].filter(Boolean).join('. ').slice(0,1500);const delta=Math.round((Date.parse(preferredDate+'T00:00:00Z')-Date.parse(clock.date+'T00:00:00Z'))/86400000);const t=delta<=1?'today':delta<=7?'this-week':'flexible';const params=new URLSearchParams(window.location.search);params.set('category',category);params.set('area',area);const finalBrief=full.length<12?'I need a local service fundi in '+area+'.':full;setFinalDescription(finalBrief);params.set('description',finalBrief);params.set('timing',t);params.set('preferredDate',preferredDate);params.set('preferredTime',preferredTime);window.history.replaceState(window.history.state,'','/request?'+params.toString());setShowMatches(true)};
 function next(){if(onTime&&(!validDate||!validTime))return;if(stage>=questions.length-1){finished()}else setStage(n=>n+1)}
 function skip(){if(onTime)return;if(stage>=questions.length-1)finished();else setStage(n=>n+1)}
 return <div className="th-request-flow">
  <div className="container th-request-layout">
   
   {ready?<div className="th-request-final"><div className="jt-segment-progress th-request-stage-progress jt-named-progress" role="progressbar" aria-label="Service request progress" aria-valuemin={1} aria-valuemax={stageNames.length} aria-valuenow={stageNames.length}>{stageNames.map((name,index)=><div key={name+'-'+index} className="jt-progress-unit"><span className="is-active"/><small>{name}</small></div>)}</div><div className="th-request-final-title"><span className="th-overline">FINAL STEP</span><h2>Where can JiTap reach you?</h2><p>Enter your mobile number to submit your service request.</p><p className="jt-request-schedule"><strong>Preferred time:</strong> {preferredDate} · {preferredTimes.find(([time])=>time===preferredTime)?.[1]} EAT</p><button type="button" onClick={()=>setReady(false)}><ChevronLeft size={18}/> Edit job details</button></div><IntakeForm kind="request" initialCategory={category} initialArea={area} initialTiming={answers.timing==="today"||answers.timing==="this-week"?answers.timing:"flexible"} initialDescription={finalDescription} initialPreferredDate={preferredDate} initialPreferredTime={preferredTime}/></div>:showMatches?<div className="th-request-final jt-matches-wrap"><div className="jt-segment-progress th-request-stage-progress jt-named-progress" role="progressbar" aria-label="Service request progress" aria-valuemin={1} aria-valuemax={stageNames.length} aria-valuenow={questions.length+1}>{stageNames.map((name,index)=><div key={name+'-'+index} className="jt-progress-unit"><span className={index<=questions.length?'is-active':''}/><small>{name}</small></div>)}</div><button type="button" className="jt-profile-back" onClick={()=>setShowMatches(false)}>← Edit service brief</button><MatchedFundis category={category} area={area} onQuotes={()=>setReady(true)}/></div>:
   <div className="th-questions" role="region" aria-label="Service request questions"><div className="th-question-nav"><button type="button" onClick={()=>stage>0?setStage(n=>n-1):window.location.assign('/services')} aria-label="Back"><ArrowLeft size={20}/></button><div><strong>{label}</strong><span>{stage+1} of {questions.length} · Tell us about your job</span></div><Link href="/" aria-label="Close questionnaire"><X size={20}/></Link></div>
    <div className="jt-segment-progress th-request-segments jt-named-progress" role="progressbar" aria-label="Service brief progress" aria-valuemin={1} aria-valuemax={stageNames.length} aria-valuenow={stage+1}>{stageNames.map((name,index)=><div className="jt-progress-unit" key={name+'-'+index}><span className={index<=stage?'is-active':''}/><small className={index===stage?'is-current':''}>{name}</small></div>)}</div>
    <div className="th-question-body"><div className="th-edit-brief"><label htmlFor="brief">Your description</label><textarea id="brief" value={description} rows={2} onChange={e=>setDescription(e.target.value)} placeholder="e.g. need cleaner in Nyali this Saturday"/></div><label className="th-question-area" htmlFor="areaSelect">Service area <select id="areaSelect" value={area} onChange={e=>setArea(e.target.value)}>{areas.map(a=><option key={a}>{a}</option>)}</select></label><h2>{question.title}</h2>{question.hint&&<p className="th-question-hint">{question.hint}</p>}{onTime?<div className="jt-time-picker">
 <h3>Preferred date</h3>
 <div className="jt-date-options" role="group" aria-label="Preferred service date">{days.map((day,i)=><button type="button" key={day.value} className={'jt-date-chip'+(preferredDate===day.value?' selected':'')} aria-pressed={preferredDate===day.value} onClick={()=>{setPreferredDate(day.value);setPreferredTime('');setClock(nairobiNow())}}><small>{i===0?'Today':i===1?'Tomorrow':day.day}</small><strong>{day.number}</strong><small>{day.month}</small></button>)}</div>
 <label className="jt-later-date" htmlFor="jt-preferred-date">Or choose another date <input id="jt-preferred-date" type="date" min={clock.date} max={furthestDate(clock.date)} value={preferredDate} onChange={e=>{setPreferredDate(e.target.value);setPreferredTime('');setClock(nairobiNow())}}/></label>
 <h3>Preferred time <small>East Africa Time (EAT)</small></h3>
 <div className="jt-time-options" role="group" aria-label="Preferred service time">{preferredTimes.map(([value,label])=>{const past=preferredDate===clock.date&&(Number(value.slice(0,2))*60+Number(value.slice(3,5))<=clock.minutes);return <button type="button" key={value} className={'jt-time-chip'+(preferredTime===value?' selected':'')} aria-pressed={preferredTime===value} disabled={!validDate||past} onClick={()=>{setClock(nairobiNow());setPreferredTime(value)}}>{label}</button>})}</div>
 <p className="jt-time-note">These are your preferred times, not confirmed provider availability. JiTap will coordinate the actual appointment.</p>
 </div>:onMamaFua?<div className="jt-mamafua">
 <p className="jt-mamafua-guidance">Reference prices only · JiTap confirms the quote with your cleaner.</p>
 <div className="jt-mamafua-options">{mamaFuaServices.map(service=>{const checked=selectedCleaning.includes(service.value);return <label key={service.value} className={'jt-mamafua-choice'+(checked?' selected':'')}><input type="checkbox" checked={checked} onChange={e=>setAnswers(old=>{const selected=(old.cleanServices||'').split(' | ').filter(Boolean);const next=e.target.checked?[...selected,service.value]:selected.filter(x=>x!==service.value);return {...old,cleanServices:next.join(' | ')}})}/><span><strong>{service.label}</strong><small>{service.detail}</small></span><em>{service.price}</em></label>})}</div>
 <p className="jt-mamafua-guidance">Cleaning visits may have a 3-hour minimum, with additional hours from KES 80 in the supplied price guide. Confirm supplies and exact scope with JiTap.</p>
 </div>:onMamaFua?<div className="jt-mamafua">
 <p className="jt-mamafua-guidance">Reference prices only · JiTap confirms the quote with your cleaner.</p>
 <div className="jt-mamafua-options">{mamaFuaServices.map(service=>{const checked=selectedCleaning.includes(service.value);return <label key={service.value} className={'jt-mamafua-choice'+(checked?' selected':'')}><input type="checkbox" checked={checked} onChange={e=>setAnswers(old=>{const selected=(old.cleanServices||'').split(' | ').filter(Boolean);const next=e.target.checked?[...selected,service.value]:selected.filter(x=>x!==service.value);return {...old,cleanServices:next.join(' | ')}})}/><span><strong>{service.label}</strong><small>{service.detail}</small></span><em>{service.price}</em></label>})}</div>
 <p className="jt-mamafua-guidance">Cleaning visits may have a 3-hour minimum, with additional hours from KES 80 in the supplied price guide. Confirm supplies and exact scope with JiTap.</p>
 </div>:<div className="th-choice-list">{question.options.map(x=><button key={x.value} type="button" className={'th-choice'+(answer===x.value?' selected':'')} aria-pressed={answer===x.value} onClick={()=>setAnswers(y=>({...y,[question.id]:x.value}))}><span className="th-radio-indicator"/><span><strong>{x.label}</strong>{x.hint&&<small>{x.hint}</small>}</span></button>)}</div>}</div>
    <div className="th-question-actions">{!onTime&&<button type="button" className="th-skip" onClick={skip}>Skip</button>}<button type="button" className="th-next" onClick={next} disabled={onTime?(!validDate||!validTime):!answer}> {onTime?'Continue':'Next'} <ArrowRight size={18}/></button></div>
   </div>}
  </div>
 </div>;
}
