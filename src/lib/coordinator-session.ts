import 'server-only';
import {createHash,randomBytes} from 'node:crypto';
import type {NextRequest,NextResponse} from 'next/server';
import {accessCookie,supabasePrivate,type Staff,isAllowedStaff} from '@/lib/coordinator-server';

export const SOC_SESSION_SECONDS=90*86400;
const tokenPattern=/^soc_[a-zA-Z0-9_-]{43}$/;
type StoredSession={id:string;staff_email:string;expires_at:string;revoked_at:string|null;last_seen_at:string};
function digest(token:string){return createHash('sha256').update(token).digest('hex')}
function agentDigest(req:NextRequest){
 const agent=req.headers.get('user-agent')||'';
 return agent?createHash('sha256').update(agent.slice(0,400)).digest('hex'):null;
}
export async function issueSocSession(req:NextRequest,staff:Staff){
 const token='soc_'+randomBytes(32).toString('base64url');
 const now=new Date();
 const expires=new Date(now.getTime()+SOC_SESSION_SECONDS*1000);
 await supabasePrivate('jitap_coordinator_sessions',{method:'POST',headers:{Prefer:'return=minimal'},
  body:JSON.stringify({token_hash:digest(token),staff_email:staff.email.toLowerCase(),created_at:now.toISOString(),last_seen_at:now.toISOString(),expires_at:expires.toISOString(),user_agent_hash:agentDigest(req)})});
 return token;
}
export function setSocCookie(res:NextResponse,token:string){
 res.cookies.set(accessCookie,token,{
  httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:SOC_SESSION_SECONDS
 });
}
export async function lookupSocSession(token:string,req:NextRequest):Promise<Staff|null>{
 if(!tokenPattern.test(token))return null;
 const rows=await supabasePrivate<StoredSession[]>('jitap_coordinator_sessions?select=id,staff_email,expires_at,revoked_at,last_seen_at&token_hash=eq.'+digest(token)+'&revoked_at=is.null&limit=1');
 const session=rows[0];
 if(!session||new Date(session.expires_at).getTime()<=Date.now())return null;
 // Re-check live staff allowlist on every request, so suspended SOC access is revoked at once.
 const staff=await isAllowedStaff(session.staff_email);
 if(!staff)return null;
 return staff;
}
export async function renewSocSession(req:NextRequest,res:NextResponse){
 const token=req.cookies.get(accessCookie)?.value;
 if(!token||!tokenPattern.test(token))return;
 const hash=digest(token);
 const rows=await supabasePrivate<StoredSession[]>('jitap_coordinator_sessions?select=id,staff_email,expires_at,revoked_at,last_seen_at&token_hash=eq.'+hash+'&revoked_at=is.null&limit=1');
 const session=rows[0];
 if(!session||new Date(session.expires_at).getTime()<=Date.now())return;
 // Touch on authenticated /auth GET only, and no more than once daily.
 if(Date.now()-Date.parse(session.last_seen_at)<86400000)return;
 await supabasePrivate('jitap_coordinator_sessions?id=eq.'+session.id+'&revoked_at=is.null',{
  method:'PATCH',headers:{Prefer:'return=minimal'},
  body:JSON.stringify({last_seen_at:new Date().toISOString(),expires_at:new Date(Date.now()+SOC_SESSION_SECONDS*1000).toISOString()})
 });
 setSocCookie(res,token);
}
export async function revokeSocSession(token:string){
 if(!tokenPattern.test(token))return;
 await supabasePrivate('jitap_coordinator_sessions?token_hash=eq.'+digest(token)+'&revoked_at=is.null',{
  method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({revoked_at:new Date().toISOString()})
 });
}
