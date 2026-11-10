import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
export const runtime='nodejs';export const dynamic='force-dynamic';
const jitapWebhook='9c361acc-1576-4749-be99-e62c28c072c5';
const invalidWebhook='7cedba89-455c-4f08-b632-78ab80fb1b25';
const base='https://api.kapso.ai';
function secureEq(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export async function POST(req:NextRequest){
 const auth=req.headers.get('authorization')||'';
 const token=auth.startsWith('Bearer ')?auth.slice(7):'';
 const secret=process.env.KAPSO_DISPATCH_TOKEN;
 if(!secret||secret.length<32||!token||!secureEq(token,secret))
  return NextResponse.json({error:'Unauthorized'},{status:401});
 if(process.env.KAPSO_PHONE_NUMBER_ID!=='1396670293535348'||!process.env.KAPSO_API_KEY)
  return NextResponse.json({error:'JiTap phone not configured'},{status:503});
 let action:string;
 try{const body=await req.json() as {action?:string};action=body.action||'';}catch{return NextResponse.json({error:'Invalid body'},{status:400});}
 if(!['test-jitap-webhook','disable-invalid-webhook'].includes(action))
  return NextResponse.json({error:'Unsupported action'},{status:400});
 const headers={'X-API-Key':process.env.KAPSO_API_KEY,'Content-Type':'application/json','Accept':'application/json'};
 try{
  const source=await fetch(base+'/platform/v1/whatsapp/phone_numbers/1396670293535348/webhooks',{headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!source.ok)return NextResponse.json({error:'Webhook lookup failed',upstream_status:source.status},{status:502});
  const result=await source.json() as Record<string,unknown>;
  const raw=Array.isArray(result.webhooks)?result.webhooks:Array.isArray(result.data)?result.data:[];
  const all=raw as Record<string,unknown>[];
  const id=action==='test-jitap-webhook'?jitapWebhook:invalidWebhook;
  const row=all.find(w=>w.id===id);
  const expected=action==='test-jitap-webhook'?'https://www.jitap.app/api/webhooks/kapso':'https://api.kapso.ai/meta/whatsapp';
  if(!row||row.url!==expected)return NextResponse.json({error:'Webhook target mismatch'},{status:409});
  if(action==='disable-invalid-webhook'&&row.active!==true)return NextResponse.json({ok:true,already_inactive:true});
  const url=action==='test-jitap-webhook'
    ?base+'/platform/v1/whatsapp/webhooks/'+jitapWebhook+'/test?event_type=whatsapp.message.received'
    :base+'/platform/v1/whatsapp/phone_numbers/1396670293535348/webhooks/'+invalidWebhook;
  const response=await fetch(url,{method:action==='test-jitap-webhook'?'POST':'PATCH',headers,
    body:action==='test-jitap-webhook'?undefined:JSON.stringify({whatsapp_webhook:{active:false}}),
    redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)return NextResponse.json({ok:false,action,upstream_status:response.status},{status:502});
  return NextResponse.json({ok:true,action,upstream_status:response.status},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Kapso request failed'},{status:503});}
}
