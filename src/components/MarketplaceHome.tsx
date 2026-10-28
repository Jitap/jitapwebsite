'use client';
import {useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Search,MapPin,ArrowRight,ArrowUpRight,Droplets,Zap,Sparkles,PaintRoller,Hammer,Refrigerator,Wrench,MoreHorizontal,CheckCircle2,MessageCircleMore,Clock3,ShieldCheck,UsersRound,ChevronRight,House,LifeBuoy,SlidersHorizontal} from 'lucide-react';
import {categories,areas,inferService} from '@/lib/data';
import {track} from '@/lib/analytics';

const chips=[
  {label:'Plumbing',slug:'plumbing',icon:Droplets},
  {label:'Electrical',slug:'electrical',icon:Zap},
  {label:'Cleaning',slug:'cleaning',icon:Sparkles},
  {label:'Painting',slug:'painting',icon:PaintRoller},
  {label:'Carpentry',slug:'carpentry',icon:Hammer},
  {label:'Appliance repair',slug:'appliance-repair',icon:Refrigerator},
  {label:'Home repairs',slug:'general-repairs',icon:Wrench},
  {label:'More',slug:'other-services',icon:MoreHorizontal}
] as const;
const examples:Record<string,string[]>={
  plumbing:['Leaking tap or sink','Blocked drain','Pipe repair','Bathroom fittings'],
  electrical:['Broken socket','Lighting installation','Power fault','Electrical inspection'],
  cleaning:['House cleaning','Move-in cleaning','Deep cleaning','Office cleaning'],
  painting:['Interior walls','Exterior painting','Touch-up work','Surface preparation'],
  carpentry:['Door repairs','Furniture assembly','Cabinet fitting','Woodwork'],
  'appliance-repair':['Fridge repair','Washing machine','Cooker servicing','Diagnosis'],
  'general-repairs':['Home maintenance','Fixture repair','Door handles','Small repairs'],
  'other-services':['Computer & IT help','General assistance','Describe your task','Not sure what category?']
};
const featureCards=[
  {slug:'plumbing',title:'Plumbing help',subtitle:'Leaking taps, sinks & pipes',icon:Droplets,skin:'mint',tag:'Home essentials'},
  {slug:'electrical',title:'Electrical help',subtitle:'Lights, sockets & faults',icon:Zap,skin:'butter',tag:'Home essentials'},
  {slug:'cleaning',title:'Home cleaning',subtitle:'Freshen up your space',icon:Sparkles,skin:'lavender',tag:'Everyday living'},
  {slug:'carpentry',title:'Furniture & carpentry',subtitle:'Doors, cabinets & repairs',icon:Hammer,skin:'peach',tag:'Home projects'},
  {slug:'painting',title:'Painting',subtitle:'Walls, finishes & touch-ups',icon:PaintRoller,skin:'sky',tag:'Home projects'},
  {slug:'appliance-repair',title:'Appliance repair',subtitle:'Fridges, washers & more',icon:Refrigerator,skin:'rose',tag:'Home essentials'}
] as const;

export function MarketplaceHome(){
 const router=useRouter();
 const [query,setQuery]=useState('');
 const [area,setArea]=useState('Bamburi');
 const [active,setActive]=useState('plumbing');
 const selected=categories.find(c=>c.slug===active)||categories[0];
 function find(e:FormEvent){e.preventDefault();const description=query.trim();if(!description)return;track('service_search_submitted',{query:description,area});const slug=inferService(description)||'other-services';router.push('/request?category='+encodeURIComponent(slug)+'&description='+encodeURIComponent(description)+'&area='+encodeURIComponent(area));}
 const prompt=(q:string)=>{setQuery(q);const slug=inferService(q)||active;router.push('/request?category='+encodeURIComponent(slug)+'&description='+encodeURIComponent(q)+'&area='+encodeURIComponent(area));};
 return <>
  <section className="market-hero">
   <div className="container market-hero-shell">
    <div className="market-intro">
     <span className="market-locale"><MapPin size={15}/> Your neighbourhood, your people. <b>Mombasa pilot</b></span>
     <h1>Local help for<br/><em>everyday life.</em></h1>
     <p>Need something fixed, cleaned or sorted? Tell JiTap what you need. We'll help you take the next step towards finding skilled help nearby.</p>
     <form className="market-search" onSubmit={find} role="search">
      <label className="market-search-input"><Search size={22} aria-hidden="true"/><input aria-label="What do you need help with?" placeholder="What do you need help with?" value={query} onChange={e=>setQuery(e.target.value)} required/></label>
      <label className="market-search-place"><MapPin size={18} aria-hidden="true"/><select value={area} onChange={e=>setArea(e.target.value)} aria-label="Your area">{areas.map(x=><option key={x}>{x}</option>)}</select></label>
      <button className="market-find" type="submit">Find help <ArrowRight size={19}/></button>
     </form>
     <div className="market-try"><span>Popular:</span><button onClick={()=>prompt('My sink is leaking')}>Leaking sink</button><button onClick={()=>prompt('I need house cleaning')}>House cleaning</button><button onClick={()=>prompt('Repair my electrical socket')}>Socket repair</button></div>
    </div>
    <div className="market-hero-visual"><div className="market-coast" aria-hidden="true"/><div className="market-hero-circle"/><img src="/images/mascot.webp" alt="JiTap mascot ready to help" className="market-mascot"/><div className="market-floating market-floating-top"><span className="market-small-icon">📍</span><span>Starting in <strong>Bamburi & Nyali</strong></span></div><div className="market-floating market-floating-bottom"><span className="market-small-icon green">✓</span><span><strong>ASK • MATCH • BUZZ</strong><small>Simple steps to local help</small></span></div></div>
   </div>
  </section>
  <section className="market-categories container" aria-labelledby="market-browse">
   <div className="market-section-top"><div><span className="market-kicker">EXPLORE SERVICES</span><h2 id="market-browse">What can we help with?</h2></div><Link href="/services" className="market-all-link">View all services <ArrowUpRight size={18}/></Link></div>
   <div className="market-icon-grid">{chips.map(c=><button className={'market-cat'+(active===c.slug?' selected':'')} key={c.slug} onClick={()=>setActive(c.slug)} aria-pressed={active===c.slug}><span className="market-icon-wrap"><c.icon size={25} strokeWidth={1.8}/></span><span>{c.label}</span></button>)}</div>
   <div className="market-category-discover"><div className="market-category-copy"><span className="market-tag">EXPLORE {selected.name.toUpperCase()}</span><h3>{selected.name} made easier.</h3><p>{selected.summary}. Explore common requests and tell us what needs doing in your neighbourhood.</p><Link href={'/services/'+selected.slug} className="market-text-arrow">Explore {selected.name} <ArrowRight size={18}/></Link></div><div className="market-category-pills">{(examples[active]||examples.plumbing).map(t=><button key={t} onClick={()=>prompt(t)}>{t}<ArrowUpRight size={15}/></button>)}</div></div>
  </section>
  <section className="market-popular"><div className="container"><div className="market-section-top"><div><span className="market-kicker">POPULAR RIGHT NOW</span><h2>Help with the things that matter.</h2><p>Everyday jobs, big and small. Choose a category to get started.</p></div><Link href="/services" className="market-all-link">All categories <ArrowUpRight size={18}/></Link></div><div className="market-projects">{featureCards.map(c=><Link className={'market-project '+c.skin} href={'/services/'+c.slug} key={c.slug}><span className="market-project-tag">{c.tag}</span><span className="market-project-illustration"><c.icon strokeWidth={1.4}/></span><div className="market-project-foot"><div><strong>{c.title}</strong><small>{c.subtitle}</small></div><span className="market-project-arrow"><ArrowUpRight size={20}/></span></div></Link>)}</div><p className="market-small-note">JiTap's provider network is being built in Bamburi and Nyali. Service availability and prices are not guaranteed or shown until verified.</p></div></section>
  <section className="market-how container"><div className="market-how-head"><span className="market-kicker">HOW JITAP WORKS</span><h2>One less thing to worry about.</h2><p>From “I need help” to the next step—without chasing endless referrals.</p></div><div className="market-how-grid"><div className="market-step"><span className="market-step-num">01</span><div className="market-step-icon"><MessageCircleMore size={30}/></div><h3>ASK</h3><p>Describe your service need, in your own words, and tell us your area.</p></div><div className="market-step"><span className="market-step-num">02</span><div className="market-step-icon"><SlidersHorizontal size={30}/></div><h3>MATCH</h3><p>JiTap identifies the right category and checks supported neighbourhood coverage.</p></div><div className="market-step"><span className="market-step-num">03</span><div className="market-step-icon"><CheckCircle2 size={30}/></div><h3>BUZZ</h3><p>As the provider network goes live, suitable fundis can respond and coordinate jobs.</p></div></div><div className="market-center-action"><Link className="market-cta" href="/how-it-works">See how JiTap works <ArrowRight size={18}/></Link></div></section>
  <section className="market-neighborhood"><div className="container market-neighborhood-inner"><div className="market-neighborhood-copy"><span className="market-kicker">ROOTED IN MOMBASA</span><h2>Good help starts<br/>close to home.</h2><p>We're starting with Bamburi and Nyali, working to make local skills easier to discover and everyday service requests simpler to coordinate.</p><div className="market-area-tags"><span><MapPin size={16}/> Bamburi</span><span><MapPin size={16}/> Nyali</span></div><Link href="/request" className="market-cta market-cta-light">Tell us what you need <ArrowRight size={18}/></Link></div><div className="market-neighborhood-art"><img src="/images/coast.webp" alt="Mombasa coastal neighbourhood illustration"/><div className="market-neighborhood-caption"><House size={19}/> Built for our neighbourhoods</div></div></div></section>
  <section className="market-provider-cta container"><div className="market-provider-icon"><UsersRound size={32}/></div><div><span className="market-kicker">FOR LOCAL SERVICE PROVIDERS</span><h2>Your skills. More opportunities.</h2><p>Are you a fundi, technician or service professional? Join JiTap's growing Mombasa provider network.</p></div><Link href="/providers/apply" className="market-cta">Become a provider <ArrowRight size={18}/></Link></section>
  <section className="market-bottom"><div className="container market-bottom-inner"><div><span className="market-kicker">READY TO GET STARTED?</span><h2>That thing on your to-do list?<br/>Tell JiTap.</h2></div><Link href="/request" className="market-cta market-cta-light">Find local help <ArrowRight size={18}/></Link></div></section>
 </>;
}
