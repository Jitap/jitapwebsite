'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,MapPin,Search,SlidersHorizontal,ShieldAlert,UsersRound} from 'lucide-react';
import {areas} from '@/lib/data';
import {fundiListings} from '@/lib/fundis-public';

const filters=['All services','Plumbing','Electrical','Cleaning','Carpentry','Painting','Appliance Repair','IT / Phone / Computer Services','Other'];
const slugFor=(cats:string[]):string=>{
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
  <div className="container td-directory-heading"><span className="td-kicker">FUNDIS AND LOCAL SERVICE PROFESSIONALS</span><h1 id="td-directory-title">Find a fundi for your next job.</h1><p>Browse profiles submitted to JiTap for the Mombasa network. Tell us what needs doing, and JiTap can review your request. Direct contact numbers are never published.</p><div className="td-directory-stats"><span><UsersRound size={18}/> {fundiListings.length} submitted profiles</span><span><MapPin size={18}/> 6 request areas</span></div></div>
  <div className="container td-dir-layout">
   <aside className="td-dir-sidebar" aria-label="Fundi directory filters">
    <h2><SlidersHorizontal size={19}/> Filter fundis</h2>
    <label htmlFor="dir-area">Your area</label><select id="dir-area" value={area} onChange={e=>setArea(e.target.value)}><option>All areas</option>{areas.map(a=><option key={a}>{a}</option>)}</select>
    <label htmlFor="dir-category">Type of work</label><select id="dir-category" value={category} onChange={e=>setCategory(e.target.value)}>{filters.map(x=><option key={x}>{x}</option>)}</select>
    <label htmlFor="dir-search">Search skills or business</label><div className="td-dir-input"><Search size={18}/><input id="dir-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="e.g. fundi wa stima"/></div>
    <button type="button" className="td-clear" onClick={()=>{setArea('All areas');setCategory('All services');setQuery('')}}>Clear filters</button>
    <div className="td-directory-note"><ShieldAlert size={19}/><span><strong>Onboarding profiles.</strong> Listings have not been presented as verified, available right now, rated, licensed or guaranteed to accept a job.</span></div>
   </aside>
   <div className="td-dir-results"><div className="td-results-top"><h2>{shown.length} fundi {shown.length===1?'profile':'profiles'}</h2><p>{area==='All areas'?'Across the JiTap network':'Listed for '+area}</p></div>
    {shown.length===0?<div className="td-empty"><h3>No submitted fundi profiles match these filters yet.</h3><p>You can still send a service request in {area==='All areas'?'Mombasa':area}; JiTap will review it against current coverage.</p><Link href={'/request?area='+encodeURIComponent(area==='All areas'?'Bamburi':area)} className="td-primary">Describe your job <ArrowRight size={16}/></Link></div>:
    <div className="td-pro-list">{shown.map((p,i)=>{
      const categorySlug=slugFor(p.categories);
      const selectedArea=area!=='All areas'?area:(p.areas[0]||'Bamburi');
      const label=p.name.split(/\s+/).map(s=>s[0]||'').slice(0,2).join('').toUpperCase()||'JF';
      const description='I would like help with '+p.categories.join(', ')+' from '+p.name+'. Please review my request.';
      const url='/request?category='+encodeURIComponent(categorySlug)+'&area='+encodeURIComponent(selectedArea)+'&description='+encodeURIComponent(description);
      return <article className="td-pro-card" key={p.id}>
        <div className={'td-pro-avatar td-avatar-'+(i%5)} aria-hidden="true">{label}</div>
        <div className="td-pro-detail"><span className="td-pro-status">Provider onboarding profile</span><h3>{p.name}</h3><p className="td-pro-cats">{p.categories.join(' · ')}</p><div className="td-pro-areas"><MapPin size={15}/>{p.areas.join(' · ')}</div></div>
        <div className="td-pro-action"><Link href={url} className="td-outline-button">Request introduction <ArrowRight size={17}/></Link><small>JiTap coordinates requests. No public phone number.</small></div>
      </article>
    })}</div>}
   </div>
  </div>
 </section>;
}
