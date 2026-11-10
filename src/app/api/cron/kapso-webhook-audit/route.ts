import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
export const runtime='nodejs';export const dynamic='force-dynamic';
function equalSecret(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export async function GET(req:NextRequest){
 const auth=req.headers.get('authorization')||'';
 const token=auth.startsWith('Bearer ')?auth.slice(7):'';
 const secret=process.env.KAPSO_DISPATCH_TOKEN;
 if(!secret||secret.length<32||!token||!equalSecret(token,secret))
  return NextResponse.json({error:'Unauthorized'},{status:401});
 const id=process.env.KAPSO_PHONE_NUMBER_ID;
 const key=process.env.KAPSO_API_KEY;
 if(!id||!/^\d{10,25}$/.test(id)||!key)
  return NextResponse.json({error:'Kapso configuration incomplete'},{status:503});
 try{
  const detail=req.nextUrl.searchParams.get('detail');
  if(detail==='health'||detail==='deliveries'||detail==='meta-logs'){
   const url=detail==='health'
    ?'https://api.kapso.ai/platform/v1/whatsapp/phone_numbers/'+id+'/health'
    :detail==='meta-logs'?'https://api.kapso.ai/platform/v1/log_search?period=24h&source=whatsapp_webhook_event&limit=15'
    :'https://api.kapso.ai/platform/v1/webhook_deliveries?period=24h&webhook_id=9c361acc-1576-4749-be99-e62c28c072c5&limit=20';
   const response=await fetch(url,{headers:{'X-API-Key':key,'Accept':'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok)return NextResponse.json({ok:false,detail,status:response.status},{status:502});
   const data=await response.json() as Record<string,unknown>;
   if(detail==='health'){
     const checks=Array.isArray(data.checks)?data.checks:Object.entries(data.checks&&typeof data.checks==='object'?data.checks:{}).map(([name,value])=>({...((value&&typeof value==='object')?value as Record<string,unknown>:{}),name}));
     return NextResponse.json({ok:true,detail,keys:Object.keys(data),
      checks:checks.map((item:unknown)=>{const x=item&&typeof item==='object'?item as Record<string,unknown>:{};const d=x.details&&typeof x.details==='object'?x.details as Record<string,unknown>:{};const entities=Array.isArray(d.entities)?d.entities:[];return {name:x.name||x.key||x.type,status:x.status||x.state,passed:x.passed,overall_status:x.overall_status||d.overall_status||null,
 error:typeof x.error==='string'?x.error.slice(0,250):null,
 details_status:d.status||null,
 entities:entities.slice(0,10).map((v:unknown)=>{const e=v&&typeof v==='object'?v as Record<string,unknown>:{};const errs=Array.isArray(e.errors)?e.errors:[];return {entity_type:e.entity_type||e.type,status:e.status||e.overall_status,can_send_message:e.can_send_message,
 additional_info:typeof e.additional_info==='string'?e.additional_info.slice(0,280):e.additional_info,
 errors:errs.slice(0,3).map((q:unknown)=>{const z=q&&typeof q==='object'?q as Record<string,unknown>:{};return {code:z.code,error_description:z.error_description,possible_solution:z.possible_solution}})};})
 }}),
      status:data.status||data.state||null},{headers:{'Cache-Control':'no-store'}});
   }
   if(detail==='meta-logs'){
     const hits=Array.isArray(data.data)?data.data:Array.isArray(data.logs)?data.logs:[];
     const logs=hits.slice(0,15).map((raw:unknown)=>{const x=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};return {timestamp:x.created_at||x.timestamp,source:x.source,event_type:x.event_type||x.event,status:x.status||x.http_status,keys:Object.keys(x).slice(0,16)}});
     return NextResponse.json({ok:true,detail,keys:Object.keys(data),count:hits.length,logs});
   }
   const entries=Array.isArray(data)?data:Array.isArray(data.webhook_deliveries)?data.webhook_deliveries:Array.isArray(data.data)?data.data:[];
   const deliveries=entries.slice(0,20).map((item:unknown)=>{const x=item&&typeof item==='object'?item as Record<string,unknown>:{};return {id:x.id,status:x.status,attempts:x.attempt_count||x.attempts,http_status:x.http_status||x.response_status||x.status_code,
     event:x.event_type||x.event,created_at:x.created_at,error_code:x.error_code||null};});
   return NextResponse.json({ok:true,detail,keys:Object.keys(data),count:entries.length,deliveries},{headers:{'Cache-Control':'no-store'}});
  }
  const url='https://api.kapso.ai/platform/v1/whatsapp/phone_numbers/'+id+'/webhooks';
  const response=await fetch(url,{headers:{'X-API-Key':key,'Accept':'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return NextResponse.json({ok:false,status:response.status},{status:502});
  const data=await response.json() as Record<string,unknown>;
  const raw=Array.isArray(data)?data:Array.isArray(data.webhooks)?data.webhooks:Array.isArray(data.data)?data.data:[];
  const webhooks=raw.map((item:unknown)=>{
   const w=item&&typeof item==='object'?item as Record<string,unknown>:{};
   return {id:String(w.id||''),url:typeof w.url==='string'?w.url:'',
    active:w.active===true,kind:String(w.kind||''),payload_version:String(w.payload_version||''),
    events:Array.isArray(w.events)?w.events.filter(e=>typeof e==='string'):[]};
  });
  return NextResponse.json({ok:true,phone_number_id:id,webhooks,shape:!Array.isArray(data)&&raw.length===0?Object.keys(data):undefined},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Kapso webhook audit unavailable'},{status:503});}
}
