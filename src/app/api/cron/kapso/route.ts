import {NextRequest,NextResponse} from 'next/server';
import {supabasePrivate} from '@/lib/coordinator-server';
import {kapsoConfiguration,sendKapsoTemplate,type KapsoMessage} from '@/lib/kapso-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex'};
const response=(data:unknown,status=200)=>NextResponse.json(data,{headers,status});
export async function GET(req:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get('authorization')!=='Bearer '+secret)return response({error:'Unauthorized'},401);
 const config=kapsoConfiguration();
 if(!config.enabled||!config.configured||!config.signedWebhooks)
  return response({enabled:config.enabled,ready:false,reason:'kapso_configuration_incomplete'});
 if(Object.values(config.templates).some(v=>!v))
  return response({enabled:true,ready:false,reason:'approved_whatsapp_templates_not_configured',templates:config.templates});
 try{
  await supabasePrivate('rpc/jitap_kapso_restore_stale_processing',{method:'POST',body:'{}'});
  const jobs=await supabasePrivate<KapsoMessage[]>('rpc/jitap_kapso_claim',{method:'POST',body:JSON.stringify({p_limit:10})});
  let submitted=0,failed=0;
  for(const job of jobs){
   if(job.template_kind==='reminder'&&Date.now()-new Date(job.due_at).getTime()>2*3600000){
    await supabasePrivate('jitap_kapso_messages?id=eq.'+job.id,{method:'PATCH',
     body:JSON.stringify({status:'skipped',last_error:'reminder_expired',updated_at:new Date().toISOString()})});
    continue;
   }
   const sent=await sendKapsoTemplate(job);
   if(sent.accepted&&sent.messageId){
    submitted++;
    await supabasePrivate('jitap_kapso_messages?id=eq.'+job.id,{method:'PATCH',
     body:JSON.stringify({status:'submitted',provider_message_id:sent.messageId,submitted_at:new Date().toISOString(),updated_at:new Date().toISOString(),template_name:process.env[({booking:'KAPSO_TEMPLATE_BOOKING',reminder:'KAPSO_TEMPLATE_REMINDER',cancellation:'KAPSO_TEMPLATE_CANCELLATION',rematch:'KAPSO_TEMPLATE_REMATCH',reschedule:'KAPSO_TEMPLATE_RESCHEDULE'} as Record<string,string>)[job.template_kind]]||''})});
   }else{
    failed++;
    const terminal=job.attempt_count>=5||sent.reason==='missing_approved_template'||sent.reason==='invalid_recipient';
    await supabasePrivate('jitap_kapso_messages?id=eq.'+job.id,{method:'PATCH',
     body:JSON.stringify({status:terminal?'failed':'pending',last_error:sent.reason||'send_failed',
      due_at:new Date(Date.now()+Math.min(60,Math.pow(2,job.attempt_count))*60000).toISOString(),updated_at:new Date().toISOString()})});
   }
  }
  return response({ready:true,claimed:jobs.length,submitted,failed});
 }catch{return response({error:'Kapso dispatcher unavailable'},503)}
}
