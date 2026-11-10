import type {CustomerTicket} from '@/components/CustomerTicketCard';

/** Active requests are determined from canonical backend status fields, never the display label. */
const terminal=new Set([
 'completed','finished','done','cancelled','canceled','closed','archived',
 'rejected','declined','expired','failed','rematch_declined'
]);
const attention=new Set(['incomplete','rematch_approval','needs_customer_action','awaiting_customer']);
export function isActiveServiceRequest(ticket:Pick<CustomerTicket,'status'>):boolean{
 const status=(ticket.status||'').toLowerCase().trim().replace(/[\s-]+/g,'_');
 return !terminal.has(status);
}
function timestamp(value:string):number{
 const parsed=Date.parse(value||'');
 return Number.isFinite(parsed)?parsed:0;
}
/** Customer decisions take priority, then the most recently updated request. */
export function prioritizeActiveRequests(requests:CustomerTicket[]):CustomerTicket[]{
 return requests.filter(isActiveServiceRequest).sort((a,b)=>{
  const aUrgent=a.rematch||attention.has(a.status)?1:0;
  const bUrgent=b.rematch||attention.has(b.status)?1:0;
  return bUrgent-aUrgent||
   timestamp(b.updatedAt)-timestamp(a.updatedAt)||
   timestamp(b.createdAt)-timestamp(a.createdAt)||
   a.reference.localeCompare(b.reference);
 });
}
