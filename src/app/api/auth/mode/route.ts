import {getReviewSession,setReviewSession} from '@/lib/jitap-review-session';
import {NextRequest,NextResponse} from 'next/server';
import {getProviderSession} from '@/lib/provider-session-server';
import {getCustomerIdentity} from '@/lib/customer-session-server';
import {sameOrigin,setAuthCookies} from '@/lib/jitap-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const error=(message:string,status:number)=>NextResponse.json({error:message},{status,headers});
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return error('Invalid origin',403);
 if(Number(req.headers.get('content-length')||0)>600)return error('Request too large',413);
 const data=await req.json().catch(()=>null) as {mode?:unknown}|null;
 const mode=data?.mode;
 if(mode!=='customer'&&mode!=='provider')return error('Choose customer or provider mode',422);
 if(getReviewSession(req)){
  const response=NextResponse.json({ok:true,reviewer:true,mode,redirect:mode==='provider'?'/provider':'/account'},{headers});
  setReviewSession(response,mode);
  return response;
 }
 const provider=await getProviderSession(req);
 const customer=provider?null:await getCustomerIdentity(req);
 const session=provider||(customer?.kind==='customer'?customer.identity:null);
 if(!session)return error('Please verify your mobile number to continue',401);
 if(mode==='provider'&&!provider){
  const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
  const key=process.env.SUPABASE_ANON_KEY;
  if(!url||!key)return error('Account switching temporarily unavailable',503);
  try{
   const result=await fetch(url+'/rest/v1/rpc/jitap_activate_provider_mode',{
    method:'POST',headers:{apikey:key,Authorization:'Bearer '+session.accessToken,'Content-Type':'application/json'},
    body:'{}',cache:'no-store',signal:AbortSignal.timeout(9000)
   });
   if(!result.ok)return error('Unable to activate provider access. Please try again.',result.status===403?403:503);
  }catch{return error('Unable to activate provider access. Please try again.',503)}
 }
 const response=NextResponse.json({ok:true,mode,redirect:mode==='provider'?'/provider':'/account'},{headers});
 if(mode==='customer')response.cookies.set('jt_mode','customer',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*30});
 else response.cookies.delete('jt_mode');
 if(session.rotated)setAuthCookies(response,session.rotated.access,session.rotated.refresh,session.rotated.expires);
 return response;
}
