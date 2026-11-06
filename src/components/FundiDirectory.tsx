'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,MapPin,Search,SlidersHorizontal} from 'lucide-react';
import {areas,categories} from '@/lib/data';
import {fundiListings} from '@/lib/fundis-public';
import {ProviderShowcase} from '@/components/ProviderShowcase';

const filters=['All services',...categories.filter(c=>c.slug!=='other-services').map(c=>c.name)];
const tradeLabels:Record<string,string[]>={
 plumbing:['plumbing'],electrical:['electrical'],cleaning:['cleaning','laundry'],
 painting:['painting'],carpentry:['carpentry','furniture','woodwork'],
 'appliance-repair':['appliance repair','home appliances'],
 'general-repairs':['handyman','general repairs','fixture repair'],
 moving:['moving','relocation'],
 roofing:['roofing','roofer','gutter'],masonry:['masonry','construction','brick','plaster'],
 tiling:['tiling','flooring','tiles'],welding:['welding','metalwork','fabrication'],
 'air-conditioning':['ac & refrigeration','air conditioning','refrigeration','hvac'],
 'solar-security':['solar','cctv','security','electric fence'],
 'it-repairs':['it / phone / computer services','computer repair','phone repair','it support'],
 'vehicle-repair':['mechanic','auto services','vehicle repair','bicycle repair'],
 landscaping:['gardening','landscaping'], 'pest-control':['pest control'],
 'glass-aluminium':['glass','aluminium']
};
export const slugFor=(cats:string[]):string=>{
 const joined=cats.join(' ').toLowerCase();
 for(const category of categories){
  if(category.slug==='other-services')continue;
  if((tradeLabels[category.slug]||[]).some(label=>joined.includes(label)))return category.slug;
 }
 return 'other-services';
};
export function FundiDirectory(){
 const [area,setArea]=useState('All areas');
 const [category,setCategory]=useState('All services');
 const [query,setQuery]=useState('');
 const shown=useMemo(()=>fundiListings.filter(p=>{
  const areaOk=area==='All areas'||p.areas.includes(area);
  const selected=categories.find(c=>c.name===category);
  const catOk=category==='All services'||!!selected&&p.categories.some(c=>(tradeLabels[selected.slug]||[]).some(label=>c.toLowerCase().includes(label)));
  const term=query.trim().toLowerCase();
  const mamaFua=/(?:mama[\s-]*fua|mamafua|kufua|laundry|house.?cleaner|house.?keeper|house cleaning)/i.test(term);const textOk=!term||(mamaFua&&p.categories.some(c=>c.toLowerCase().includes('cleaning')))||[p.name,...p.categories,...p.areas,...(p.id==='fund-022'?['urban movers and relocations','moving','relocation','house moving']:[]),...(p.id==='fund-036'?['zenotech computers','zenotech','zeno tech','computer repair','laptop repair','printer repair','it support','networking']:[])].join(' ').toLowerCase().includes(term);
  return areaOk&&catOk&&textOk;
 }),[area,category,query]);
 return <section className="td-directory" aria-labelledby="td-directory-title">
  <div className="container td-directory-heading"><span className="td-kicker">FUNDIS AND LOCAL SERVICE PROFESSIONALS</span><h1 id="td-directory-title">Find a fundi for your next job.</h1><p>Browse profiles submitted to JiTap for the Mombasa network. Tell us what needs doing, and JiTap can review your request. Direct contact numbers are never published.</p><div className="td-directory-stats"><span><MapPin size={18}/> 6 request areas</span></div></div>
  <div className="container td-dir-layout">
   <aside className="td-dir-sidebar" aria-label="Fundi directory filters">
    <h2><SlidersHorizontal size={19}/> Filter fundis</h2>
    <label htmlFor="dir-area">Your area</label><select id="dir-area" value={area} onChange={e=>setArea(e.target.value)}><option>All areas</option>{areas.map(a=><option key={a}>{a}</option>)}</select>
    <label htmlFor="dir-category">Type of work</label><select id="dir-category" value={category} onChange={e=>setCategory(e.target.value)}>{filters.map(x=><option key={x}>{x}</option>)}</select>
    <label htmlFor="dir-search">Search skills or business</label><div className="td-dir-input"><Search size={18}/><input id="dir-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. Mama Fua, fundi wa stima"/></div>
    <button type="button" className="td-clear" onClick={()=>{setArea('All areas');setCategory('All services');setQuery('')}}>Clear filters</button>
    
   </aside>
   <div className="td-dir-results"><div className="td-results-top"><h2>Mombasa Local Skill Network</h2><p>{area==='All areas'?'Across the JiTap network':'Listed for '+area}</p></div>
    {shown.length===0?<div className="td-empty"><h3>No submitted fundi profiles match these filters yet.</h3><p>You can still send a service request in {area==='All areas'?'Mombasa':area}; JiTap will review it against current coverage.</p><Link href={'/request?area='+encodeURIComponent(area==='All areas'?'Bamburi':area)} className="td-primary">Describe your job <ArrowRight size={16}/></Link></div>:
    <div className="td-pro-list">{shown.map((p,i)=>{
      const categorySlug=slugFor(p.categories);
      const selectedArea=area!=='All areas'?area:(p.areas[0]||'Bamburi');
      const label=p.name.split(/\s+/).map(s=>s[0]||'').slice(0,2).join('').toUpperCase()||'JF';
      const description='I would like help with '+p.categories.join(', ')+' from '+p.name+'. Please review my request.';
      const url='/request?category='+encodeURIComponent(categorySlug)+'&area='+encodeURIComponent(selectedArea)+'&description='+encodeURIComponent(description);
      return (p.id==='fund-022'||p.id==='fund-036')?<ProviderShowcase key={p.id} profileId={p.id}/>:<article className="td-pro-card" key={p.id}>
        <div className={'td-pro-avatar td-avatar-'+(i%5)} aria-hidden="true">{label}</div>
        <div className="td-pro-detail"><h3>{p.name}</h3><p className="td-pro-cats">{p.categories.join(' · ')}</p><div className="td-pro-areas"><MapPin size={15}/>{p.areas.join(' · ')}</div></div>
        <div className="td-pro-action"><Link href={"/fundis/"+encodeURIComponent(p.id)} className="td-outline-button">View profile</Link></div>
      </article>
    })}</div>}
   </div>
  </div>
 </section>;
}

export function matchesFor(category:string,area:string,specialty?:string){
 if(specialty==='tv-mounting')return fundiListings.filter(p=>p.areas.includes(area)&&/\b(?:tv\s*mount|television\s*mount|tv\s*installation)\b/i.test([p.name,...p.categories].join(' ')));
 if(specialty==='computer-services')return fundiListings.filter(p=>p.id==='fund-036'&&p.areas.includes(area));
 if(specialty==='vehicle-mechanic')return fundiListings.filter(p=>p.areas.includes(area)&&/mechanic|garage|vehicle repair|auto repair/i.test([p.name,...p.categories].join(' ')));
 const names=tradeLabels[category]||[];
 if(!names.length)return [];
 return fundiListings.filter(p=>p.areas.includes(area)&&p.categories.some(c=>names.some(n=>c.toLowerCase().includes(n))));
}
export function MatchedFundis({category,area,onQuotes,specialty}:{category:string;area:string;onQuotes:()=>void;specialty?:string}){
 const matched=matchesFor(category,area,specialty);
 const visible=matched.slice(0,4);
 return <section className="jt-matches" aria-label="Matching local service providers">
  <div className="jt-matches-title"><span className="th-overline">LOCAL SERVICE MATCHES</span><h2>{matched.length} {matched.length===1?'matching profile':'matching profiles'} in {area}</h2><p>Based on listed services and service areas. Availability and quotations are confirmed after a request is submitted.</p></div>
  {matched.length>0?<><div className="jt-matches-quote"><div><strong>Connect with local fundis</strong><p>Share your service brief with JiTap to coordinate the next steps and check provider availability.</p></div><button type="button" className="td-outline-button" onClick={onQuotes}>Request</button></div>
  <div className="td-pro-list">{visible.map((p,i)=>(p.id==='fund-022'||p.id==='fund-036')?<ProviderShowcase key={p.id} profileId={p.id}/>:<article className="td-pro-card" key={p.id}>
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
 if(id==='fund-022'||id==='fund-036')return <section className="container jt-profile"><Link href="/fundis" className="jt-profile-back">← Back to local professionals</Link><ProviderShowcase detail profileId={id}/></section>;
 const category=slugFor(p.categories),area=p.areas[0]||'Bamburi';
 const job='I need help with '+p.categories.join(', ')+' from '+p.name+'.';
 const href='/request?category='+encodeURIComponent(category)+'&area='+encodeURIComponent(area)+'&description='+encodeURIComponent(job);
 return <section className="container jt-profile"><Link href="/fundis" className="jt-profile-back">← Back to local professionals</Link><article className="jt-profile-panel">
 <div className="td-pro-avatar" aria-hidden="true">{p.name.split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase()}</div>
 <div><span className="th-overline">LOCAL SERVICE PROFESSIONAL</span><h1>{p.name}</h1><h2>Services</h2><p>{p.categories.join(' · ')}</p><h2>Service areas</h2><p>{p.areas.join(' · ')}</p>
 <p className="jt-profile-disclaimer">Service details are provided for discovery. Availability, ratings and credentials have not been independently confirmed.</p>
 <Link className="td-outline-button" href={href}>Request</Link></div></article></section>;
}
