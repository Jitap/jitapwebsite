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
