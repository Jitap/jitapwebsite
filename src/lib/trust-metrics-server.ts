import 'server-only';
import {supabasePrivate} from '@/lib/coordinator-server';

export type TrustMetric={
 rating:number|null;
 ratingCount:number;
 jobs:number;
};
type ProviderAggregate={
 provider_user_id:string;
 rating:number|string|null;
 rating_count:number|string;
 completed_jobs:number|string;
};
type CustomerAggregate={
 customer_user_id:string;
 rating:number|string|null;
 rating_count:number|string;
 requested_jobs:number|string;
};
const number=(value:unknown)=>{
 const n=Number(value);
 return Number.isFinite(n)&&n>=0?n:0;
};
const rating=(value:unknown)=>{
 if(value===null||value===undefined)return null;
 const n=Number(value);
 return Number.isFinite(n)&&n>=1&&n<=5?n:null;
};
function uniqueIds(ids:string[]){
 return [...new Set(ids.filter(id=>/^[0-9a-f-]{36}$/i.test(id)))].slice(0,250);
}
/** Only call after the caller has verified ownership of the underlying
 * bookings. The database RPCs are service-role-only and cannot be called by
 * anonymous or authenticated browsers.
 */
export async function providerTrustMetrics(ids:string[]):Promise<Map<string,TrustMetric>>{
 const valid=uniqueIds(ids);
 if(!valid.length)return new Map();
 const rows=await supabasePrivate<ProviderAggregate[]>('rpc/jitap_provider_trust_metrics',{
  method:'POST',body:JSON.stringify({p_ids:valid})
 });
 return new Map(rows.map(r=>[r.provider_user_id,{
  rating:rating(r.rating),ratingCount:number(r.rating_count),jobs:number(r.completed_jobs)
 }]));
}
export async function customerTrustMetrics(ids:string[]):Promise<Map<string,TrustMetric>>{
 const valid=uniqueIds(ids);
 if(!valid.length)return new Map();
 const rows=await supabasePrivate<CustomerAggregate[]>('rpc/jitap_customer_trust_metrics',{
  method:'POST',body:JSON.stringify({p_ids:valid})
 });
 return new Map(rows.map(r=>[r.customer_user_id,{
  rating:rating(r.rating),ratingCount:number(r.rating_count),jobs:number(r.requested_jobs)
 }]));
}
