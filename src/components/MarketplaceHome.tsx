'use client';
import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Search,MapPin,ArrowRight,ArrowUpRight,ChevronDown,ShieldCheck,UsersRound,Wrench,Droplets,Zap,Sparkles,PaintRoller,Hammer,Refrigerator,MonitorPlay,MoreHorizontal,MessageCircleMore,CheckCircle2,Clock3} from 'lucide-react';
import {areas,inferService} from '@/lib/data';
import {fundiListings} from '@/lib/fundis-public';
import {track} from '@/lib/analytics';

const root='/images/approved/';
const categories=[
 {name:'Plumbing',slug:'plumbing',detail:'Leaks, taps, pipes & drainage',img:'plumbing.png',icon:Droplets},
 {name:'Electrical',slug:'electrical',detail:'Wiring, sockets & lighting',img:'electrical.png',icon:Zap},
 {name:'House cleaning',slug:'cleaning',detail:'Homes, offices & Airbnb',img:'cleaning.png',icon:Sparkles},
 {name:'Painting',slug:'painting',detail:'Walls, rooms & finishes',img:'painting.png',icon:PaintRoller},
 {name:'Carpentry',slug:'carpentry',detail:'Furniture, doors & cabinets',img:'carpentry.png',icon:Hammer},
 {name:'Appliance repair',slug:'appliance-repair',detail:'Fridges, washers & appliances',img:'appliance.png',icon:Refrigerator},
 {name:'TV mounting',slug:'general-repairs',detail:'TVs, shelves & home repairs',img:'tv-mounting.png',icon:MonitorPlay},
 {name:'Other services',slug:'other-services',detail:'Tell JiTap what you need',img:'hero-coast.png',icon:MoreHorizontal}
] as const;
const popular=[
 {title:'Tap & leak repairs',slug:'plumbing',desc:'Fundi wa plumbing',img:'plumbing.png',query:'My tap is leaking and I need a plumber'},
 {title:'Electrical repairs',slug:'electrical',desc:'Fundi wa stima',img:'electrical.png',query:'I need an electrician for a faulty socket'},
 {title:'House cleaning',slug:'cleaning',desc:'Home & Airbnb cleaning',img:'cleaning.png',query:'I need a cleaner for my house'},
 {title:'TV mounting',slug:'general-repairs',desc:'Wall mounting & fittings',img:'tv-mounting.png',query:'I need someone to mount my TV'},
 {title:'Furniture & woodwork',slug:'carpentry',desc:'Fundi wa mbao',img:'carpentry.png',query:'I need a carpenter to assemble furniture'},
 {title:'Interior painting',slug:'painting',desc:'Painters & finishing',img:'painting.png',query:'I need a painter for my room'}
] as const;
const featuredIds=['fund-024','fund-017','fund-026','fund-036'];
export function MarketplaceHome(){
 const router=useRouter();
 const [description,setDescription]=useState('');
 const [area,setArea]=useState('Bamburi');
 useEffect(()=>{try{const stored=localStorage.getItem('jitap:area');if(stored&&areas.includes(stored))setArea(stored)}catch{}const update=(ev:Event)=>{const selected=(ev as CustomEvent<string>).detail;if(areas.includes(selected))setArea(selected)};window.addEventListener('jitap:area',update);return()=>window.removeEventListener('jitap:area',update)},[]);
 function search(event:FormEvent<HTMLFormElement>){event.preventDefault();go(description)}
 function go(text:string,slug?:string){
  const words=text.trim();if(!words)return;
  const category=slug||inferService(words)||'other-services';
  track('service_search_submitted',{area,category,source:'home',query:words});
  try{localStorage.setItem('jitap:area',area)}catch{}
  router.push('/request?category='+encodeURIComponent(category)+'&area='+encodeURIComponent(area)+'&description='+encodeURIComponent(words));
 }
 return <div className="th-site">
   <section className="th-hero" aria-labelledby="th-hero-title">
     <img className="th-hero-background" src={root+'hero-coast.png'} alt="" fetchPriority="high"/>
     <div className="th-hero-overlay" aria-hidden="true"/>
     <div className="container th-hero-inner">
       <div className="th-hero-content">
         <div className="th-hero-kicker"><span className="th-live-dot"/> MOMBASA'S LOCAL SKILLS NETWORK</div>
         <h1 id="th-hero-title">Every job needs<br/>the right <em>fundi.</em></h1>
         <p>Tap in to local skills for repairs, cleaning, installations and everything that keeps your home running. Just tell JiTap what needs doing.</p>
         <form className="th-search" onSubmit={search} role="search" aria-label="Find a local fundi">
           <label className="th-task-input"><Search size={24} aria-hidden="true"/><textarea aria-label="Describe your project or problem" placeholder="Describe your project or problem — e.g. my sink is leaking..." rows={2} maxLength={1500} value={description} onChange={e=>setDescription(e.target.value)} required/></label>
           <div className="th-search-controls"><label className="th-local-input"><MapPin size={19} aria-hidden="true"/><select aria-label="Where do you need a fundi?" value={area} onChange={e=>setArea(e.target.value)}>{areas.map(x=><option key={x}>{x}</option>)}</select></label><button type="submit" className="th-find-button">Find a fundi <ArrowRight size={19}/></button></div>
         </form>
         <p className="th-privacy-note"><ShieldCheck size={17}/> Your contact details are never displayed publicly. JiTap will review the service request before an introduction.</p>
         <div className="th-hero-facts"><div><strong>{fundiListings.length}</strong><span>onboarding profiles</span></div><div><strong>{areas.length}</strong><span>request areas</span></div><div><strong>ASK • MATCH • BUZZ</strong><span>the JiTap way</span></div></div>
         <div className="th-hero-chips"><span>Popular:</span><button onClick={()=>go('My tap is leaking','plumbing')}>Leaking tap</button><button onClick={()=>go('I need a fundi wa stima','electrical')}>Fundi wa stima</button><button onClick={()=>go('I need someone to clean my house','cleaning')}>House cleaning</button></div>
       </div>
       <div className="th-hero-visual"><img src={root+'mascot-original.png'} alt="JiTap waving mascot" loading="eager" fetchPriority="high"/><span className="th-mascot-note">JiTap's here to help <span>✦</span></span></div>
     </div>
     <a href="#th-services" className="th-scroll" aria-label="Explore services below"><ChevronDown size={24}/></a>
   </section>
   <section className="container th-section" id="th-services" aria-labelledby="th-services-heading">
     <div className="th-section-heading"><div><span className="th-overline">FIND YOUR FUNDIS</span><h2 id="th-services-heading">What needs fixing or sorting?</h2><p>Pick a service, or simply describe the problem in your own words.</p></div><Link href="/services" className="th-plain-link">Explore all services <ArrowUpRight size={18}/></Link></div>
     <div className="th-categories">{categories.map(c=><Link key={c.slug} href={'/services/'+c.slug} className="th-category"><div className="th-category-photo"><img src={root+c.img} alt={c.name+' illustration'} loading="lazy"/><span className="th-cat-icon"><c.icon size={20}/></span></div><div className="th-category-text"><strong>{c.name}</strong><small>{c.detail}</small></div></Link>)}</div>
   </section>
   <section className="th-popular"><div className="container th-section"><div className="th-section-heading"><div><span className="th-overline">EVERYDAY JOBS</span><h2>Popular projects around Mombasa</h2><p>From Bamburi to Likoni, explain the job first. A quote or booking is never assumed.</p></div><Link href="/request" className="th-plain-link">Describe your job <ArrowUpRight size={18}/></Link></div><div className="th-popular-grid">{popular.map(p=><button className="th-project" key={p.title} onClick={()=>go(p.query,p.slug)}><img src={root+p.img} alt={p.title+' service example'} loading="lazy"/><div className="th-project-caption"><span><strong>{p.title}</strong><small>{p.desc}</small></span><ArrowUpRight size={19}/></div></button>)}</div><p className="th-media-note">Photography illustrates service categories; featured people are not represented as verified JiTap providers.</p></div></section>
   <section className="container th-section th-fundi-section" aria-labelledby="th-fundis-title"><div className="th-section-heading"><div><span className="th-overline">REAL ONBOARDING RECORDS</span><h2 id="th-fundis-title">Fundis and service businesses in the network</h2><p>Meet some of the professionals who have shared their skills with JiTap. All public contact details are withheld.</p></div><Link href="/fundis" className="th-plain-link">Browse all {fundiListings.length} profiles <ArrowUpRight size={18}/></Link></div><div className="th-featured-fundis">{featuredIds.map((id,i)=>{const f=fundiListings.find(x=>x.id===id)!;return <article key={f.id} className="th-fundi-mini"><span className={'th-fundi-initial th-fundi-initial-'+i}>{f.name.slice(0,2).toUpperCase()}</span><div><span className="th-fundi-status">Onboarding profile</span><h3>{f.name}</h3><p>{f.categories.join(' · ')}</p><small><MapPin size={14}/>{f.areas.join(' · ')}</small></div><Link href="/fundis" aria-label={'Browse profiles including '+f.name}><ArrowRight size={18}/></Link></article>})}</div><div className="th-directory-disclaimer">Profiles are based on provider submissions. JiTap does not yet display verified ratings, live availability, guarantees or confirmed job prices.</div></section>
   <section className="th-process"><div className="container"><div className="th-section-heading"><div><span className="th-overline">HOW JITAP WORKS</span><h2>ASK. MATCH. BUZZ.</h2><p>A straightforward starting point when you need a fundi in Mombasa.</p></div></div><div className="th-process-grid"><div><span className="th-process-number">01</span><MessageCircleMore size={34}/><h3>ASK</h3><p>Describe what needs fixing, cleaning or installing. Kiswahili, English or Sheng—tell it how you would to a friend.</p></div><div><span className="th-process-number">02</span><UsersRound size={34}/><h3>MATCH</h3><p>JiTap structures your request and checks the relevant service and area. A submitted request does not guarantee a match.</p></div><div><span className="th-process-number">03</span><CheckCircle2 size={34}/><h3>BUZZ</h3><p>As live matching becomes available, a suitable fundi can respond and coordinate the work. Until then, we review enquiries manually.</p></div></div></div></section>
   <section className="th-become"><div className="container th-become-inner"><img src={root+'carpentry.png'} alt="Local carpentry skill illustration" loading="lazy"/><div><span className="th-overline">WE SEE YOUR SKILLS</span><h2>Wewe ni fundi? Get seen on JiTap.</h2><p>Join the growing list of local service professionals. Show us your skills and the areas you can serve.</p></div><Link href="/providers/apply" className="th-become-cta">Become a Provider <ArrowRight size={18}/></Link></div></section>
 </div>;
}
