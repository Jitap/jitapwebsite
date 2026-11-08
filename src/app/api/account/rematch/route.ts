import {NextRequest,NextResponse,after} from 'next/server';
import {dispatchKapsoQueue} from '@/lib/kapso-dispatcher';
import {z} from 'zod';
import {getCustomerIdentity} from '@/lib/customer-session-server';
import {sameOrigin,setAuthCookies} from '@/lib/jitap-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const schema=z.object({requestId:z.string().uuid(),approve:z.boolean()}).strict();
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return reply({error:'Invalid origin'},403);
 if(Number(req.headers.get('content-length')||0)>1200)return reply({error:'Request too large'},413);
 const session=await getCustomerIdentity(req);
 if(session.kind!=='customer')return reply({error:'Sign in using the customer phone number associated with this request'},401);
 const input=schema.safeParse(await req.json().catch(()=>null));
 if(!input.success)return reply({error:'Invalid rematch decision'},422);
 const url=process.env.SUPABASE_URL?.replace(/[/]$/,'');
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)return reply({error:'Rematching temporarily unavailable'},503);
 try{
  const response=await fetch(url+'/rest/v1/rpc/jitap_customer_decide_rematch',{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+session.identity.accessToken,'Content-Type':'application/json'},
   body:JSON.stringify({p_request_id:input.data.requestId,p_approve:input.data.approve}),
   cache:'no-store',signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)return reply({error:response.status===403?'This request is not linked to your verified phone':'This rematch request has already been handled or is unavailable'},409);
  const out=reply({ok:true,rematchApproved:input.data.approve,
   message:input.data.approve?'Your request is open again to eligible providers.':'Your request has been closed and will not be rematched.'});
  if(session.identity.rotated)setAuthCookies(out,session.identity.rotated.access,session.identity.rotated.refresh,session.identity.rotated.expires);
  after(async()=>{await dispatchKapsoQueue(3).catch(()=>{})});
  return out;
 }catch{return reply({error:'Unable to save rematch decision'},503)}
}
