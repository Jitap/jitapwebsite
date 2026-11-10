import {NextRequest,NextResponse} from 'next/server';
import {validateKapsoWebhook} from '@/lib/kapso-server';
import {supabasePrivate} from '@/lib/coordinator-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
type RecordValue=Record<string,unknown>;
const obj=(x:unknown):RecordValue=>x&&typeof x==='object'&&!Array.isArray(x)?x as RecordValue:{};
const arr=(x:unknown):unknown[]=>Array.isArray(x)?x:[];
const str=(x:unknown)=>typeof x==='string'?x:'';
const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest){
 const length=Number(req.headers.get('content-length')||0);
 if(length>1048576)return respond({error:'Event too large'},413);
 const raw=await req.text();
 if(raw.length>1048576)return respond({error:'Event too large'},413);
 if(!validateKapsoWebhook(raw,req.headers.get('x-webhook-signature')))
  return respond({error:'Invalid webhook signature'},401);
 let data:RecordValue;
 try{data=obj(JSON.parse(raw))}catch{return respond({error:'Malformed event'},400)}
 try{
  // Kapso v2 phone-number events contain message, conversation and phone_number_id;
  // event wrappers may place those fields in data or payload.
  const candidate=obj(data.data);
  const payload=Object.keys(candidate).length?candidate:Object.keys(obj(data.payload)).length?obj(data.payload):data;
  const phoneId=str(payload.phone_number_id)||str(data.phone_number_id);
  if(phoneId&&process.env.KAPSO_PHONE_NUMBER_ID&&phoneId!==process.env.KAPSO_PHONE_NUMBER_ID)
   return respond({received:true,ignored:'different_phone_number'});
  const event=str(data.event)||str(data.type)||str(payload.event)||str(payload.event_type);
  console.info('JiTap Kapso envelope fields',{
   top:Object.keys(data).slice(0,20),
   data:Object.keys(obj(data.data)).slice(0,20),
   payload:Object.keys(payload).slice(0,20),
   message:Object.keys(obj(payload.message)).slice(0,20),
   eventType:typeof data.event,
   typeType:typeof data.type
  });
  const statuses:{id:string;status:string;timestamp:string;error:string}[]=[];
  const inbound:{id:string;phone:string;preview:string}[]=[];
  const status=(x:RecordValue)=>{
   const id=str(x.id)||str(x.message_id)||str(x.messageId);
   const state=str(x.status).toLowerCase();
   if(id&&['sent','delivered','read','failed'].includes(state)){
    const errors=arr(x.errors).map(v=>obj(v));
    statuses.push({id,status:state,timestamp:String(x.timestamp||x.updated_at||''),
     error:String(errors[0]?.code||errors[0]?.title||x.error_code||'').slice(0,150)});
   }
  };
  const message=(x:RecordValue)=>{
   const conversation=obj(payload.conversation);
   const contact=obj(payload.contact);
   const from=str(x.from)||str(x.wa_id)||str(x.waId)||
    str(conversation.phone_number)||str(contact.wa_id);
   const id=str(x.id)||str(x.message_id);
   const body=str(obj(x.text).body)||str(x.body)||str(x.content)||str(obj(x.kapso).content);
   if(id&&from)inbound.push({id,phone:from,preview:body.slice(0,400)});
  };
  // Raw Meta Graph forwarding.
  for(const entry of arr(data.entry)){
   for(const change of arr(obj(entry).changes)){
    const value=obj(obj(change).value);
    for(const s of arr(value.statuses))status(obj(s));
    for(const m of arr(value.messages))message(obj(m));
   }
  }
  const nested=obj(payload.message);
  if(/status|delivered|read|failed|sent/.test(event)){
   const kapso=obj(nested.kapso);
   const historical=arr(kapso.statuses).map(v=>obj(v));
   const matching=historical.filter(s=>str(s.status).toLowerCase()===event.split('.').pop());
   const latest=matching[matching.length-1]||{};
   status({...payload,...nested,...latest,
    status:str(latest.status)||str(kapso.status)||str(payload.status)||
     (event.endsWith('delivered')?'delivered':event.endsWith('read')?'read':event.endsWith('failed')?'failed':event.endsWith('sent')?'sent':''),
    id:str(nested.id)||str(payload.message_id)||str(payload.id),
    timestamp:str(latest.timestamp)||str(nested.timestamp)||str(payload.occurred_at)});
  }
  if(event==='whatsapp.message.received'){
   message({...nested,
    id:str(nested.id)||str(payload.message_id)||str(payload.id),
    from:str(nested.from)||str(payload.from)||str(obj(payload.contact).wa_id)||
      str(obj(payload.conversation).phone_number),
    text:nested.text||payload.text,
    body:str(nested.body)||str(payload.body)||str(payload.content)||str(obj(nested.kapso).content)});
  }
  for(const s of statuses){
   const eventKey='status:'+s.id+':'+s.status+':'+s.timestamp;
   await supabasePrivate('rpc/jitap_kapso_record_receipt',{
    method:'POST',body:JSON.stringify({p_message_id:s.id,p_status:s.status,
     p_event_key:eventKey,p_error:s.error||null})
   });
  }
  for(const m of inbound){
   await supabasePrivate('rpc/jitap_kapso_record_inbound',{
    method:'POST',body:JSON.stringify({p_message_id:m.id,p_phone:m.phone,p_preview:m.preview})
   });
  }
  console.info('JiTap Kapso verified event processed',{event,receipt_count:statuses.length,inbound_count:inbound.length});
  return respond({received:true});
 }catch(e){
  console.error('JiTap Kapso verified webhook processing failure',e instanceof Error?e.message:'unknown');
  return respond({error:'Unable to record verified webhook'},503);
 }
}
