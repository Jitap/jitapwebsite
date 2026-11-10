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
  if(detail==='health'||detail==='deliveries'){
   const url=detail==='health'
    ?'https://api.kapso.ai/platform/v1/whatsapp/phone_numbers/'+id+'/health'
    :'https://api.kapso.ai/platform/v1/webhook_deliveries?period=24h&webhook_id=9c361acc-1576-4749-be99-e62c28c072c5&limit=20';
   const response=await fetch(url,{headers:{'X-API-Key':key,'Accept':'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok)return NextResponse.json({ok:false,detail,status:response.status},{status:502});
   const data=await response.json() as Record<string,unknown>;
   if(detail==='health'){
     const checks=Array.isArray(data.checks)?data.checks:[];
     return NextResponse.json({ok:true,detail,keys:Object.keys(data),
      checks:checks.map((item:unknown)=>{const x=item&&typeof item==='object'?item as Record<string,unknown>:{};return {name:x.name||x.key||x.type,status:x.status||x.state,passed:x.passed,description:typeof x.description==='string'?x.description.slice(0,160):null}}),
      status:data.status||data.state||null},{headers:{'Cache-Control':'no-store'}});
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
