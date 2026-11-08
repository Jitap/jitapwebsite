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
   const from=str(x.from)||str(x.wa_id)||str(x.waId);
   const id=str(x.id)||str(x.message_id);
   const body=str(obj(x.text).body)||str(x.body)||str(x.content);
   if(id&&from)inbound.push({id,phone:from,preview:body.slice(0,400)});
  };
  // Kapso can forward Meta Graph events with statuses or provide phone-level
  // whatsapp.message.* events. Both are accepted only after HMAC verification.
  for(const entry of arr(data.entry)){
   for(const change of arr(obj(entry).changes)){
    const value=obj(obj(change).value);
    for(const s of arr(value.statuses))status(obj(s));
    for(const m of arr(value.messages))message(obj(m));
   }
  }
  const event=str(data.event)||str(data.type);
  const payload=obj(data.data);
  if(/status|delivered|read|failed|sent/.test(event)){
   const nested=obj(payload.message);
   status({...payload,...nested,status:str(payload.status)||str(nested.status)||
    (event.endsWith('delivered')?'delivered':event.endsWith('read')?'read':event.endsWith('failed')?'failed':event.endsWith('sent')?'sent':''),
    id:str(payload.message_id)||str(payload.messageId)||str(nested.id)||str(payload.id)});
  }
  if(event==='whatsapp.message.received'){
   const nested=obj(payload.message);
   message({...payload,...nested,
    id:str(nested.id)||str(payload.message_id)||str(payload.id),
    from:str(nested.from)||str(payload.from)||str(obj(payload.contact).wa_id),
    text:nested.text||payload.text,
    body:str(nested.body)||str(payload.body)||str(payload.content)});
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
  return respond({received:true});
 }catch{return respond({error:'Unable to record verified webhook'},503)}
}
