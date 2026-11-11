import {NextRequest,NextResponse} from 'next/server';
import {getReviewSession} from '@/lib/jitap-review-session';
import {getCustomerIdentity} from '@/lib/customer-session-server';
import {getProviderSession} from '@/lib/provider-session-server';
import {normalizeKenyanPhone,sameOrigin,setAuthCookies} from '@/lib/jitap-auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
type Json=Record<string,unknown>;
type Role='customer'|'provider';
async function identity(req:NextRequest):Promise<{token:string;role:Role;rotated?:{access:string;refresh:string;expires:number}}|null>{
 const provider=await getProviderSession(req);
 if(provider){
  if(req.cookies.get('jt_mode')?.value==='customer')
   return {token:provider.accessToken,role:'customer',rotated:provider.rotated};
  return {token:provider.accessToken,role:'provider',rotated:provider.rotated};
 }
 const customer=await getCustomerIdentity(req);
 return customer.kind==='customer'?{token:customer.identity.accessToken,role:'customer',rotated:customer.identity.rotated}:null;
}
function respond(data:Json,status=200,rotated?:{access:string;refresh:string;expires:number}){
 const response=NextResponse.json(data,{status,headers});
 if(rotated)setAuthCookies(response,rotated.access,rotated.refresh,rotated.expires);
 return response;
}
async function rpc(token:string,name:string,payload:Json={}){
 const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)return {ok:false,status:503,data:{message:'Network service unavailable'}};
 try{
  const response=await fetch(url+'/rest/v1/rpc/'+name,{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify(payload),cache:'no-store',signal:AbortSignal.timeout(8000)
  });
  const data=await response.json().catch(()=>({}));
  return {ok:response.ok,status:response.status,data};
 }catch{return {ok:false,status:503,data:{message:'Network service temporarily unavailable'}}}
}
const error=(message:string,status:number)=>respond({error:message},status);
export async function GET(req:NextRequest){
 const review=getReviewSession(req);
 if(review)return respond(review.role==='customer'?{
  ok:true,reviewer:true,role:'customer',connections:[],invites:[]
 }:{ok:true,reviewer:true,role:'provider',discoverable:false,connections:[]});
 const who=await identity(req);
 if(!who)return error('Sign in to access your network.',401);
 const result=await rpc(who.token,'jitap_network_state');
 if(!result.ok)return error('Unable to load your network. Try again.',503);
 const state=result.data&&typeof result.data==='object'?result.data as Json:{};
 return respond({ok:true,...state,role:who.role},200,who.rotated);
}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return error('Invalid origin',403);
 const length=Number(req.headers.get('content-length')||0);
 if(length>2000)return error('Request too large',413);
 if(getReviewSession(req))return error('Design review does not change live network records.',403);
 const who=await identity(req);
 if(!who)return error('Sign in to access your network.',401);
 const body=await req.json().catch(()=>null) as Json|null;
 if(!body||typeof body.action!=='string')return error('Invalid action',422);
 const action=body.action;
 let name:string;let payload:Json={};
 if(action==='match'){
  if(who.role!=='customer')return error('Customer mode required',403);
  const phone=normalizeKenyanPhone(body.phone);
  if(!phone)return error('Enter a valid Kenyan mobile number',422);
  name='jitap_network_match';payload={p_phone:phone};
 }else if(action==='request'){
  if(who.role!=='customer')return error('Customer mode required',403);
  if(typeof body.providerId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.providerId))return error('Invalid provider',422);
  name='jitap_network_request';payload={p_provider_id:body.providerId};
 }else if(action==='decide'){
  if(who.role!=='provider')return error('Provider mode required',403);
  if(typeof body.customerId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.customerId))return error('Invalid customer',422);
  if(!['accepted','declined','blocked'].includes(String(body.decision)))return error('Invalid decision',422);
  name='jitap_network_decide';payload={p_customer_id:body.customerId,p_decision:body.decision};
 }else if(action==='discovery'){
  if(who.role!=='provider')return error('Provider mode required',403);
  if(typeof body.enabled!=='boolean')return error('Choose a discovery preference',422);
  name='jitap_network_set_discovery';payload={p_enabled:body.enabled};
 }else if(action==='save'){
  if(who.role!=='customer')return error('Customer mode required',403);
  if(typeof body.providerId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.providerId))return error('Invalid provider',422);
  if(typeof body.saved!=='boolean')return error('Invalid saved state',422);
  name='jitap_network_save';payload={p_provider_id:body.providerId,p_saved:body.saved};
 }else if(action==='invite'){
  if(who.role!=='customer')return error('Customer mode required',403);
  name='jitap_network_invite';
 }else if(action==='claim'){
  if(who.role!=='provider')return error('Provider mode required',403);
  if(typeof body.inviteId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.inviteId))return error('Invalid invitation',422);
  name='jitap_network_claim_invite';payload={p_invite_id:body.inviteId};
 }else return error('Unknown network action',422);
 const result=await rpc(who.token,name,payload);
 if(!result.ok){
  const text=typeof (result.data as Json)?.message==='string'?String((result.data as Json).message):'Unable to complete this action.';
  const safe=/limit reached|not found|not available|already claimed|cannot connect|invalid decision|invalid invitation|authentication required|provider authentication|required|pending request/i.test(text)?text:'Unable to complete this action. Please try again.';
  return error(safe,result.status===400||result.status===409?422:result.status===401?401:503);
 }
 return respond({ok:true,...(result.data as Json)},200,who.rotated);
}
