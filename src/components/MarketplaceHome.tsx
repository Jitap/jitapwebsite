'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {MapPin,ArrowRight,ArrowUpRight,ChevronDown,ShieldCheck,UsersRound,Wrench,Droplets,Zap,Sparkles,PaintRoller,Hammer,Refrigerator,MonitorPlay,MoreHorizontal,MessageCircleMore,CheckCircle2,Clock3} from 'lucide-react';
import {areas,inferService} from '@/lib/data';
import {fundiListings} from '@/lib/fundis-public';
import {track} from '@/lib/analytics';
import {HowJiTapWorks} from '@/components/HowJiTapWorks';

const root='/images/approved/';
const categories=[
 {name:'Plumbing',slug:'plumbing',detail:'Pipes, sinks, taps & drainage',img:'plumbing.png',icon:Droplets},
 {name:'Electrical',slug:'electrical',detail:'Wiring, sockets & lighting',img:'electrical.png',icon:Zap},
 {name:'Carpentry & Doors',slug:'carpentry',detail:'Doors, furniture & cabinets',img:'carpentry.png',icon:Hammer},
 {name:'Roofing & Gutters',slug:'roofing',detail:'Roof leaks, sheets & gutters',img:'/images/categories/Focused%20Roofer%20Installing%20Brown%20Gutter.png',icon:Hammer},
 {name:'Masonry & Construction',slug:'masonry',detail:'Brickwork, concrete & plaster',img:'/images/categories/Bricklayer%20at%20Work%20on%20a%20Busy%20Construction%20Site.png',icon:Hammer},
 {name:'Welding & Metalwork',slug:'welding',detail:'Gates, grills & metal fabrication',img:'/images/categories/Master%20Welder%20at%20Work.png',icon:Wrench},
 {name:'Tiling & Flooring',slug:'tiling',detail:'Wall tiles, floors & grouting',img:'/images/categories/Tile%20Installer%20at%20Work.png',icon:Hammer},
 {name:'Painting',slug:'painting',detail:'Walls, rooms & finishes',img:'painting.png',icon:PaintRoller},
 {name:'Appliance Repair',slug:'appliance-repair',detail:'Fridges, washers & appliances',img:'appliance.png',icon:Refrigerator},
 {name:'AC & Refrigeration',slug:'air-conditioning',detail:'Cooling repairs & installation',img:'/images/categories/Kenyan%20HVAC%20Technician%20Servicing%20Air%20Conditioner.png',icon:Refrigerator},
 {name:'Solar, CCTV & Security',slug:'solar-security',detail:'Solar, CCTV & electric fences',img:'/images/categories/CCTV%20Installation%20and%20Solar%20Rooftop%20Team.png',icon:Zap},
 {name:'Computer & Phone Repair',slug:'it-repairs',detail:'Laptops, printers, phones & IT',img:'/images/categories/JiTap%20Tech%20Repair%20Workshop.png',icon:Wrench},
 {name:'Vehicle & Motorcycle Repair',slug:'vehicle-repair',detail:'Mechanics, brakes & engines',img:'/images/categories/Kenyan%20Mechanic%20Servicing%20Motorcycle.png',icon:Wrench},
 {name:'Glass & Aluminium',slug:'glass-aluminium',detail:'Windows, panes & frames',img:'/images/categories/Precision%20Glass%20Installation%20Team.png',icon:Hammer},
 {name:'Handyman & Mounting',slug:'general-repairs',detail:'TVs, fixtures & small repairs',img:'tv-mounting.png',icon:MonitorPlay},
 {name:'Gardening & Landscaping',slug:'landscaping',detail:'Outdoor upkeep & gardening',img:'/images/categories/Kenyan%20Gardener%20Trimming%20a%20Lush%20Hedge.png',icon:Wrench},
 {name:'Pest Control',slug:'pest-control',detail:'Termites & property treatments',img:'/images/categories/Pest%20Control%20Technician%20Fogging%20Interior%20Corridor.png',icon:ShieldCheck},
 {name:'House Cleaning',slug:'cleaning',detail:'Mama Fua, laundry & cleaning',img:'cleaning.png',icon:Sparkles},
 {name:'Moving & Relocation',slug:'moving',detail:'Furniture and house moving',img:'/images/categories/Friendly%20Kenyan%20Moving%20Team.png',icon:Wrench},
 {name:'Other Services',slug:'other-services',detail:'Describe the service you need',img:'/images/categories/Other%20Services%20Friendly%20Handyman%20with%20Tool-Filled%20Toolbox.png',icon:MoreHorizontal}
] as const;
const popular=[
 {title:'Tap & leak repairs',slug:'plumbing',desc:'Fundi wa plumbing',img:'plumbing.png',query:'My tap is leaking and I need a plumber'},
 {title:'Electrical repairs',slug:'electrical',desc:'Fundi wa stima',img:'electrical.png',query:'I need an electrician for a faulty socket'},
 {title:'Mama Fua · House cleaning',slug:'cleaning',desc:'Cleaning, laundry & ironing',img:'cleaning.png',query:'I need a Mama Fua for cleaning and laundry'},
 {title:'TV mounting',slug:'general-repairs',desc:'Wall mounting & fittings',img:'tv-mounting.png',query:'I need someone to mount my TV'},
 {title:'Furniture & woodwork',slug:'carpentry',desc:'Fundi wa mbao',img:'carpentry.png',query:'I need a carpenter to assemble furniture'},
 {title:'Interior painting',slug:'painting',desc:'Painters & finishing',img:'painting.png',query:'I need a painter for my room'}
] as const;
const featuredSlugs=['cleaning','moving','plumbing','electrical'];
const featuredIds=['fund-024','fund-017','fund-026','fund-036'];
export function MarketplaceHome(){
 const router=useRouter();
 const [description,setDescription]=useState('');
 const heroSearchRef=useRef<HTMLFormElement>(null);
 const [showStickySearch,setShowStickySearch]=useState(false);
 const [area,setArea]=useState('Bamburi');
 useEffect(()=>{try{const stored=localStorage.getItem('jitap:area');if(stored&&areas.includes(stored))setArea(stored)}catch{}const update=(ev:Event)=>{const selected=(ev as CustomEvent<string>).detail;if(areas.includes(selected))setArea(selected)};window.addEventListener('jitap:area',update);return()=>window.removeEventListener('jitap:area',update)},[]);
 useEffect(()=>{const element=heroSearchRef.current;if(!element||!('IntersectionObserver' in window))return;const observer=new IntersectionObserver(([entry])=>setShowStickySearch(!entry.isIntersecting&&entry.boundingClientRect.top<0),{threshold:0});observer.observe(element);return()=>observer.disconnect()},[]);
 function search(event:FormEvent<HTMLFormElement>){event.preventDefault();go(description)}
 function go(text:string,slug?:string){
  const words=text.trim();if(!words)return;
  const category=slug||inferService(words)||'other-services';
  track('service_search_submitted',{area,category,source:'home',query:words});
  try{localStorage.setItem('jitap:area',area)}catch{}
  router.push('/request?category='+encodeURIComponent(category)+'&area='+encodeURIComponent(area)+'&description='+encodeURIComponent(words));
 }
 return <div className="th-site">
   <div className={'th-sticky-search'+(showStickySearch?' th-sticky-search-visible':'')} aria-hidden={!showStickySearch}>
     <form className="th-sticky-search-inner th-animated-border" onSubmit={search} role="search" aria-label="Ask JiTap while browsing">
       <label className="th-sticky-query"><Sparkles size={20} aria-hidden="true"/><input aria-label="Describe your service need" tabIndex={showStickySearch?0:-1} placeholder="How can I help you today..." value={description} onChange={e=>setDescription(e.target.value)} required/></label>
       <label className="th-sticky-area"><MapPin size={17} aria-hidden="true"/><select aria-label="Your service area" tabIndex={showStickySearch?0:-1} value={area} onChange={e=>setArea(e.target.value)}>{areas.map(x=><option key={x}>{x}</option>)}</select></label>
       <button type="submit" tabIndex={showStickySearch?0:-1}>Ask JiTap <ArrowRight size={17}/></button>
     </form>
   </div>
   <section className="th-hero" aria-labelledby="th-hero-title">
     <img className="th-hero-background" src={root+'hero-coast.png'} alt="" fetchPriority="high"/>
     <div className="th-hero-overlay" aria-hidden="true"/>
     <div className="container th-hero-inner">
       <div className="th-hero-content">
         <div className="th-hero-kicker"><span className="th-live-dot"/> MOMBASA'S LOCAL SKILLS NETWORK</div>
         <h1 id="th-hero-title">Every job needs<br/>the right <em>fundi.</em></h1>
         <p>Tap in to local skills for repairs, cleaning, installations and everything that keeps your home running. Just tell JiTap what needs doing.</p>
         <form ref={heroSearchRef} className="th-search th-animated-border" onSubmit={search} role="search" aria-label="Ask JiTap about a local service">
           <label className="th-task-input"><Sparkles size={24} aria-hidden="true"/><textarea aria-label="Describe your project or problem" placeholder="How can I help you today - e.g. my sink is leaking" rows={2} maxLength={1500} value={description} onChange={e=>setDescription(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit()}}} required/></label>
           <div className="th-search-controls"><label className="th-local-input"><MapPin size={19} aria-hidden="true"/><select aria-label="Where do you need a fundi?" value={area} onChange={e=>setArea(e.target.value)}>{areas.map(x=><option key={x}>{x}</option>)}</select></label><button type="submit" className="th-find-button">Ask JiTap <ArrowRight size={19}/></button></div>
         </form>
         <p className="th-privacy-note"><ShieldCheck size={17}/> Your contact details are never displayed publicly. JiTap will review the service request before an introduction.</p>
         <div className="th-hero-facts"><div><strong>300+</strong><span>Households</span></div><div><strong>{areas.length}</strong><span>request areas</span></div><div><strong>ASK • MATCH • BUZZ</strong><span>the JiTap way</span></div></div>
         <div className="th-hero-chips"><span>Popular:</span><button onClick={()=>go('My tap is leaking','plumbing')}>Leaking tap</button><button onClick={()=>go('I need a fundi wa stima','electrical')}>Fundi wa stima</button><button onClick={()=>go('I need a Mama Fua for house cleaning or laundry','cleaning')}>Mama Fua</button></div>
       </div>
       <div className="th-hero-visual"><img src={root+'mascot-original.png'} alt="JiTap waving mascot" loading="eager" fetchPriority="high"/></div>
     </div>
     <a href="#th-services" className="th-scroll" aria-label="Explore services below"><ChevronDown size={24}/></a>
   </section>
   <section className="container th-section" id="th-services" aria-labelledby="th-services-heading">
     <div className="th-section-heading"><div><span className="th-overline">FIND YOUR FUNDIS</span><h2 id="th-services-heading">What needs fixing or sorting?</h2><p>Pick a service, or simply describe the problem in your own words.</p></div><Link href="/services" className="th-plain-link">Explore all services <ArrowUpRight size={18}/></Link></div>
     <div className="th-category-marquee" aria-label="Browse JiTap service categories"><div className="th-category-track">{[0,1].map(copy=><div key={copy} className="th-category-track-group" aria-hidden={copy===1}>{categories.map(c=><Link key={c.slug} href={'/services/'+c.slug} tabIndex={copy===1?-1:undefined} className="th-category-chip"><c.icon size={22} aria-hidden="true"/><span>{c.name}</span></Link>)}</div>)}</div></div>
     <div className="th-categories">{categories.filter(c=>featuredSlugs.includes(c.slug)).map(c=><Link key={c.slug} href={'/services/'+c.slug} className="th-category"><div className="th-category-photo"><img src={c.img.startsWith('https://')||c.img.startsWith('/')?c.img:root+c.img} alt={c.name+' service category'} loading="lazy" decoding="async" onError={e=>{if(!e.currentTarget.src.endsWith('/images/approved/hero-coast.png'))e.currentTarget.src='/images/approved/hero-coast.png'}}/><span className="th-cat-icon"><c.icon size={20}/></span></div><div className="th-category-text"><strong>{c.name}</strong><small>{c.detail}</small></div></Link>)}</div>
     <div className="th-category-all"><Link href="/services" className="th-plain-link">View all {categories.length} services <ArrowUpRight size={18}/></Link></div>
   </section>
   <section className="th-testimonials jt-voices" aria-labelledby="th-testimonials-title"><div className="container th-section">
     <header className="jt-voices-heading"><span className="jt-voices-script"><MessageCircleMore size={25} aria-hidden="true"/> Made for real-life requests</span><h2 id="th-testimonials-title"><span className="jt-voices-spark" aria-hidden="true">★</span>Why customers love JiTap</h2><p>From WhatsApp group searches to asking for local help in one place.</p></header>
     <div className="jt-voices-stack">
       <article className="jt-voice-card jt-voice-card-green">
         <div className="jt-voice-head"><div className="jt-voice-person"><span className="jt-voice-avatar jt-voice-avatar-lime"><MessageCircleMore size={21} aria-hidden="true"/></span><span><strong>From WhatsApp to JiTap</strong><small>LESS SEARCHING</small></span></div><span className="jt-voice-stars" aria-hidden="true">★★★★★</span></div>
         <h3>From “Nani anajua fundi?” to just a tap.</h3><p>Skip the endless group messages. Tell JiTap what you need in your own words, and start a clear service request.</p>
       </article>
       <article className="jt-voice-card jt-voice-card-white">
         <div className="jt-voice-head"><div className="jt-voice-person"><span className="jt-voice-avatar jt-voice-avatar-blue"><MapPin size={21} aria-hidden="true"/></span><span><strong>Local connections</strong><small>YOUR NEIGHBOURHOOD</small></span></div><span className="jt-voice-stars" aria-hidden="true">★★★★★</span></div>
         <h3>Know where your fundi is coming from.</h3><p>Choose your location and explore the neighbourhoods providers serve, making it easier to coordinate relevant local help.</p>
       </article>
       <article className="jt-voice-card jt-voice-card-green">
         <div className="jt-voice-head"><div className="jt-voice-person"><span className="jt-voice-avatar jt-voice-avatar-peach"><Wrench size={21} aria-hidden="true"/></span><span><strong>All your fundis</strong><small>ONE PLACE</small></span></div><span className="jt-voice-stars" aria-hidden="true">★★★★★</span></div>
         <h3>Different fundis. One simple place.</h3><p>Plumber, electrician, cleaner, mover or mechanic—explore different skills without searching for a fresh contact every time.</p>
       </article>
       <article className="jt-voice-card jt-voice-card-white">
         <div className="jt-voice-head"><div className="jt-voice-person"><span className="jt-voice-avatar jt-voice-avatar-violet"><ShieldCheck size={21} aria-hidden="true"/></span><span><strong>Simpler coordination</strong><small>LESS BACK-AND-FORTH</small></span></div><span className="jt-voice-stars" aria-hidden="true">★★★★★</span></div>
         <h3>Explain it once. Keep it simple.</h3><p>JiTap captures the important job details so your enquiry is easier to understand and follow up.</p>
       </article>
     </div>
   </div></section>
   <section className="th-popular"><div className="container th-section"><div className="th-section-heading"><div><span className="th-overline">EVERYDAY JOBS</span><h2>Popular projects around Mombasa</h2><p>From Bamburi to Likoni, explain the job first. A quote or booking is never assumed.</p></div><Link href="/request" className="th-plain-link">Describe your job <ArrowUpRight size={18}/></Link></div><div className="th-popular-grid">{popular.map(p=><button className="th-project" key={p.title} onClick={()=>go(p.query,p.slug)}><img src={root+p.img} alt={p.title+' service example'} loading="lazy"/><div className="th-project-caption"><span><strong>{p.title}</strong><small>{p.desc}</small></span><ArrowUpRight size={19}/></div></button>)}</div></div></section>
   <section className="container th-section th-fundi-section" aria-labelledby="th-fundis-title"><div className="th-section-heading"><div><span className="th-overline">MOMBASA LOCAL SKILL NETWORK</span><h2 id="th-fundis-title">Fundis and service businesses in the network</h2><p>Meet some of the professionals who have shared their skills with JiTap. All public contact details are withheld.</p></div><Link href="/fundis" className="th-plain-link">Browse all profiles <ArrowUpRight size={18}/></Link></div><div className="th-featured-fundis">{featuredIds.map((id,i)=>{const f=fundiListings.find(x=>x.id===id)!;return <article key={f.id} className="th-fundi-mini"><span className={'th-fundi-initial th-fundi-initial-'+i}>{f.name.slice(0,2).toUpperCase()}</span><div><h3>{f.name}</h3><p>{f.categories.join(' · ')}</p><small><MapPin size={14}/>{f.areas.join(' · ')}</small></div><Link href="/fundis" aria-label={'Browse profiles including '+f.name}><ArrowRight size={18}/></Link></article>})}</div><div className="th-directory-disclaimer">Profiles are based on provider submissions. JiTap does not yet display verified ratings, live availability, guarantees or confirmed job prices.</div></section>
   <HowJiTapWorks/>
   <section className="th-become"><div className="container th-become-inner"><img src={root+'carpentry.png'} alt="Local carpentry skill illustration" loading="lazy"/><div><span className="th-overline">WE SEE YOUR SKILLS</span><h2>Wewe ni fundi? Get seen on JiTap.</h2><p>Join the growing list of local service professionals. Show us your skills and the areas you can serve.</p></div><Link href="/providers/apply" className="th-become-cta">Become a Provider <ArrowRight size={18}/></Link></div></section>
 </div>;
}
