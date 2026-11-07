import 'server-only';
import {supabasePrivate} from '@/lib/coordinator-server';
import {fundiListings} from '@/lib/fundis-public';

export type RequestRecord={id:string;status:string;created_at:string;payload?:Record<string,unknown>};
type Brief={request_id:string;technical_summary:string;proposed_scope:string;source:string};
type Case={source_id:string;status:string;updated_at:string};
const asText=(value:unknown,max=700)=>typeof value==='string'?value.slice(0,max).trim():'';
const labels:Record<string,string>={
 new:'Received',incomplete:'Information needed',needs_sourcing:'Finding a provider',
 matching:'Matching',provider_contacted:'Provider contacted',awaiting_quote:'Awaiting quotation',
 scheduled:'Scheduled',in_progress:'In progress',completed:'Completed',cancelled:'Cancelled',closed:'Closed',
 reviewing:'Under review',handled:'Handled',archived:'Archived'
};
function customerSummary(raw:string){
 const value=raw.replace(/\s+/g,' ').trim();
 const first=value.split(/(?:\.\s+)(?=(?:Which|What|Where|When|How|Preferred appointment|JiTap inferred service|Choose|Select|Number of|Type of|Is this)\b)/i)[0]||value;
 return first.slice(0,450).trim().replace(/[.;:]$/,'')||'Service assessment requested';
}
function compactDate(p:Record<string,unknown>){
 const date=asText(p.preferredDate,20)||(/Preferred appointment:\s*(\d{4}-\d\d-\d\d)/i.exec(asText(p.description,1500))?.[1]||'');
 return /^\d{4}-\d\d-\d\d$/.test(date)?date:'';
}
function compactTime(p:Record<string,unknown>){
 const time=asText(p.preferredTime,10)||(/Preferred appointment:\s*\d{4}-\d\d-\d\d\s+at\s+(\d\d:\d\d)/i.exec(asText(p.description,1500))?.[1]||'');
 return /^([01]\d|2[0-3]):[0-5]\d$/.test(time)?time:'';
}
export async function formatCustomerTickets(rows:RequestRecord[]){
 if(!rows.length)return [];
 const ids=rows.map(r=>r.id);
 const where='('+ids.join(',')+')';
 // All row IDs were obtained through the authenticated customer-owned request
 // query (or exact OTP-verified phone ownership in the tracking endpoint).
 const [briefs,cases]=await Promise.all([
  supabasePrivate<Brief[]>('jitap_request_service_briefs?select=request_id,technical_summary,proposed_scope,source&request_id=in.'+where),
  supabasePrivate<Case[]>('coordinator_cases?select=source_id,status,updated_at&source_kind=eq.website_request&source_id=in.'+where)
 ]);
 const briefById=new Map(briefs.map(b=>[b.request_id,b]));
 const caseById=new Map(cases.map(c=>[c.source_id,c]));
 return rows.map(r=>{
  const p=r.payload||{};
  const b=briefById.get(r.id),caseRow=caseById.get(r.id);
  const raw=asText(p.description,1500);
  const preferredProviderId=asText(p.preferredProviderId,20);
  const provider=fundiListings.find(f=>f.id===preferredProviderId)||
   // Older requests sometimes named a specific provider in the original
   // customer description, before the preference field was introduced.
   // Use exact known listing name only; never interpret this as assignment.
   fundiListings.find(f=>f.name.length>=6&&raw.toLocaleLowerCase('en-KE').includes(f.name.toLocaleLowerCase('en-KE')));
  const status=caseRow?.status||r.status;
  return {
   reference:r.id,serviceId:'JT-'+r.id.slice(0,8).toUpperCase(),
   category:asText(p.category,70)||'Service',
   date:compactDate(p),time:compactTime(p),
   location:asText(p.locationLabel,180)||asText(p.area,100),
   area:asText(p.area,100),
   provider:provider?.name||'To be matched',
   providerStatus:provider?'Requested provider — awaiting confirmation':'Awaiting matching',
   status,statusLabel:labels[status]||status.replace(/_/g,' '),
   brief:b?.source==='ai'?asText(b.technical_summary,700):customerSummary(raw),
   scope:b?.source==='ai'?asText(b.proposed_scope,400):'',
   createdAt:r.created_at,updatedAt:caseRow?.updated_at||r.created_at
  };
 });
}
