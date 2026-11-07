'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {BriefcaseBusiness,Layers,MapPin,Star,Truck,ArrowRight,Clock3,Monitor,Check} from 'lucide-react';
export type Profile={id:string;display_name:string;business_name:string;service_categories:string[];service_areas:string[];base_area:string|null;description:string|null;logo_url:string|null;rating:number|null;review_count:number|null;years_experience:number|null;similar_jobs_completed:number|null;verified_at:string|null;is_online:boolean};
const fallback:Profile={id:'fund-022',display_name:'URBAN MOVERS AND RELOCATIONS',business_name:'URBAN MOVERS AND RELOCATIONS',service_categories:['Moving / Delivery','Relocation'],service_areas:['Bamburi','Nyali','Mtwapa','Tudor'],base_area:'Bamburi',description:'House moving, relocation and interior decor services.',logo_url:null,rating:null,review_count:null,years_experience:null,similar_jobs_completed:null,verified_at:null,is_online:false};
export function ProviderShowcase({detail=false,profile,profileId='fund-022',fromMatch=false}:{detail?:boolean;profile?:Profile;profileId?:string;fromMatch?:boolean}){
 const [loaded,setLoaded]=useState<Profile|null>(null);
 useEffect(()=>{
  if(profile)return;
  const controller=new AbortController();
  fetch('/api/providers/public',{signal:controller.signal}).then(r=>r.ok?r.json():null).then(data=>{
   const found=data?.profiles?.find((item:Profile)=>item.id===profileId);
   if(found)setLoaded(found);
  }).catch(()=>{});
  return()=>controller.abort();
 },[profile,profileId]);
 const p=profile||loaded||(profileId==='fund-022'?fallback:null);
 if(!p)return <p>Provider profile unavailable.</p>;
 const isTech=p.id==='fund-036';
 const request='/request?category='+(isTech?'other-services':'moving')+'&area='+encodeURIComponent(p.base_area||'Bamburi')+'&description='+encodeURIComponent(isTech?'I need computer repair or IT support from '+p.business_name:'I need moving or relocation services from '+p.business_name);
 return <article className={'jt-provider-feature'+(detail?' jt-provider-feature-detail':'')}>
  <div className="jt-provider-logo-panel">{p.logo_url?<img src={p.logo_url} alt={p.business_name+' logo'}/>:<div className="jt-provider-logo-placeholder">{isTech?<Monitor size={42}/>:<Truck size={42}/>}<strong>{p.business_name}</strong><small>{isTech?'Computer services & support':'Moving & Relocation'}</small></div>}</div>
  <div className="jt-provider-feature-content"><h2>{p.business_name}{p.verified_at&&(isTech?<span className="jt-zenotech-check" role="img" aria-label="JiTap verified provider"><Check size={24} strokeWidth={3.5}/></span>:<img className="jt-provider-verified-shield" src="/images/verified-shield.svg" alt="JiTap verified business" width={38} height={38}/>)}</h2>
   <div className="jt-provider-metrics">
    {p.rating!==null&&p.review_count!==null&&p.review_count>0&&<p className="jt-provider-rating"><Star fill="currentColor" size={21}/> <strong>{Number(p.rating).toFixed(1)} stars</strong> <span>({p.review_count} reviews)</span></p>}
    {p.years_experience!==null&&<p><BriefcaseBusiness size={21}/>{p.years_experience} years of experience</p>}
    {p.is_online?<p className="jt-provider-online"><span className={isTech?'jt-provider-online-dot jt-provider-online-dot-flash':'jt-provider-online-dot'}/>Online now</p>:<p><Clock3 size={21}/>Ask about availability</p>}
    {p.similar_jobs_completed!==null&&<p><Layers size={21}/>{p.similar_jobs_completed} similar jobs completed</p>}
    <p><MapPin size={21}/>{p.base_area||p.service_areas[0]||'Mombasa'}</p>
   </div>
   {detail&&<div className="jt-provider-feature-extra"><p>{p.description||(isTech?'Computer services and IT support.':'House moving and relocation services.')}</p><h3>Service coverage</h3><p>{p.service_areas.join(' · ')}</p>{isTech&&<p><a href="https://share.google/sw7NGTin3byTlEmrD" target="_blank" rel="noopener noreferrer">View Google listing and reviews</a></p>}</div>}
  </div>
  <div className="jt-provider-feature-actions">{detail?<Link href={'/request?resume=1&providerId='+encodeURIComponent(p.id)} className="jt-provider-profile-button">{isTech?'Request':'Request'} <ArrowRight size={18}/></Link>:<Link href={'/fundis/'+encodeURIComponent(p.id)+(fromMatch?'?fromMatch=1':'')} className="jt-provider-profile-button">View profile</Link>}</div>
 </article>;
}
