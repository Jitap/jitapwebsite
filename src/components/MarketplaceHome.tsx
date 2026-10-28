'use client';
import {useEffect,useState, type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {
  Search, MapPin, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight,
  Droplets, Zap, Sparkles, PaintRoller, Hammer, WashingMachine,
  Wrench, MoreHorizontal, MessageCircleMore, UsersRound, CheckCircle2,
  HeartHandshake, Clock3, ShieldCheck
} from 'lucide-react';
import {areas, inferService} from '@/lib/data';
import {track} from '@/lib/analytics';
import {asset,photoUrl} from '@/lib/visual-assets';

const services = [
  {slug:'plumbing',name:'Plumbing',detail:'Leaks, taps, pipes and drainage',icon:Droplets,photo:asset.plumber},
  {slug:'electrical',name:'Electrical',detail:'Sockets, wiring and electrical faults',icon:Zap,photo:asset.electrical},
  {slug:'cleaning',name:'Cleaning',detail:'Home and workspace cleaning',icon:Sparkles,photo:asset.cleaning},
  {slug:'painting',name:'Painting',detail:'Walls, interiors and finishing',icon:PaintRoller,photo:asset.painting},
  {slug:'carpentry',name:'Carpentry',detail:'Furniture, doors and cabinetry',icon:Hammer,photo:asset.carpentry},
  {slug:'appliance-repair',name:'Appliance Repair',detail:'Fridges, washers and home appliances',icon:WashingMachine,photo:asset.appliance},
  {slug:'general-repairs',name:'General Repairs',detail:'Everyday fixes and maintenance',icon:Wrench,photo:asset.carpentry},
  {slug:'other-services',name:'Other Services',detail:'Tell us what you need',icon:MoreHorizontal,photo:asset.coast}
];
const tasks = [
  {title:'Furniture Assembly',slug:'carpentry',prompt:'I need help assembling furniture',photo:asset.carpentry},
  {title:'TV Mounting',slug:'general-repairs',prompt:'I need help mounting a TV',photo:asset.carpentry},
  {title:'Tap & Leak Repairs',slug:'plumbing',prompt:'My sink tap is leaking',photo:asset.plumber},
  {title:'Electrical Installations',slug:'electrical',prompt:'I need an electrician to check my wiring',photo:asset.electrical},
  {title:'House Cleaning',slug:'cleaning',prompt:'I need a house cleaning service',photo:asset.cleaning},
  {title:'Interior Painting',slug:'painting',prompt:'I need a painter for interior walls',photo:asset.painting},
  {title:'Appliance Diagnostics',slug:'appliance-repair',prompt:'I need a washing machine repaired',photo:asset.appliance},
  {title:'Cabinet & Door Repairs',slug:'carpentry',prompt:'My wooden kitchen cabinet needs fixing',photo:asset.carpentry}
];
const steps = [
  {label:'ASK',copy:'Tell us what you need and choose your location.',icon:MessageCircleMore},
  {label:'MATCH',copy:'JiTap checks service fit and supported pilot coverage.',icon:UsersRound},
  {label:'BUZZ',copy:'An eligible provider can respond when matching is available.',icon:CheckCircle2}
];
export function MarketplaceHome(){
 const router=useRouter();
 const [description,setDescription]=useState('');
 const [area,setArea]=useState('Bamburi');
 const [taskPage,setTaskPage]=useState(0);
 useEffect(()=>{const sync=(event:Event)=>{const chosen=(event as CustomEvent<string>).detail;if(chosen==='Bamburi'||chosen==='Nyali')setArea(chosen)};try{const stored=window.localStorage.getItem('jitap:area');if(stored==='Bamburi'||stored==='Nyali')setArea(stored);}catch{}window.addEventListener('jitap:area',sync);return()=>window.removeEventListener('jitap:area',sync)},[]);

 function openRequest(query:string,category?:string){
   const text=query.trim();
   if(!text) return;
   const slug=category || inferService(text) || 'other-services';
   track('service_search_submitted',{query:text,area,category:slug,source:'homepage'});
   router.push('/request?category='+encodeURIComponent(slug)+'&description='+encodeURIComponent(text)+'&area='+encodeURIComponent(area));
 }
 function submitSearch(event:FormEvent<HTMLFormElement>){event.preventDefault();openRequest(description)}
 return <div className="ref-home">
   <section className="ref-hero" aria-labelledby="ref-hero-title">
     <div className="ref-coastal-wash" aria-hidden="true"/>
     <div className="container ref-hero-grid">
       <div className="ref-hero-copy">
         <span className="ref-eyebrow"><span className="ref-dot"/> LOCAL HELP, MADE SIMPLE — MOMBASA PILOT</span>
         <h1 id="ref-hero-title">Find local help<br/>in <span>Mombasa.</span><i className="ref-green-stroke" aria-hidden="true"/></h1>
         <p>From plumbing and electrical work to cleaning and home repairs, tell JiTap what you need and take the next step towards local help.</p>
         <div className="ref-tagline">ASK <b>•</b> MATCH <b>•</b> BUZZ</div>
         <form className="ref-search" onSubmit={submitSearch} role="search" aria-label="Find help on JiTap">
           <label className="ref-search-field"><Search size={21} aria-hidden="true"/><input required placeholder="What do you need help with?" aria-label="Describe what you need help with" value={description} onChange={e=>setDescription(e.target.value)}/></label>
           <label className="ref-search-location"><MapPin size={18} aria-hidden="true"/><select aria-label="Your service area" value={area} onChange={e=>setArea(e.target.value)}>{areas.map(a=><option key={a}>{a}</option>)}</select></label>
           <button className="ref-find-button" type="submit">Find Help <ArrowRight size={17}/></button>
         </form>
         <div className="ref-popular-chips"><span>Popular:</span>
           <button onClick={()=>openRequest('My sink is leaking','plumbing')}>Plumbing</button>
           <button onClick={()=>openRequest('I need help with an electrical problem','electrical')}>Electrical</button>
           <button onClick={()=>openRequest('I need my house cleaned','cleaning')}>House Cleaning</button>
           <button onClick={()=>openRequest('I need help mounting a TV','general-repairs')}>TV Mounting</button>
           <button onClick={()=>openRequest('I need a wall painted','painting')}>Painting</button>
         </div>
       </div>
       <div className="ref-hero-picture" role="img" aria-label="JiTap mascot with an illustrated Mombasa fundi against a coastal neighbourhood backdrop">
         <div className="ref-hero-person"><img className="ref-artisan-photo" src={photoUrl(asset.carpentry,1150)} alt="Illustrative photo of an African carpenter working in his workshop" fetchPriority="high"/><img className="ref-mascot-front" src="/images/mascot.webp" alt="JiTap's waving robot mascot" fetchPriority="high"/></div>
         <div className="ref-hero-local-badge"><span className="ref-signal">◎</span><span><strong>Local skills.</strong><small>Real people, close to home.</small></span></div>
         <div className="ref-hero-coverage"><MapPin size={16}/><span>Bamburi & Nyali pilot</span></div>
       </div>
     </div>
     <div className="ref-wave" aria-hidden="true"/>
   </section>

   <section className="container ref-section ref-categories" aria-labelledby="ref-categories-title">
     <div className="ref-heading"><div><span className="ref-eyebrow"><span className="ref-dot"/> EVERYDAY SERVICES</span><h2 id="ref-categories-title">What do you need help with?</h2></div><Link href="/services" className="ref-all-link">View all services <ArrowRight size={16}/></Link></div>
     <div className="ref-category-grid">
       {services.map((service,index)=><Link key={service.slug} href={'/services/'+service.slug} className="ref-category-card">
         <div className="ref-category-photo"><img src={photoUrl(service.photo,850)} srcSet={photoUrl(service.photo,450,82)+' 450w, '+photoUrl(service.photo,850,85)+' 850w'} sizes="(max-width:600px) 50vw, (max-width:1000px) 25vw, 13vw" loading="lazy" decoding="async" alt={service.name+' service illustration'}/><span className="ref-category-icon"><service.icon size={20}/></span></div>
         <div className="ref-category-info"><strong>{service.name}</strong><p>{service.detail}</p></div>
       </Link>)}
     </div>
   </section>

   <section className="container ref-section ref-tasks" aria-labelledby="ref-tasks-title">
     <div className="ref-heading"><div><span className="ref-eyebrow"><span className="ref-dot"/> SERVICES IN MOMBASA</span><h2 id="ref-tasks-title">Popular service requests</h2></div>
       <div className="ref-carousel-controls"><button aria-label="Previous service cards" disabled={taskPage===0} onClick={()=>setTaskPage(n=>Math.max(0,n-1))}><ChevronLeft size={18}/></button><button aria-label="Next service cards" disabled={taskPage>=tasks.length-6} onClick={()=>setTaskPage(n=>Math.min(tasks.length-6,n+1))}><ChevronRight size={18}/></button></div>
     </div>
     <div className="ref-task-grid">
       {tasks.slice(taskPage,taskPage+6).map(task=>{const index=tasks.indexOf(task);return <button className="ref-task-card" type="button" key={task.title} onClick={()=>openRequest(task.prompt,task.slug)}>
         <span className="ref-task-photo"><img src={photoUrl(task.photo,1050)} srcSet={photoUrl(task.photo,550,80)+' 550w, '+photoUrl(task.photo,1050,85)+' 1050w'} sizes="(max-width:600px) 50vw, (max-width:1000px) 33vw, 18vw" loading="lazy" decoding="async" alt={task.title+' service illustration'}/></span>
         <span className="ref-task-caption"><span><strong>{task.title}</strong><small>Describe your job for a quote</small></span><ArrowUpRight size={17}/></span>
       </button>})}
     </div>
     <p className="ref-caveat">Illustrative service photographs; people pictured are not presented as JiTap-verified providers. Actual service availability and quotes depend on provider responses. No confirmed bookings or prices are implied.</p>
   </section>

   <section className="ref-process" aria-labelledby="ref-process-title"><div className="container ref-process-layout">
     <div className="ref-process-header"><span className="ref-eyebrow"><span className="ref-dot"/> HOW JITAP WORKS</span><h2 id="ref-process-title">Get help in<br/>3 simple steps.</h2></div>
     <div className="ref-process-steps">{steps.map((step,index)=><div key={step.label} className="ref-process-step">
       <span className={'ref-step-number ref-step-'+index}>{index+1}</span><step.icon size={28}/><div><strong>{step.label}</strong><p>{step.copy}</p></div>{index<2&&<ArrowRight className="ref-step-arrow" size={16}/>}
     </div>)}</div>
     <img src="/images/mascot.webp" className="ref-process-mascot" alt="" loading="lazy"/>
   </div></section>

   <section className="container ref-community" aria-labelledby="ref-community-title">
     <div className="ref-community-heading"><span className="ref-eyebrow"><span className="ref-dot"/> BUILT FOR MOMBASA</span><h2 id="ref-community-title">Local skills. Stronger neighbourhoods.</h2><p>JiTap is building alongside the community, beginning in Bamburi and Nyali.</p></div>
     <div className="ref-community-cards">
       <div><HeartHandshake size={23}/><h3>People first</h3><p>Local providers deserve an easier way to make their skills discoverable.</p></div>
       <div><Clock3 size={23}/><h3>Less chasing referrals</h3><p>Explain your service problem once, clearly, in everyday language.</p></div>
       <div><ShieldCheck size={23}/><h3>Transparent progress</h3><p>A submitted request is not a booking until a provider connection is confirmed.</p></div>
     </div>
   </section>

   <section className="ref-provider-callout" aria-labelledby="ref-provider-title"><div className="container ref-provider-layout">
     <div className="ref-provider-portrait"><img src={photoUrl(asset.carpentry,640)} alt="Illustrative portrait of an African carpenter at work" loading="lazy" decoding="async"/></div>
     <div className="ref-provider-copy"><h2 id="ref-provider-title">Are you a skilled fundi or service provider?</h2><p>Join JiTap and connect your professional skills with service requests as we grow our local Mombasa network.</p></div>
     <Link className="ref-provider-button" href="/providers/apply">Become a Provider <ArrowRight size={17}/></Link>
   </div></section>
   <Link className="jh-help-widget" href="/contact" aria-label="Contact JiTap support">Need help? <ArrowRight size={16}/></Link>
 </div>;
}
