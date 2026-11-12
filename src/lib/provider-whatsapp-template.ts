import 'server-only';
import {kapsoConfiguration} from '@/lib/kapso-server';
const allowedBase='https://api.kapso.ai/meta/whatsapp';
type Result={accepted:boolean;messageId?:string;reason?:string};
type Params={phone:string;reference:string;category:string;issue:string;token:string};
export function providerWhatsAppReady(){
 const config=kapsoConfiguration();
 return config.enabled&&config.configured&&!!process.env.KAPSO_TEMPLATE_PROVIDER_BUZZ;
}
export function customerSocWhatsAppReady(){
 const config=kapsoConfiguration();
 return config.enabled&&config.configured&&!!process.env.KAPSO_TEMPLATE_SOC_UPDATE;
}
async function templateSend(to:string,name:string,parameters:string[],buttonSuffix:string):Promise<Result>{
 if(!/^[a-z][a-z0-9_]{1,255}$/.test(name))return {accepted:false,reason:'invalid_template_name'};
 if(!/^254[17]\d{8}$/.test(to))return {accepted:false,reason:'invalid_recipient'};
 const key=process.env.KAPSO_API_KEY,numberId=process.env.KAPSO_PHONE_NUMBER_ID;
 if(!key||!numberId)return {accepted:false,reason:'kapso_not_configured'};
 const payload={messaging_product:'whatsapp',recipient_type:'individual',to,type:'template',template:{
  name,language:{code:process.env.KAPSO_TEMPLATE_LANGUAGE||'en_US'},
  components:[
   {type:'body',parameters:parameters.map(text=>({type:'text',text:text.slice(0,180)}))},
   {type:'button',sub_type:'url',index:'0',parameters:[{type:'text',text:buttonSuffix}]}
  ]
 }};
 // Approved templates MUST have exactly three body placeholders and URL button 0.
 const response=await fetch(allowedBase+'/v24.0/'+encodeURIComponent(numberId)+'/messages',{
  method:'POST',headers:{'X-API-Key':key,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify(payload),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)
 });
 const parsed=await response.json().catch(()=>({})) as {messages?:{id?:string}[];error?:{code?:number;message?:string}};
 const id=parsed.messages?.[0]?.id;
 if(response.ok&&id)return {accepted:true,messageId:id};
 return {accepted:false,reason:parsed.error?.code?'kapso_'+parsed.error.code:'kapso_http_'+response.status};
}
export async function sendKapsoProviderBuzz(input:Params):Promise<Result>{
 if(!providerWhatsAppReady())return {accepted:false,reason:'provider_template_not_ready'};
 // Template body: {{1}} reference, {{2}} service, {{3}} short issue.
 // Template URL button prefix MUST be https://jitap.app/buzz# and dynamic suffix {{1}} token.
 return templateSend(input.phone,process.env.KAPSO_TEMPLATE_PROVIDER_BUZZ!,[input.reference,input.category,input.issue],input.token);
}
export async function sendKapsoSocCustomerUpdate(input:{phone:string;reference:string;kind:string;message:string}):Promise<Result>{
 if(!customerSocWhatsAppReady())return {accepted:false,reason:'customer_template_not_ready'};
 // Approved template body: {{1}} reference, {{2}} update type, {{3}} concise update.
 // URL button prefix configured in Meta must resolve this reference's customer ticket.
 return templateSend(input.phone,process.env.KAPSO_TEMPLATE_SOC_UPDATE!,[input.reference,input.kind,input.message],input.reference);
}

/**
 * Provider acknowledgements and customer job-progress updates use TWO
 * independently approved Utility templates. Existing five lifecycle templates remain unchanged.
 * Body variables: {{1}} JT-reference, {{2}} provider name or service,
 * {{3}} explicit short service status/ETA. Dynamic URL-button suffix {{1}} = JT-reference.
 */
export type FollowupTemplateKind='provider_accepted'|'eta'|'on_my_way'|'arrived'|'completed';
const followupTemplateEnv:Record<FollowupTemplateKind,string>={
 provider_accepted:'KAPSO_TEMPLATE_PROVIDER_ACCEPTED',
 eta:'KAPSO_TEMPLATE_CUSTOMER_PROGRESS',
 on_my_way:'KAPSO_TEMPLATE_CUSTOMER_PROGRESS',
 arrived:'KAPSO_TEMPLATE_CUSTOMER_PROGRESS',
 completed:'KAPSO_TEMPLATE_CUSTOMER_PROGRESS'
};
export function followupTemplateReady(kind:FollowupTemplateKind){
 const name=process.env[followupTemplateEnv[kind]];
 const config=kapsoConfiguration();
 return config.enabled&&config.configured&&typeof name==='string'&&/^[a-z][a-z0-9_]{1,255}$/.test(name);
}
export async function sendJiTapFollowup(input:{phone:string;kind:FollowupTemplateKind;parameters:string[]}):Promise<Result>{
 if(!followupTemplateReady(input.kind))return {accepted:false,reason:'approved_'+input.kind+'_template_not_configured'};
 const params=input.parameters;
 if(params.length!==3||!/^JT-[0-9A-F]{8}$/.test(params[0]))return {accepted:false,reason:'invalid_followup_template_parameters'};
 // Template URL prefix (set in Meta) MUST be the same as the corresponding
 // customer ticket or provider dashboard destination, with {{1}} the JT ref.
 return templateSend(input.phone,process.env[followupTemplateEnv[input.kind]]!,params,params[0]);
}
