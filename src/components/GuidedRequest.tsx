'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,ChevronLeft,X,Sparkles,Shirt,Footprints,House,BedDouble,Layers,Droplets,Brush} from 'lucide-react';
import {areas,categories,inferService} from '@/lib/data';
import {understandJob} from '@/lib/job-intelligence';
import {IntakeForm} from '@/components/Interactive';
import {MatchedFundis} from '@/components/FundiDirectory';
import {MovingRequest} from '@/components/MovingRequest';

type Question={id:string;title:string;hint?:string;options:{value:string;label:string;hint?:string}[]};
const mamaFuaServices=[
 {value:'Basic cleaning + dishes',label:'Cleaning + dishes',price:300,unit:'bedroom',icon:Sparkles,detail:'Floors, dishes and tidy-up'},
 {value:'Deep cleaning',label:'Deep cleaning',price:400,unit:'room',icon:Brush,detail:'Thorough room-by-room clean'},
 {value:'Hand laundry — small basket',label:'Small laundry basket',price:400,unit:'basket',icon:Shirt,detail:'About 10–15 items'},
 {value:'Hand laundry — large basket',label:'Large laundry basket',price:540,unit:'basket',icon:Shirt,detail:'About 20–30 items'},
 {value:'Shoe cleaning',label:'Shoe cleaning',price:44,unit:'pair',icon:Footprints,detail:'Basic cleaning per pair'},
 {value:'House cleaning only',label:'House cleaning only',price:800,unit:'job',icon:House,detail:'Regular cleaning and tidying'},
 {value:'Duvets and blankets',label:'Duvets & blankets',price:650,unit:'item',icon:BedDouble,detail:'Washing of bedding'},
 {value:'Folding and ironing',label:'Folding & ironing',price:540,unit:'basket',icon:Layers,detail:'Press and fold garments'}
] as const;
const money=(amount:number)=>'KES '+amount.toLocaleString('en-KE');
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

const isTvMounting=(text:string)=>/(?:\b(?:tv|television|smart\s*tv|screen)\b.{0,55}\b(?:mount|mounting|install|hang|bracket|wall)\b|\b(?:mount|mounting|hang|bracket)\b.{0,55}\b(?:tv|television|screen)\b|\btv\s*mount\w*\b)/i.test(text);
const plumbingQuestions=(description:string):Question[]=>{
 const t=description.toLowerCase();
 const leak=/(leak|drip|water\s*(?:coming|flowing|running)|inavuja|kuvuja|vuja)/i.test(t);
 const blockage=/(block|clog|drain|imeziba|ziba)/i.test(t);
 if(leak)return [
  {id:'leakLocation',title:'Where is the water leaking?',hint:'Tell the plumber where to check first.',options:[
   {value:'Kitchen or bathroom tap',label:'From a tap or mixer'},
   {value:'Under sink or basin',label:'Under the sink or basin'},
   {value:'Exposed or hidden pipe',label:'From a water pipe'},
   {value:'Toilet or shower fitting',label:'At the toilet or shower'},
   {value:'Not sure',label:"I'm not sure"}]},
  {id:'leakSeverity',title:'How serious is the leak?',options:[
   {value:'Occasional dripping',label:'A slow drip'},
   {value:'Continuous dripping or trickling',label:'Constant dripping or a trickle'},
   {value:'Water flowing or pooling',label:'Water is flowing or pooling'},
   {value:'Water supply shut off',label:'I have turned off the water'},
   {value:'Not sure',label:'Not sure'}]},time
 ];
 if(blockage)return [
  {id:'blockedFixture',title:'What is blocked?',options:[
   {value:'Kitchen sink',label:'Kitchen sink'},
   {value:'Bathroom sink',label:'Bathroom sink'},
   {value:'Toilet',label:'Toilet'},
   {value:'Shower or floor drain',label:'Shower / floor drain'},
   {value:'Outdoor drain',label:'Outside drain'}]},
  {id:'blockedSeverity',title:'What happens when you try to drain water?',options:[
   {value:'Drains slowly',label:'The water drains slowly'},
   {value:'Does not drain',label:"The water won't drain"},
   {value:'Water backs up or overflows',label:'Water backs up or overflows'},
   {value:'Uncertain',label:'Not sure'}]},time
 ];
 return byCategory.plumbing;
};
const tvMountingQuestions:Question[]=[
 {id:'screenSize',title:'What size is your TV?',hint:'Choose the screen size in inches so the installer can bring suitable mounting equipment.',options:[
  {value:'Up to 32 inches',label:'Up to 32 inches'},
  {value:'33–43 inches',label:'33–43 inches'},
  {value:'44–55 inches',label:'44–55 inches'},
  {value:'56–65 inches',label:'56–65 inches'},
  {value:'Over 65 inches',label:'Over 65 inches'},
  {value:'Not sure',label:"I'm not sure"}]},
 {id:'wallType',title:'What kind of wall will the TV be mounted on?',options:[
  {value:'Concrete or brick',label:'Concrete / brick'},
  {value:'Plasterboard or partition',label:'Plasterboard / partition'},
  {value:'Wood or other',label:'Wood / other'},
  {value:'Not sure',label:"I'm not sure"}]},
 {id:'bracket',title:'Do you already have a TV wall bracket?',options:[
  {value:'Already have bracket',label:'Yes, I have a bracket'},
  {value:'Need installer to supply bracket',label:'No, please supply one'},
  {value:'Not sure',label:'Not sure'}]},
 time
];
const byCategory:Record<string,Question[]>={
 cleaning:[
 {id:'cleanServices',title:'What should Mama Fua help with?',hint:'Choose services and quantities.',options:mamaFuaServices.map(x=>({value:x.value,label:x.label,hint:x.detail}))},
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
 {id:'job',title:'What kind of help do you need?',hint:'Tell JiTap what you need done. You can also describe the exact job above.',options:[{value:'Install or mount an item',label:'Install or mount something'},{value:'Repair or maintain something',label:'Repair or maintenance'},{value:'Deliver or transport an item',label:'Delivery or transport'},{value:'Event or personal service',label:'Event or personal service'},{value:'Other or not sure',label:'Something else / not sure'}]},time]
};
export function GuidedRequest(){
 const [category,setCategory]=useState('other-services');
 const [area,setArea]=useState('Bamburi');
 const [description,setDescription]=useState('');
 const [stage,setStage]=useState(0);
 const [answers,setAnswers]=useState<Record<string,string>>({});
 const [cleaningQuantities,setCleaningQuantities]=useState<Record<string,number>>({});
 const [preferredDate,setPreferredDate]=useState('');
 const [preferredTime,setPreferredTime]=useState('');
 const [clock,setClock]=useState(()=>nairobiNow());
 useEffect(()=>{setClock(nairobiNow())},[]);
 const [ready,setReady]=useState(false);
 const [showMatches,setShowMatches]=useState(false);
 const [finalDescription,setFinalDescription]=useState('');
 useEffect(()=>{const s=new URLSearchParams(window.location.search);const c=s.get('category');const a=s.get('area');const d=s.get('description');if(c&&categories.some(x=>x.slug===c))setCategory(c);if(a&&areas.includes(a))setArea(a);else try{const stored=localStorage.getItem('jitap:area');if(stored&&areas.includes(stored))setArea(stored)}catch{}if(d){setDescription(d);if((!c||c==='other-services')&&inferService(d))setCategory(inferService(d)!);}
 setHydrated(true);
 },[]);
 const [aiQuestions,setAiQuestions]=useState<Question[]|null>(null);
 const [aiBusy,setAiBusy]=useState(false);
 const [aiError,setAiError]=useState(false);
 const [aiResolvedDescription,setAiResolvedDescription]=useState('');
 const [allowStandard,setAllowStandard]=useState(false);
 const [hydrated,setHydrated]=useState(false);
 const understood=useMemo(()=>understandJob(description),[description]);
 const context=understood&&understood.category===category?understood:null;
 const tvMount=isTvMounting(description)&&['general-repairs','other-services'].includes(category);
 const questions=useMemo(()=>tvMount?tvMountingQuestions:context?[...context.questions,time]:category!=='cleaning'&&category!=='moving'&&aiQuestions?.length?[...aiQuestions,time]:category==='plumbing'?plumbingQuestions(description):byCategory[category]||byCategory['other-services'],[category,description,tvMount,aiQuestions,context]);
 const question=questions[stage];
 const answer=question?answers[question.id]||'':'';
 const onMamaFua=category==='cleaning'&&question?.id==='cleanServices';
 const selectedCleaning=(answers.cleanServices||'').split(' | ').filter(Boolean);
 const cleaningLineItems=mamaFuaServices.filter(service=>selectedCleaning.includes(service.value)).map(service=>({...service,quantity:cleaningQuantities[service.value]||1}));
 const cleaningTotal=cleaningLineItems.reduce((sum,item)=>sum+item.price*item.quantity,0);
 const onTime=question?.id==='timing';
 const days=useMemo(()=>upcomingDays(clock.date),[clock.date]);
 const validDate=preferredDate>=clock.date&&preferredDate<=furthestDate(clock.date);
 const validTime=preferredTimes.some(([time])=>time===preferredTime)&&!(preferredDate===clock.date&&Number(preferredTime.slice(0,2))*60+Number(preferredTime.slice(3,5))<=clock.minutes);
 const stageNames:string[]=category==='cleaning'?['Need','Time','Total','Contact']:[...questions.map((q,i)=>q.id==='timing'?'Time':q.id==='screenSize'?'TV size':q.id==='wallType'?'Wall':q.id==='bracket'?'Bracket':q.id==='frequency'?'Frequency':q.id==='size'?'Space':q.id==='cleanType'?'Type':i===0?'Need':'Details'),'Matches','Contact'];
 const shouldAwaitAI=hydrated&&stage===0&&!ready&&!showMatches&&!tvMount&&!context&&category!=='cleaning'&&category!=='moving'&&description.trim().length>=8&&!allowStandard;
 const aiWaiting=!hydrated||(shouldAwaitAI&&(aiBusy||(!aiError&&aiResolvedDescription!==description.trim())));
 const aiFailed=shouldAwaitAI&&aiError&&!aiBusy;
 const label=tvMount?'TV Mounting':context?({ 'fan-repair':'Fan Repair','socket-repair':'Electrical Socket Repair','tv-repair':'TV Repair','microwave-repair':'Microwave Repair','computer-electronics':'Electronics Service','vehicle-exhaust':'Vehicle Exhaust','photography':'Photography','vehicle-mechanic':'Vehicle Mechanic' } as Record<string,string>)[context.subcategory]||categories.find(x=>x.slug===category)?.name||'Local service':categories.find(x=>x.slug===category)?.name||'Local service';
 const finished=()=>{const details=category==='cleaning'
 ? cleaningLineItems.map(item=>item.label+' x '+item.quantity+' '+item.unit+(item.quantity===1?'':'s')+' (reference '+money(item.price*item.quantity)+')').join('; ')+'; Reference estimate: '+money(cleaningTotal)+' (not a confirmed quote)'
 : questions.filter(x=>x.id!=='timing').map(q=>answers[q.id]?q.title.replace('?','')+': '+answers[q.id]:null).filter(Boolean).join('; ');const full=[description.trim()||('I need help with '+label.toLowerCase()+' in '+area+'.'),context?'JiTap inferred service: '+context.task+'. Subcategory: '+context.subcategory:null,details,preferredDate&&preferredTime?'Preferred appointment: '+preferredDate+' at '+preferredTime+' (East Africa Time)':null].filter(Boolean).join('. ').slice(0,1500);const delta=Math.round((Date.parse(preferredDate+'T00:00:00Z')-Date.parse(clock.date+'T00:00:00Z'))/86400000);const t=delta<=1?'today':delta<=7?'this-week':'flexible';const params=new URLSearchParams(window.location.search);params.set('category',category);params.set('area',area);const finalBrief=full.length<12?'I need a local service fundi in '+area+'.':full;setFinalDescription(finalBrief);params.set('description',finalBrief);params.set('timing',t);params.set('preferredDate',preferredDate);params.set('preferredTime',preferredTime);window.history.replaceState(window.history.state,'','/request?'+params.toString());setShowMatches(true)};
 function next(){if(onTime&&(!validDate||!validTime))return;if(stage>=questions.length-1){finished()}else setStage(n=>n+1)}
 function skip(){if(onTime)return;if(stage>=questions.length-1)finished();else setStage(n=>n+1)}
 useEffect(()=>{
  // Tailor the job brief while still at the first question. Never interrupt an in-progress questionnaire.
  if(ready||showMatches||stage!==0||tvMount||context||category==='cleaning'||category==='moving'||description.trim().length<8||(aiQuestions?.length&&aiResolvedDescription===description.trim())){
   setAiBusy(false);return;
  }
  setAiQuestions(null);
  setAiError(false);
  setAiBusy(true);
  let cancelled=false;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   try{
    const res=await fetch('/api/ai/intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
     description:description.trim().slice(0,600),area,categoryHint:category
    }),signal:controller.signal});
    if(!res.ok)throw new Error('AI intake unavailable');
    const data=await res.json();
    if(cancelled)return;
    if(!data.ok||!Array.isArray(data.questions)||!data.questions.length)throw new Error('No tailored questions returned');
    // Only free-text/Other Services may be reclassified. Never silently override a service chosen by the customer.
    if(category==='other-services'&&typeof data.category==='string'&&data.category!=='other-services'&&categories.some(x=>x.slug===data.category)){
     setCategory(data.category);setAiQuestions(data.questions);setAiResolvedDescription(description.trim());setAnswers({});return;
    }
    if(data.category===category){
     setAiQuestions(data.questions);setAiResolvedDescription(description.trim());setAnswers({});
    }else{
     throw new Error('AI returned a different service category');
    }
   }catch{if(!cancelled)setAiError(true)}
   finally{if(!cancelled)setAiBusy(false)}
  },650);
  return ()=>{cancelled=true;clearTimeout(timer);controller.abort()};
 },[description,category,area,ready,showMatches,stage,tvMount,context,aiResolvedDescription]);
 if(category==='moving')return <MovingRequest/>;
 return <div className="th-request-flow">
  <div className="container th-request-layout">
   
   {ready?<div className="th-request-final"><div className="jt-segment-progress th-request-stage-progress jt-named-progress" role="progressbar" aria-label="Service request progress" aria-valuemin={1} aria-valuemax={stageNames.length} aria-valuenow={stageNames.length}>{stageNames.map((name,index)=><div key={name+'-'+index} className="jt-progress-unit"><span className="is-active"/><small>{name}</small></div>)}</div><div className="th-request-final-title"><span className="th-overline">FINAL STEP</span><h2>How can JiTap reach you, and where is the job?</h2><p>Share your mobile number and choose the service location before submitting your request.</p><p className="jt-request-schedule"><strong>Preferred time:</strong> {preferredDate} · {preferredTimes.find(([time])=>time===preferredTime)?.[1]} EAT</p><button type="button" onClick={()=>setReady(false)}><ChevronLeft size={18}/> Edit job details</button></div><IntakeForm kind="request" initialCategory={category} initialArea={area} initialTiming={answers.timing==="today"||answers.timing==="this-week"?answers.timing:"flexible"} initialDescription={finalDescription} initialPreferredDate={preferredDate} initialPreferredTime={preferredTime}/></div>:showMatches?<div className="th-request-final jt-matches-wrap"><div className="jt-segment-progress th-request-stage-progress jt-named-progress" role="progressbar" aria-label="Service request progress" aria-valuemin={1} aria-valuemax={stageNames.length} aria-valuenow={questions.length+1}>{stageNames.map((name,index)=><div key={name+'-'+index} className="jt-progress-unit"><span className={index<=questions.length?'is-active':''}/><small>{name}</small></div>)}</div><button type="button" className="jt-profile-back" onClick={()=>setShowMatches(false)}>← Edit service brief</button>{category==='cleaning'&&<section className="jt-cleaning-total" aria-label="Cleaning reference total"><div className="jt-cleaning-total-head"><div><span className="th-overline">YOUR CLEANING ESTIMATE</span><h2>Review your total</h2></div><strong>{money(cleaningTotal)}</strong></div><div className="jt-cleaning-total-lines">{cleaningLineItems.map(item=><div key={item.value}><span>{item.label} <small>× {item.quantity} {item.unit}{item.quantity===1?'':'s'}</small></span><strong>{money(item.price*item.quantity)}</strong></div>)}</div><p>Reference estimate only. JiTap will confirm availability, scope and the final quote with a cleaner. Extra hours or supplies may affect the price.</p></section>}<MatchedFundis category={category} area={area} specialty={tvMount?'tv-mounting':context?.subcategory} onQuotes={()=>setReady(true)}/></div>:
   <div className="th-questions" role="region" aria-label="Service request questions"><div className="th-question-nav"><button type="button" onClick={()=>stage>0?setStage(n=>n-1):window.location.assign('/services')} aria-label="Back"><ArrowLeft size={20}/></button><div><strong>{label}</strong><span>{stage+1} of {questions.length} · Tell us about your job</span></div><Link href="/" aria-label="Close questionnaire"><X size={20}/></Link></div>
    <div className="jt-segment-progress th-request-segments jt-named-progress" role="progressbar" aria-label="Service brief progress" aria-valuemin={1} aria-valuemax={stageNames.length} aria-valuenow={stage+1}>{stageNames.map((name,index)=><div className="jt-progress-unit" key={name+'-'+index}><span className={index<=stage?'is-active':''}/><small className={index===stage?'is-current':''}>{name}</small></div>)}</div>
    <div className="th-question-body"><div className="th-edit-brief"><label htmlFor="brief">Your description</label><textarea id="brief" value={description} rows={2} onChange={e=>{const next=e.target.value;setDescription(next);const inferred=inferService(next);if(category==='other-services'&&inferred&&inferred!=='other-services'){setCategory(inferred);setStage(0);setAnswers({});setAiQuestions(null)}}} placeholder="e.g. my sink is leaking in Nyali"/></div><label className="th-question-area" htmlFor="areaSelect">Service area <select id="areaSelect" value={area} onChange={e=>setArea(e.target.value)}>{areas.map(a=><option key={a}>{a}</option>)}</select></label>{aiWaiting?<div className="jt-ai-intake-loading" role="status" aria-live="polite"><span className="jt-ai-signal-stage" aria-hidden="true"><span className="jt-ai-signal-orbit"/><img className="jt-ai-signal-icon" src="/images/jitap-signal-loader.svg" alt="" width={200} height={150}/></span><h2>JiTap is understanding your request…</h2><p>Preparing questions specific to the help you need.</p></div>:aiFailed?<div className="jt-ai-intake-loading" role="alert"><h2>JiTap couldn't prepare your questions</h2><p>Check your connection or choose to continue using standard questions.</p><button type="button" onClick={()=>{setAiError(false);setAiResolvedDescription('');setDescription(s=>s+' ');}}>Try again</button><button type="button" onClick={()=>setAllowStandard(true)}>Use standard questions</button></div>:<><h2>{question.title}</h2>{question.hint&&<p className="th-question-hint">{question.hint}</p>}{onTime?<div className="jt-time-picker">
 <h3>Preferred date</h3>
 <div className="jt-date-options" role="group" aria-label="Preferred service date">{days.map((day,i)=><button type="button" key={day.value} className={'jt-date-chip'+(preferredDate===day.value?' selected':'')} aria-pressed={preferredDate===day.value} onClick={()=>{setPreferredDate(day.value);setPreferredTime('');setClock(nairobiNow())}}><small>{i===0?'Today':i===1?'Tomorrow':day.day}</small><strong>{day.number}</strong><small>{day.month}</small></button>)}</div>
 <label className="jt-later-date" htmlFor="jt-preferred-date">Or choose another date <input id="jt-preferred-date" type="date" min={clock.date} max={furthestDate(clock.date)} value={preferredDate} onChange={e=>{setPreferredDate(e.target.value);setPreferredTime('');setClock(nairobiNow())}}/></label>
 <label className="jt-time-select-label" htmlFor="jt-preferred-time">Preferred time <small>East Africa Time (EAT)</small></label>
 <select className="jt-time-select" id="jt-preferred-time" value={preferredTime} disabled={!validDate} onChange={e=>{setClock(nairobiNow());setPreferredTime(e.target.value)}}>
  <option value="">Select a time</option>
  {preferredTimes.map(([value,label])=>{const past=preferredDate===clock.date&&(Number(value.slice(0,2))*60+Number(value.slice(3,5))<=clock.minutes);return <option key={value} value={value} disabled={past}>{label}</option>})}
 </select>
 <p className="jt-time-note">These are your preferred times, not confirmed provider availability. JiTap will coordinate the actual appointment.</p>
 </div>:onMamaFua?<div className="jt-mamafua">
 <p className="jt-mamafua-guidance">Indicative prices · Select one or more services.</p>
 <div className="jt-uber-service-list">{mamaFuaServices.map(service=>{const checked=selectedCleaning.includes(service.value);const Icon=service.icon;const quantity=cleaningQuantities[service.value]||1;return <div key={service.value} className={'jt-uber-service'+(checked?' selected':'')}>
  <button type="button" className="jt-uber-service-main" aria-pressed={checked} onClick={()=>setAnswers(old=>{const selected=(old.cleanServices||'').split(' | ').filter(Boolean);return {...old,cleanServices:(checked?selected.filter(x=>x!==service.value):[...selected,service.value]).join(' | ')}})}>
   <span className="jt-uber-icon"><Icon size={23} strokeWidth={1.8}/></span>
   <span className="jt-uber-service-name"><strong>{service.label}</strong><small>{service.detail}</small></span>
   <span className="jt-uber-price"><strong>{money(service.price)}</strong><small>per {service.unit}</small></span>
   <span className="jt-uber-indicator" aria-hidden="true">{checked?'✓':''}</span>
  </button>
  {checked&&<div className="jt-uber-quantity"><label htmlFor={'jt-qty-'+service.unit+'-'+service.price}>Quantity ({service.unit}{service.unit==='job'?'':'s'})</label><select id={'jt-qty-'+service.unit+'-'+service.price} value={quantity} onChange={e=>setCleaningQuantities(old=>({...old,[service.value]:Number(e.target.value)}))}>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select><span>Subtotal <strong>{money(service.price*quantity)}</strong></span></div>}
 </div>})}</div>
 <div className="jt-cleaning-inline-total"><span>Reference total</span><strong>{money(cleaningTotal)}</strong></div>
 <p className="jt-mamafua-guidance">Final price is confirmed by JiTap and the cleaner. Visit minimums, extra hours or materials may change the quote.</p>
 </div>:<div className="th-choice-list">{question.options.map(x=><button key={x.value} type="button" className={'th-choice'+(answer===x.value?' selected':'')} aria-pressed={answer===x.value} onClick={()=>setAnswers(y=>({...y,[question.id]:x.value}))}><span className="th-radio-indicator"/><span><strong>{x.label}</strong>{x.hint&&<small>{x.hint}</small>}</span></button>)}</div>}</>}</div>
    {!aiWaiting&&!aiFailed&&<div className="th-question-actions">{!onTime&&!onMamaFua&&<button type="button" className="th-skip" onClick={skip}>Skip</button>}<button type="button" className="th-next" onClick={next} disabled={onTime?(!validDate||!validTime):!answer}> {onTime?'Continue':onMamaFua?'Continue':'Next'} <ArrowRight size={18}/></button></div>}
   </div>}
  </div>
 </div>;
}
