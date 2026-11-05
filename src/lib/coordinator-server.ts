import 'server-only';
import {NextRequest,NextResponse} from 'next/server';

const SUPABASE_BASE_URL=process.env.SUPABASE_URL?.replace(/\/$/,'');
const SECRET=process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON=process.env.SUPABASE_ANON_KEY;
export const accessCookie='jitap_coordinator_access';
export const privateHeaders={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
export const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
export function validOrigin(request:NextRequest){
 const origin=request.headers.get('origin');
 if(!origin)return false;
 try{
  const url=new URL(origin);
  const expected=new URL(request.url);
  const host=request.headers.get('x-forwarded-host')||request.headers.get('host')||expected.host;
  return url.protocol==='https:' && (url.host===expected.host||url.host===host);
 }catch{return false}
}
export async function supabasePrivate<T>(path:string,init:RequestInit={}):Promise<T>{
 if(!SUPABASE_BASE_URL||!SECRET)throw new Error('Coordinator database not configured');
 const response=await fetch(SUPABASE_BASE_URL+'/rest/v1/'+path,{
  ...init,headers:{apikey:SECRET,Authorization:'Bearer '+SECRET,
   'Content-Type':'application/json',...init.headers},
  cache:'no-store',signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw new Error('private_db_'+response.status);
 if(response.status===204)return null as T;
 const text=await response.text();
 return text?JSON.parse(text) as T:null as T;
}
export type Staff={email:string;role:'admin'|'coordinator'};
export async function isAllowedStaff(email:string):Promise<Staff|null>{
 if(!email||email.length>254)return null;
 const records=await supabasePrivate<(Staff&{active:boolean})[]>('coordinator_staff?email=eq.'+encodeURIComponent(email.toLowerCase())+'&active=eq.true&select=email,role,active&limit=1');
 const found=records[0];
 return found?{email:found.email,role:found.role}:null;
}
export async function requireCoordinator(req:NextRequest):Promise<Staff|null>{
 const token=req.cookies.get(accessCookie)?.value;
 if(!token||!URL||!ANON)return null;
 const response=await fetch(URL+'/auth/v1/user',{headers:{apikey:ANON,Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(!response.ok)return null;
 const user=await response.json() as {email?:string;email_confirmed_at?:string};
 if(!user.email||!user.email_confirmed_at)return null;
 return isAllowedStaff(user.email);
}
export function authConfig(){
 if(!URL||!ANON||!SECRET)throw new Error('Coordinator authentication not configured');
 return {url:SUPABASE_BASE_URL,anon:ANON};
}
