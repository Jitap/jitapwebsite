import 'server-only';
import {supabasePrivate} from '@/lib/coordinator-server';
import {kapsoConfiguration,sendKapsoTemplate,type KapsoMessage} from '@/lib/kapso-server';

const templateKeys:Record<string,string>={
 booking:'KAPSO_TEMPLATE_BOOKING',reminder:'KAPSO_TEMPLATE_REMINDER',
 cancellation:'KAPSO_TEMPLATE_CANCELLATION',rematch:'KAPSO_TEMPLATE_REMATCH',
 reschedule:'KAPSO_TEMPLATE_RESCHEDULE'
};
export async function dispatchKapsoQueue(limit=10,requestId?:string){
 const config=kapsoConfiguration();
 if(!config.enabled||!config.configured||!config.signedWebhooks)
  return {ready:false,reason:'kapso_configuration_incomplete',enabled:config.enabled};
 if(Object.values(config.templates).some(v=>!v))
  return {ready:false,reason:'approved_whatsapp_templates_not_configured',templates:config.templates};
 await supabasePrivate('rpc/jitap_kapso_restore_stale_processing',{method:'POST',body:'{}'});
 const jobs=await supabasePrivate<KapsoMessage[]>(requestId?'rpc/jitap_kapso_claim_case':'rpc/jitap_kapso_claim',{
  method:'POST',body:JSON.stringify(requestId?{p_request_id:requestId,p_limit:limit}:{p_limit:limit})
 });
 let submitted=0,failed=0,skipped=0;
 for(const job of jobs){
  if(job.template_kind==='reminder'&&Date.now()-new Date(job.due_at).getTime()>2*3600000){
   skipped++;
   await supabasePrivate('jitap_kapso_messages?id=eq.'+job.id,{
    method:'PATCH',body:JSON.stringify({status:'skipped',last_error:'reminder_expired',updated_at:new Date().toISOString()})
   });
   continue;
  }
  const result=await sendKapsoTemplate(job);
  if(result.accepted&&result.messageId){
   submitted++;
   await supabasePrivate('jitap_kapso_messages?id=eq.'+job.id,{
    method:'PATCH',body:JSON.stringify({status:'submitted',
     provider_message_id:result.messageId,submitted_at:new Date().toISOString(),
     template_name:process.env[templateKeys[job.template_kind]]||'',updated_at:new Date().toISOString()})
   });
  }else{
   failed++;
   const terminal=job.attempt_count>=5||result.reason==='missing_approved_template'||result.reason==='invalid_recipient'||result.reason==='kapso_transport_error'||/^kapso_http_5\\d\\d$/.test(result.reason||'');
   await supabasePrivate('jitap_kapso_messages?id=eq.'+job.id,{
    method:'PATCH',body:JSON.stringify({status:terminal?'failed':'pending',last_error:result.reason==='kapso_transport_error'?'submission_unknown_reconcile_before_resend':result.reason||'send_failed',
     due_at:new Date(Date.now()+Math.min(60,Math.pow(2,job.attempt_count))*60000).toISOString(),
     updated_at:new Date().toISOString()})
   });
  }
 }
 return {ready:true,claimed:jobs.length,submitted,failed,skipped};
}
