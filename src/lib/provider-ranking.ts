import {providerMatchesTrade,tradeLabels} from '@/lib/trade-categories';

/**
 * Eligibility is strict: a provider needs the requested trade AND coverage area.
 * Ranking never converts a historical listed profile into a verified/available provider.
 */
export type RankableProvider={
 id:string;categories:string[];areas:string[];
 base_area?:string|null;is_online?:boolean|null;verified_at?:string|null;
 rating?:number|null;review_count?:number|null;
 years_experience?:number|null;similar_jobs_completed?:number|null;
};
const normal=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const aliases:Record<string,string>={
 plumber:'plumbing',plumbers:'plumbing',plumbing:'plumbing',
 electrician:'electrical',electricians:'electrical',
 moving:'moving',relocation:'moving','moving delivery':'moving',
 'it phone computer services':'it-repairs','computer phone repair':'it-repairs',
 'computer phone services':'it-repairs','computer services':'it-repairs',
 'computer phone repair services':'it-repairs',
 'appliance repair':'appliance-repair','appliance repairs':'appliance-repair',
 'general repair':'general-repairs','other':'other-services',
 'other services':'other-services',
 'gardening landscaping':'landscaping','mechanic auto services':'vehicle-repair',
 'beauty barber salon':'beauty','air conditioning refrigeration':'air-conditioning'
};
export function canonicalTrade(raw:string):string{
 const clean=normal(raw);
 if(aliases[clean])return aliases[clean];
 const slug=clean.replace(/ /g,'-');
 if(tradeLabels[slug])return slug;
 if(slug==='computer-phone-repair')return 'it-repairs';
 return slug;
}
export function eligibleForProvider(provider:RankableProvider,category:string,area:string):boolean{
 const trade=canonicalTrade(category);
 const target=normal(area);
 return !!target&&provider.areas.some(a=>normal(a)===target)&&
  (providerMatchesTrade(trade,provider.categories)||
   provider.categories.some(label=>canonicalTrade(label)===trade));
}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
/** Pilot ranking: category fit 35, locality 25, online status 20,
 * observable jobs/reviews 10, verification/experience 10.
 * Unknown values score zero, never imply verified proximity or availability.
 */
export function providerRankScore(p:RankableProvider,category:string,area:string):number{
 if(!eligibleForProvider(p,category,area))return -1;
 const trade=canonicalTrade(category);
 const exact=p.categories.some(c=>canonicalTrade(c)===trade);
 const skill=exact?35:30;
 const locality=p.base_area&&normal(p.base_area)===normal(area)?25:20;
 const online=p.is_online===true?20:0;
 const jobs=clamp(Number(p.similar_jobs_completed)||0,0,10);
 const reviews=(Number(p.review_count)||0)>0?clamp((Number(p.rating)||0)/5*5,0,5):0;
 const evidence=Math.round(clamp(jobs/2+reviews,0,10));
 const experience=p.verified_at?5:0;
 const years=clamp((Number(p.years_experience)||0)/10*5,0,5);
 return Math.round((skill+locality+online+evidence+experience+years)*10)/10;
}
export function rankProviders<T extends RankableProvider>(providers:T[],category:string,area:string):T[]{
 return providers.filter(p=>eligibleForProvider(p,category,area)).sort((a,b)=>
  providerRankScore(b,category,area)-providerRankScore(a,category,area)||
  a.id.localeCompare(b.id));
}
