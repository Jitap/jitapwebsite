'use client';

import {useState, type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {
 ArrowRight, ArrowUpRight, CheckCheck, ChevronLeft, ChevronRight,
 Clock3, Droplets, Hammer, House, Laptop, MapPin, MessageCircle,
 PaintRoller, Search, ShieldCheck, Sparkles, UsersRound, WashingMachine,
 Wrench, Zap
} from 'lucide-react';
import {areas,inferService} from '@/lib/data';
import {track} from '@/lib/analytics';

const photo=(id:number,w=600)=>'https://images.pexels.com/photos/'+id+'/pexels-photo-'+id+'.jpeg?auto=compress&cs=tinysrgb&w='+w;
const services=[
 {slug:'plumbing',title:'Plumbing',desc:'Leaks, taps & pipes',icon:Droplets,photo:photo(16509869)},
 {slug:'electrical',title:'Electrical',desc:'Sockets, lights & wiring',icon:Zap,photo:photo(5691590)},
 {slug:'cleaning',title:'Cleaning',desc:'Home & workspace',icon:Sparkles,photo:photo(9462746)},
 {slug:'painting',title:'Painting',desc:'Walls & finishing',icon:PaintRoller,photo:photo(7218579)},
 {slug:'carpentry',title:'Carpentry',desc:'Furniture & doors',icon:Hammer,photo:photo(6790817)},
 {slug:'appliance-repair',title:'Appliance repair',desc:'Fridges, washers & more',icon:WashingMachine,photo:photo(34734504)},
 {slug:'general-repairs',title:'General repairs',desc:'Everyday fixes',icon:Wrench,photo:photo(3855334)},
 {slug:'other-services',title:'Other services',desc:'Tell us your need',icon:Laptop,photo:photo(33531806)}
] as const;
const popular=[
 {slug:'carpentry',title:'Furniture assembly',detail:'Beds, cabinets & flat-pack items',photo:photo(6790817,850),query:'I need help assembling furniture'},
 {slug:'general-repairs',title:'TV & shelf mounting',detail:'Safe installation at home',photo:photo(3855334,850),query:'I need help mounting a television'},
 {slug:'plumbing',title:'Tap & leak repairs',detail:'Sinks, taps & water leaks',photo:photo(16509869,850),query:'My kitchen tap is leaking'},
 {slug:'electrical',title:'Electrical installations',detail:'Sockets, lighting & faults',photo:photo(5691590,850),query:'I need an electrician for a faulty socket'},
 {slug:'cleaning',title:'House cleaning',detail:'Keep your space feeling fresh',photo:photo(9462746,850),query:'I need a house cleaning service'},
 {slug:'painting',title:'Interior painting',detail:'A fresh finish for your room',photo:photo(7218579,850),query:'I need a painter for my interior walls'}
] as const;
const steps=[
 {name:'ASK',detail:'Tell us what you need, in your own words.',icon:MessageCircle},
 {name:'MATCH',detail:'JiTap checks the service category and pilot coverage.',icon:UsersRound},
 {name:'BUZZ',detail:'Eligible providers can respond when matching is active.',icon:CheckCheck}
] as const;

export function MarketplaceHome(){
 const router=useRouter();
 const [query,setQuery]=useState('');
 const [area,setArea]=useState('Bamburi');
 const [currentPage,setCurrentPage]=useState(0);
 function go(description:string,category?:string){
   const text=description.trim();
   if(!text)return;
   const slug=category||inferService(text)||'other-services';
   track('service_search_submitted',{query:text,area,category:slug});
   router.push('/request?category='+encodeURIComponent(slug)+'&description='+encodeURIComponent(text)+'&area='+encodeURIComponent(area));
 }
 function search(e:FormEvent<HTMLFormElement>){e.preventDefault();go(query)}
 return <div className="jhome">
   <section className="jh-hero" aria-labelledby="jh-hero-title">
     <div className="jh-hero-bg" aria-hidden="true"/>
     <div className="container jh-hero-inner">
       <div className="jh-hero-content">
         <span className="jh-kicker"><span className="jh-dot"/> LOCAL HELP, MADE SIMPLE — MOMBASA PILOT</span>
         <h1 id="jh-hero-title">Find local help<br/>in <span>Mombasa.</span></h1>
         <p className="jh-intro-copy">From a leaking tap to a room that needs a fresh coat, JiTap makes it easier to describe what you need and connect with local service opportunities.</p>
         <div className="jh-hero-tagline">ASK <b>•</b> MATCH <b>•</b> BUZZ</div>
         <form className="jh-search" onSubmit={search} role="search" aria-label="Find a local service">
           <label className="jh-search-task"><Search size={23} aria-hidden="true"/><input aria-label="Describe the service you need" required placeholder="What do you need help with?" value={query} onChange={e=>setQuery(e.target.value)}/></label>
           <label className="jh-search-area"><MapPin size={19} aria-hidden="true"/><select value={area} onChange={e=>setArea(e.target.value)} aria-label="Select service area">{areas.map(a=><option value={a} key={a}>{a}</option>)}</select></label>
           <button className="jh-search-submit" type="submit">Find help <ArrowRight size={19}/></button>
         </form>
         <div className="jh-quick"><strong>Popular requests:</strong>{[{text:'Plumbing',slug:'plumbing',query:'My tap needs repair'},{text:'Electrical',slug:'electrical',query:'I need an electrician'},{text:'House cleaning',slug:'cleaning',query:'I need house cleaning'},{text:'TV mounting',slug:'general-repairs',query:'Help me mount a TV'},{text:'Painting',slug:'painting',query:'I need interior painting'}].map(x=><button type="button" key={x.text} onClick={()=>go(x.query,x.slug)}>{x.text}</button>)}</div>
       </div>
       <div className="jh-hero-scene" aria-label="JiTap mascot with an illustration of local service work">
         <div className="jh-halo" aria-hidden="true"/>
         <div className="jh-pro-photo"><img src={photo(4173284,850)} alt="Illustrative photograph of a skilled artisan at work" loading="eager"/></div>
         <img className="jh-mascot" src="/images/mascot.webp" alt="JiTap friendly waving robot mascot" fetchPriority="high"/>
         <div className="jh-float jh-float-a"><span className="jh-floating-symbol">✦</span><span><strong>Local skills.</strong><small>Closer to home.</small></span></div>
         <div className="jh-float jh-float-b"><span className="jh-floating-symbol green"><MapPin size={16}/></span><span><strong>Bamburi & Nyali</strong><small>Initial pilot areas</small></span></div>
       </div>
     </div>
     <div className="jh-wave" aria-hidden="true"/>
   </section>

   <section className="container jh-section jh-categories" aria-labelledby="jh-cat-title">
     <div className="jh-section-heading">
       <div><span className="jh-kicker"><span className="jh-dot"/> EVERYDAY SERVICES</span><h2 id="jh-cat-title">What do you need help with?</h2></div>
       <Link href="/services" className="jh-view-all">View all services <ArrowRight size={18}/></Link>
     </div>
     <div className="jh-categories-grid">{services.map(s=><Link href={'/services/'+s.slug} className="jh-category-card" key={s.slug}><div className="jh-category-image"><img src={s.photo} alt="" loading="lazy"/><span className="jh-category-icon"><s.icon size={22}/></span></div><div className="jh-category-body"><strong>{s.title}</strong><small>{s.desc}</small></div></Link>)}</div>
   </section>

   <section className="jh-section jh-project-section" aria-labelledby="jh-popular-title"><div className="container">
     <div className="jh-section-heading"><div><span className="jh-kicker"><span className="jh-dot"/> COMMON LOCAL TASKS</span><h2 id="jh-popular-title">Services to make life easier.</h2></div><div className="jh-carousel-controls" aria-label="Browse service cards"><button onClick={()=>setCurrentPage(0)} disabled={currentPage===0} aria-label="Previous services"><ChevronLeft size={19}/></button><button onClick={()=>setCurrentPage(1)} disabled={currentPage===1} aria-label="Next services"><ChevronRight size={19}/></button></div></div>
     <div className="jh-project-grid">{popular.slice(currentPage===0?0:3,currentPage===0?3:6).map(p=><button className="jh-project-card" type="button" key={p.title} onClick={()=>go(p.query,p.slug)}><div className="jh-project-image"><img src={p.photo} alt="" loading="lazy"/></div><div className="jh-project-info"><div><strong>{p.title}</strong><small>{p.detail}</small></div><ArrowUpRight size={21}/></div></button>)}</div>
     <p className="jh-caption">Illustrative service photography. Provider availability, qualifications, job quotes and pricing are confirmed individually as the JiTap pilot develops.</p>
   </div></section>

   <section className="jh-steps-band" aria-labelledby="jh-how-title"><div className="container jh-steps-inner">
     <div className="jh-steps-title"><span className="jh-kicker"><span className="jh-dot"/> HOW JITAP WORKS</span><h2 id="jh-how-title">Get help in<br/>3 simple steps.</h2></div>
     <div className="jh-steps-list">{steps.map((s,i)=><div className="jh-step" key={s.name}><span className="jh-step-count">{i+1}</span><s.icon className="jh-step-icon" size={31} strokeWidth={1.8}/><div><strong>{s.name}</strong><p>{s.detail}</p></div>{i<2&&<ArrowRight size={19} className="jh-step-arrow" aria-hidden="true"/>}</div>)}</div>
     <img className="jh-steps-mascot" src="/images/mascot.webp" alt="" loading="lazy"/>
   </div></section>

   <section className="container jh-community" aria-labelledby="jh-community-title">
     <div className="jh-section-heading"><div><span className="jh-kicker"><span className="jh-dot"/> ROOTED IN MOMBASA</span><h2 id="jh-community-title">Neighbourhoods built on skills.</h2><p>JiTap is developing a local service network where community knowledge meets easier discovery.</p></div></div>
     <div className="jh-community-grid">
       <div className="jh-community-tile"><span className="jh-community-icon"><House size={25}/></span><h3>Help starts nearby</h3><p>Beginning with Bamburi and Nyali, so requests stay grounded in real neighbourhood coverage.</p></div>
       <div className="jh-community-tile"><span className="jh-community-icon"><ShieldCheck size={25}/></span><h3>Clearer next steps</h3><p>Understand what has been requested, what is being reviewed, and when a connection is confirmed.</p></div>
       <div className="jh-community-tile"><span className="jh-community-icon"><Clock3 size={25}/></span><h3>Your time matters</h3><p>Describe a job once instead of repeating the same explanation across scattered contacts.</p></div>
     </div>
   </section>

   <section className="jh-provider-banner" aria-labelledby="jh-provider-title"><div className="container jh-provider-inner">
     <div className="jh-provider-picture"><img src={photo(4173284,650)} alt="Illustrative photograph of a local artisan" loading="lazy"/></div>
     <div className="jh-provider-content"><span className="jh-kicker"><span className="jh-dot"/> FOR OUR LOCAL FUNDIS</span><h2 id="jh-provider-title">Are you a skilled fundi or service provider?</h2><p>Introduce your skills, choose your service areas, and apply to join JiTap's growing Mombasa provider network.</p></div>
     <Link className="jh-provider-button" href="/providers/apply">Become a Provider <ArrowRight size={18}/></Link>
   </div></section>
 </div>;
}
