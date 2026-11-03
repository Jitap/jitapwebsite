'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,MapPin,Search,SlidersHorizontal,ShieldAlert} from 'lucide-react';
import {areas} from '@/lib/data';
import {fundiListings} from '@/lib/fundis-public';

const filters=['All services','Plumbing','Electrical','Cleaning','Carpentry','Painting','Appliance Repair','IT / Phone / Computer Services','Other'];
export const slugFor=(cats:string[]):string=>{
 const joined=cats.join(' ').toLowerCase();
 if(joined.includes('plumbing'))return 'plumbing';
 if(joined.includes('electrical'))return 'electrical';
 if(joined.includes('cleaning'))return 'cleaning';
 if(joined.includes('carpentry'))return 'carpentry';
 if(joined.includes('painting'))return 'painting';
 if(joined.includes('appliance'))return 'appliance-repair';
 return 'other-services';
};
export function FundiDirectory(){
 const [area,setArea]=useState('All areas');
 const [category,setCategory]=useState('All services');
 const [query,setQuery]=useState('');
 const shown=useMemo(()=>fundiListings.filter(p=>{
  const areaOk=area==='All areas'||p.areas.includes(area);
  const catOk=category==='All services'||(category==='Other'?p.categories.some(c=>c==='Other'):p.categories.some(c=>c.toLowerCase().includes(category.toLowerCase())));
  const term=query.trim().toLowerCase();
  const textOk=!term||[p.name,...p.categories,...p.areas].join(' ').toLowerCase().includes(term);
  return areaOk&&catOk&&textOk;
 }),[area,category,query]);
 return <section className="td-directory" aria-labelledby="td-directory-title">
  <div className="container td-directory-heading"><span className="td-kicker">FUNDIS AND LOCAL SERVICE PROFESSIONALS</span><h1 id="td-directory-title">Find a fundi for your next job.</h1><p>Browse profiles submitted to JiTap for the Mombasa network. Tell us what needs doing, and JiTap can review your request. Direct contact numbers are never published.</p><div className="td-directory-stats"><span><MapPin size={18}/> 6 request areas</span></div></div>
  <div className="container td-dir-layout">
   <aside className="td-dir-sidebar" aria-label="Fundi directory filters">
    <h2><SlidersHorizontal size={19}/> Filter fundis</h2>
    <label htmlFor="dir-area">Your area</label><select id="dir-area" value={area} onChange={e=>setArea(e.target.value)}><option>All areas</option>{areas.map(a=><option key={a}>{a}</option>)}</select>
    <label htmlFor="dir-category">Type of work</label><select id="dir-category" value={category} onChange={e=>setCategory(e.target.value)}>{filters.map(x=><option key={x}>{x}</option>)}</select>
    <label htmlFor="dir-search">Search skills or business</label><div className="td-dir-input"><Search size={18}/><input id="dir-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. fundi wa stima"/></div>
    <button type="button" className="td-clear" onClick={()=>{setArea('All areas');setCategory('All services');setQuery('')}}>Clear filters</button>
    <div className="td-directory-note"><ShieldAlert size={19}/><span>Profiles show service categories and areas supplied to JiTap. Availability, credentials and customer ratings have not been independently confirmed.</span></div>
   </aside>
   <div className="td-dir-results"><div className="td-results-top"><h2>Mombasa Local Skill Network</h2><p>{area==='All areas'?'Across the JiTap network':'Listed for '+area}</p></div>
    {shown.length===0?<div className="td-empty"><h3>No submitted fundi profiles match these filters yet.</h3><p>You can still send a service request in {area==='All areas'?'Mombasa':area}; JiTap will review it against current coverage.</p><Link href={'/request?area='+encodeURIComponent(area==='All areas'?'Bamburi':area)} className="td-primary">Describe your job <ArrowRight size={16}/></Link></div>:
    <div className="td-pro-list">{shown.map((p,i)=>{
      const categorySlug=slugFor(p.categories);
      const selectedArea=area!=='All areas'?area:(p.areas[0]||'Bamburi');
      const label=p.name.split(/\s+/).map(s=>s[0]||'').slice(0,2).join('').toUpperCase()||'JF';
      const description='I would like help with '+p.categories.join(', ')+' from '+p.name+'. Please review my request.';
      const url='/request?category='+encodeURIComponent(categorySlug)+'&area='+encodeURIComponent(selectedArea)+'&description='+encodeURIComponent(description);
      return <article className="td-pro-card" key={p.id}>
        <div className={'td-pro-avatar td-avatar-'+(i%5)} aria-hidden="true">{label}</div>
        <div className="td-pro-detail"><h3>{p.name}</h3><p className="td-pro-cats">{p.categories.join(' · ')}</p><div className="td-pro-areas"><MapPin size={15}/>{p.areas.join(' · ')}</div></div>
        <div className="td-pro-action"><Link href={"/fundis/"+encodeURIComponent(p.id)} className="td-outline-button">View profile</Link></div>
      </article>
    })}</div>}
   </div>
  </div>
 </section>;
}

export function matchesFor(category:string,area:string){
 const serviceNames:Record<string,string[]>={
  plumbing:['plumbing'],electrical:['electrical'],cleaning:['cleaning'],
  carpentry:['carpentry'],painting:['painting'],'appliance-repair':['appliance repair'],
  'general-repairs':['carpentry','electrical','plumbing'],'other-services':['it / phone / computer services','other']
 };
 const names=serviceNames[category]||serviceNames['other-services'];
 return fundiListings.filter(p=>p.areas.includes(area)&&p.categories.some(c=>names.some(n=>c.toLowerCase().includes(n))));
}
export function MatchedFundis({category,area,onQuotes}:{category:string;area:string;onQuotes:()=>void}){
 const matched=matchesFor(category,area);
 const visible=matched.slice(0,4);
 return <section className="jt-matches" aria-label="Matching local service providers">
  <div className="jt-matches-title"><span className="th-overline">LOCAL SERVICE MATCHES</span><h2>{matched.length} {matched.length===1?'matching profile':'matching profiles'} in {area}</h2><p>Based on listed services and service areas. Availability and quotations are confirmed after a request is submitted.</p></div>
  {matched.length>0?<><div className="jt-matches-quote"><div><strong>Request quotes from local professionals</strong><p>Share your job details with JiTap to request pricing and availability. No quote has been issued yet.</p></div><button type="button" className="td-outline-button" onClick={onQuotes}>Request {matched.length===1?'a quote':'quotes'}</button></div>
  <div className="td-pro-list">{visible.map((p,i)=><article className="td-pro-card" key={p.id}>
   <div className={'td-pro-avatar td-avatar-'+(i%5)} aria-hidden="true">{p.name.split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase()}</div>
   <div className="td-pro-detail"><h3>{p.name}</h3><p className="td-pro-cats">{p.categories.join(' · ')}</p><div className="td-pro-areas"><MapPin size={15}/>{p.areas.join(' · ')}</div></div>
   <div className="td-pro-action"><Link className="td-outline-button" href={'/fundis/'+encodeURIComponent(p.id)}>View profile</Link></div>
  </article>)}</div>{matched.length>4&&<p className="jt-more-matches">Showing 4 of {matched.length} matching profiles. <Link href={'/fundis'}>Browse the network</Link></p>}</>:
  <div className="td-empty"><h3>No matching profiles listed for {area} yet.</h3><p>Submit your service brief and JiTap can review your request against network coverage.</p><button type="button" className="td-outline-button" onClick={onQuotes}>Send service request</button></div>}
 </section>;
}
export function FundiProfile({id}:{id:string}){
 const p=fundiListings.find(x=>x.id===id);
 if(!p)return null;
 const category=slugFor(p.categories),area=p.areas[0]||'Bamburi';
 const job='I would like a quote for '+p.categories.join(', ')+' from '+p.name+'.';
 const href='/request?category='+encodeURIComponent(category)+'&area='+encodeURIComponent(area)+'&description='+encodeURIComponent(job);
 return <section className="container jt-profile"><Link href="/fundis" className="jt-profile-back">← Back to local professionals</Link><article className="jt-profile-panel">
 <div className="td-pro-avatar" aria-hidden="true">{p.name.split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase()}</div>
 <div><span className="th-overline">LOCAL SERVICE PROFESSIONAL</span><h1>{p.name}</h1><h2>Services</h2><p>{p.categories.join(' · ')}</p><h2>Service areas</h2><p>{p.areas.join(' · ')}</p>
 <p className="jt-profile-disclaimer">Service details are provided for discovery. Availability, ratings and credentials have not been independently confirmed.</p>
 <Link className="td-outline-button" href={href}>Request a quote</Link></div></article></section>;
}
