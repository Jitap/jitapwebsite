// JiTap Wave Buzz native push dispatcher for Expo / EAS (FCM + APNs).
// Deployed in Supabase Edge Functions. No push tokens or customer information
// are written to logs; the caller secret lives only in Supabase Vault.
// Supabase Edge runs on Deno; website CI compiles this source with DOM types.
declare const Deno:{
 env:{get:(key:string)=>string|undefined};
 serve:(handler:(request:Request)=>Response|Promise<Response>)=>void;
};
type QueueJob={id:string;expo_push_token:string;platform:'android'|'ios';request_id:string;provider_user_id:string;expires_at:string;category:string};
type ReceiptJob={id:string;expo_ticket_id:string};
type ExpoTicket={status:'ok'|'error';id?:string;message?:string;details?:{error?:string}};
type ExpoReceipt={status:'ok'|'error';message?:string;details?:{error?:string}};
const supabaseUrl=Deno.env.get('SUPABASE_URL')?.replace(/\/$/,'')||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const expoAccessToken=Deno.env.get('EXPO_ACCESS_TOKEN')||'';
const NO_STORE={'Content-Type':'application/json','Cache-Control':'no-store'};
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:NO_STORE})}
async function rest<T>(path:string,init:RequestInit={}):Promise<T>{
 const response=await fetch(supabaseUrl+'/rest/v1/'+path,{
  ...init,headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json',...init.headers},
  cache:'no-store',signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw Error('database_http_'+response.status);
 const text=await response.text();return (text?JSON.parse(text):null) as T;
}
async function rpc<T>(name:string,body:unknown){
 return rest<T>('rpc/'+name,{method:'POST',body:JSON.stringify(body)});
}
async function update(id:string,fields:Record<string,unknown>){
 await rest('jitap_wave_push_outbox?id=eq.'+encodeURIComponent(id),{
  method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(fields)
 });
}
async function deactivate(token:string){
 await rest('jitap_push_devices?expo_push_token=eq.'+encodeURIComponent(token),{
  method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({enabled:false})
 });
}
function expoHeaders():HeadersInit{
 return {'Accept':'application/json','Content-Type':'application/json',
  ...(expoAccessToken?{Authorization:'Bearer '+expoAccessToken}:{})};
}
function errorCode(ticket?:{details?:{error?:string};message?:string}){
 const s=ticket?.details?.error;
 return typeof s==='string'&&s.length<70?s:'expo_delivery_failure';
}
async function sendOffers(token:string){
 const offers=await rpc<QueueJob[]>('jitap_claim_wave_push',{p_dispatch_secret:token,p_limit:40});
 if(!Array.isArray(offers)||!offers.length)return {claimed:0,submitted:0,failed:0,expired:0};
 const now=Date.now();
 const active=offers.filter(o=>Date.parse(o.expires_at)>now+800&&/^(Expo(nent)?PushToken)\[[A-Za-z0-9_-]{8,192}\]$/.test(o.expo_push_token));
 const excluded=offers.filter(o=>!active.includes(o));
 for(const o of excluded)await update(o.id,{state:'expired',processed_at:new Date().toISOString()}).catch(()=>{});
 if(!active.length)return {claimed:offers.length,submitted:0,failed:0,expired:excluded.length};
 const payload=active.map(o=>({
  to:o.expo_push_token,
  title:'JiTap BUZZ · New job nearby',
  body:'A '+o.category.replaceAll('-',' ').slice(0,48)+' request is available. Open JiTap to respond.',
  data:{type:'jitap_wave_buzz',requestId:o.request_id,expiresAt:o.expires_at},
  expiration:Math.floor(Date.parse(o.expires_at)/1000),
  priority:'high' as const,
  ...(o.platform==='android'?{channelId:'jitap-buzz'}:{sound:'default',interruptionLevel:'time-sensitive'}),
 }));
 let tickets:ExpoTicket[];
 try{
  const response=await fetch('https://exp.host/--/api/v2/push/send',{
   method:'POST',headers:expoHeaders(),body:JSON.stringify(payload),signal:AbortSignal.timeout(9000)
  });
  if(!response.ok)throw Error('expo_http_'+response.status);
  const result=await response.json() as {data?:ExpoTicket[]|ExpoTicket};
  tickets=Array.isArray(result.data)?result.data:result.data?[result.data]:[];
  if(tickets.length!==active.length)throw Error('expo_ticket_count_mismatch');
 }catch{
  // Ambiguous transport outcomes are not automatically retried: Expo may
  // have accepted the requests before the HTTP response was lost.
  for(const o of active)await update(o.id,{state:'failed',expo_error_code:'transport_or_ticket_unknown',processed_at:new Date().toISOString()}).catch(()=>{});
  return {claimed:offers.length,submitted:0,failed:active.length,expired:excluded.length};
 }
 let submitted=0,failed=0;
 for(let i=0;i<active.length;i++){
  const o=active[i],ticket=tickets[i];
  if(ticket?.status==='ok'&&ticket.id){
   submitted++;
   await update(o.id,{state:'submitted',expo_ticket_id:ticket.id,expo_error_code:null,processed_at:new Date().toISOString()}).catch(()=>{});
  }else{
   failed++;const code=errorCode(ticket);
   await update(o.id,{state:'failed',expo_error_code:code,processed_at:new Date().toISOString()}).catch(()=>{});
   if(code==='DeviceNotRegistered')await deactivate(o.expo_push_token).catch(()=>{});
  }
 }
 return {claimed:offers.length,submitted,failed,expired:excluded.length};
}
async function reconcile(token:string){
 const rows=await rpc<ReceiptJob[]>('jitap_claim_wave_receipts',{p_dispatch_secret:token,p_limit:50});
 if(!Array.isArray(rows)||!rows.length)return {checked:0,confirmedByProvider:0,failed:0};
 let receipts:Record<string,ExpoReceipt>;
 try{
  const response=await fetch('https://exp.host/--/api/v2/push/getReceipts',{
   method:'POST',headers:expoHeaders(),
   body:JSON.stringify({ids:rows.map(r=>r.expo_ticket_id)}),
   signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw Error('expo_receipt_http_'+response.status);
  const result=await response.json() as {data?:Record<string,ExpoReceipt>};
  receipts=result.data||{};
 }catch{
  // Keep an auditable unknown state rather than claiming delivery.
  for(const r of rows)await update(r.id,{state:'failed',expo_error_code:'receipt_unavailable',receipt_checked_at:new Date().toISOString()}).catch(()=>{});
  return {checked:rows.length,confirmedByProvider:0,failed:rows.length};
 }
 let confirmed=0,failed=0;
 for(const r of rows){
  const receipt=receipts[r.expo_ticket_id];
  if(receipt?.status==='ok'){confirmed++;await update(r.id,{state:'receipt_ok',receipt_checked_at:new Date().toISOString()}).catch(()=>{})}
  else{
   failed++;const code=receipt?errorCode(receipt):'receipt_missing';
   await update(r.id,{state:'failed',expo_error_code:code,receipt_checked_at:new Date().toISOString()}).catch(()=>{});
   if(code==='DeviceNotRegistered'){
    const record=await rest<{provider_user_id:string;device_id:string}[]>('jitap_wave_push_outbox?select=provider_user_id,device_id&id=eq.'+r.id+'&limit=1').catch(()=>[]);
    if(record[0])await rest('jitap_push_devices?provider_user_id=eq.'+record[0].provider_user_id+'&device_id=eq.'+record[0].device_id,{
     method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({enabled:false})
    }).catch(()=>{});
   }
  }
 }
 return {checked:rows.length,confirmedByProvider:confirmed,failed};
}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 if(!supabaseUrl||!serviceKey)return json({error:'Server configuration incomplete'},503);
 const token=req.headers.get('x-jitap-push-dispatch')||'';
 if(token.length<40||token.length>256)return json({error:'Unauthorized'},401);
 try{
  const allowed=await rpc<boolean>('jitap_push_authorized',{p_dispatch_secret:token});
  if(allowed!==true)return json({error:'Unauthorized'},401);
  // Run safe claim/send before receipt lookups. Called once every 5 seconds.
  const send=await sendOffers(token);
  const receipts=await reconcile(token);
  return json({ok:true,...send,...receipts});
 }catch{
  return json({error:'Dispatch temporarily unavailable'},503);
 }
});
