import {NextResponse} from 'next/server';
const phoneRegex=/^\+254[17][0-9]{8}$/;
export type AccountType='customer'|'provider';
export function normalizeKenyanPhone(value:unknown){
 if(typeof value!=='string')return null;
 const digits=value.replace(/[\s()\-]/g,'');
 let normalized=digits;
 if(/^0[17]\d{8}$/.test(normalized))normalized='+254'+normalized.slice(1);
 else if(/^254[17]\d{8}$/.test(normalized))normalized='+'+normalized;
 else if(/^[17]\d{8}$/.test(normalized))normalized='+254'+normalized;
 return phoneRegex.test(normalized)?normalized:null;
}
export function isAccountType(value:unknown):value is AccountType{return value==='provider'||value==='customer'}
function settings(){
 const url=process.env.SUPABASE_URL||'';
 const key=process.env.SUPABASE_ANON_KEY||'';
 if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/.test(url)||!key)return null;
 return {url:url.replace(/\/$/,''),key};
}
export function isAuthConfigured(){return !!settings()}
export async function goTrue(path:string,body?:Record<string,unknown>,token?:string,method='POST'){
 const c=settings();if(!c)return {ok:false,status:503,data:{message:'Phone sign-in is not configured yet.'}};
 try{
  const response=await fetch(c.url+'/auth/v1/'+path,{method,headers:{apikey:c.key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  return {ok:response.ok,status:response.status,data};
 }catch{return {ok:false,status:503,data:{message:'The sign-in service is temporarily unavailable.'}}}
}
export async function accountQuery(token:string,path:string,method='GET',body?:Record<string,unknown>){
 const c=settings();if(!c)return {ok:false,status:503,data:null};
 try{
  const r=await fetch(c.url+'/rest/v1/jitap_accounts'+path,{method,headers:{apikey:c.key,Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json',...(method!=='GET'?{Prefer:'return=representation'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
  return {ok:r.ok,status:r.status,data:await r.json().catch(()=>null)};
 }catch{return {ok:false,status:503,data:null}}
}
export function setAuthCookies(response:NextResponse,access:string,refresh:string,expires=3600){
 const opts={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/'};
 response.cookies.set('jt_access',access,{...opts,maxAge:Math.min(Math.max(60,expires),3600)});
 response.cookies.set('jt_refresh',refresh,{...opts,maxAge:60*60*24*30});
}
export function clearAuthCookies(response:NextResponse){
 response.cookies.set('jt_access','',{path:'/',maxAge:0,httpOnly:true});
 response.cookies.set('jt_refresh','',{path:'/',maxAge:0,httpOnly:true});
}
export function sameOrigin(req:Request){
 const origin=req.headers.get('origin');if(!origin)return true;
 try{const o=new URL(origin);const h=req.headers.get('x-forwarded-host')||req.headers.get('host')||'';return o.host===h&&o.protocol==='https:' || (process.env.NODE_ENV!=='production'&&o.host===h&&o.protocol==='http:')}catch{return false}
}
