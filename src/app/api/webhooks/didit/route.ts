import {NextRequest,NextResponse} from 'next/server';
import {diditConfig,diditVerifyWebhook,isDiditStatus} from '@/lib/didit-server';
import {supabasePrivate} from '@/lib/coordinator-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
type Payload={event_id?:unknown;webhook_type?:unknown;session_id?:unknown;status?:unknown;
 workflow_id?:unknown;environment?:unknown;vendor_data?:unknown};
export async function POST(req:NextRequest){
 if(Number(req.headers.get('content-length')||0)>262144)return reply({error:'Payload too large'},413);
 const raw=await req.text();
 if(raw.length>262144)return reply({error:'Payload too large'},413);
 const cfg=diditConfig();
 if(!cfg.enabled||!cfg.configured)return reply({error:'Didit verification not active'},503);
 if(!diditVerifyWebhook(raw,req.headers))return reply({error:'Invalid webhook signature'},401);
 let p:Payload;
 try{p=JSON.parse(raw) as Payload}catch{return reply({error:'Invalid JSON'},400)}
 // Didit's 'Try Webhook' may contain sample identities. Never let it update
 // production state, even if signed by Didit.
 if(req.headers.get('x-didit-test-webhook')==='true')return reply({received:true,test:true});
 if(!p||p.webhook_type!=='status.updated')return reply({received:true,ignored:true});
 if(typeof p.event_id!=='string'||!/^[a-f\d-]{36}$/i.test(p.event_id)
 ||typeof p.session_id!=='string'||!/^[a-f\d-]{36}$/i.test(p.session_id)
 ||!isDiditStatus(p.status)||p.workflow_id!==cfg.workflow
 ||p.environment!==cfg.environment||typeof p.vendor_data!=='string'
 ||!/^[a-f\d-]{36}$/i.test(p.vendor_data))return reply({received:true,ignored:true});
 try{
  // Match signed session AND bound provider, not caller-controlled vendor data.
  const rows=await supabasePrivate<{id:string}[]>('jitap_provider_kyc_sessions?didit_session_id=eq.'+
   encodeURIComponent(p.session_id)+'&select=id&limit=1');
  if(rows[0]?.id!==p.vendor_data)return reply({received:true,ignored:true});
  await supabasePrivate('rpc/jitap_didit_apply_event',{method:'POST',
   body:JSON.stringify({p_event_id:p.event_id,p_session_id:p.session_id,
    p_status:p.status,p_workflow_id:p.workflow_id,p_environment:p.environment})});
  return reply({received:true});
 }catch{return reply({error:'Unable to save verification event'},503)}
}
