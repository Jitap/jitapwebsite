'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {BriefcaseBusiness,Layers,MapPin,Star,Truck,ArrowRight,Clock3} from 'lucide-react';
export type Profile={id:string;display_name:string;business_name:string;service_categories:string[];service_areas:string[];base_area:string|null;description:string|null;logo_url:string|null;rating:number|null;review_count:number|null;years_experience:number|null;similar_jobs_completed:number|null;verified_at:string|null;is_online:boolean};
const fallback:Profile={id:'fund-022',display_name:'URBAN MOVERS AND RELOCATIONS',business_name:'URBAN MOVERS AND RELOCATIONS',service_categories:['Moving / Delivery','Relocation'],service_areas:['Bamburi','Nyali','Mtwapa','Tudor'],base_area:'Bamburi',description:'House moving, relocation and interior decor services.',logo_url:null,rating:null,review_count:null,years_experience:null,similar_jobs_completed:null,verified_at:null,is_online:false};
export function ProviderShowcase({detail=false}:{detail?:boolean}){
 const [p,setP]=useState<Profile>(fallback);
 useEffect(()=>{const controller=new AbortController();fetch('/api/providers/public',{signal:controller.signal}).then(r=>r.ok?r.json():null).then(data=>{if(data?.profiles?.[0])setP(data.profiles[0])}).catch(()=>{});return()=>controller.abort()},[]);
 const request='/request?category=moving&description='+encodeURIComponent('I would like a moving or relocation quote from '+p.business_name);
 return <article className={'jt-provider-feature'+(detail?' jt-provider-feature-detail':'')}>
  <div className="jt-provider-logo-panel">{p.logo_url?<img src={p.logo_url} alt={p.business_name+' logo'}/>:<div className="jt-provider-logo-placeholder"><Truck size={42}/><strong>{p.business_name}</strong><small>Moving &amp; Relocation</small></div>}</div>
  <div className="jt-provider-feature-content"><h2>{p.business_name}{p.verified_at&&<img className="jt-provider-verified-shield" src="/images/verified-shield.svg" alt="JiTap verified business" width={38} height={38}/>}</h2>
   <div className="jt-provider-metrics">
    {p.rating!==null&&p.review_count!==null&&p.review_count>0&&<p className="jt-provider-rating"><Star fill="currentColor" size={21}/> <strong>{Number(p.rating).toFixed(1)} stars</strong> <span>({p.review_count} reviews)</span></p>}
    {p.years_experience!==null&&<p><BriefcaseBusiness size={21}/>{p.years_experience} years of experience</p>}
    {p.is_online?<p className="jt-provider-online"><span className="jt-provider-online-dot"/>Online now</p>:<p><Clock3 size={21}/>Ask about availability</p>}
    {p.similar_jobs_completed!==null&&<p><Layers size={21}/>{p.similar_jobs_completed} similar jobs completed</p>}
    <p><MapPin size={21}/>{p.base_area||p.service_areas[0]||'Mombasa'}</p>
   </div>
   {detail&&<div className="jt-provider-feature-extra"><p>{p.description||'House moving and relocation services.'}</p><h3>Service coverage</h3><p>{p.service_areas.join(' · ')}</p></div>}
  </div>
  <div className="jt-provider-feature-actions">{detail?<Link href={request} className="jt-provider-profile-button">Request moving quote <ArrowRight size={18}/></Link>:<Link href={p.id==='fund-022'?'/fundis/fund-022':'/movers/'+encodeURIComponent(p.id)} className="jt-provider-profile-button">View profile</Link>}</div>
 </article>;
}
