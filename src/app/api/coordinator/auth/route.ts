import {NextRequest} from 'next/server';
import {accessCookie,authConfig,isAllowedStaff,reply,requireCoordinator,validOrigin} from '@/lib/coordinator-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const generic={ok:true,message:'If the email is authorized, a sign-in email will be sent.'};
export async function GET(req:NextRequest){
 try{const staff=await requireCoordinator(req);return reply(staff?{ok:true,staff}:{ok:false},staff?200:401)}
 catch{return reply({ok:false},503)}
}
export async function POST(req:NextRequest){
 if(!validOrigin(req))return reply({error:'Invalid origin'},403);
 let body:{action?:string;email?:string;token?:string;accessToken?:string;next?:string}={};
 try{body=await req.json()}catch{return reply({error:'Invalid request'},400)}
 if(body.action==='logout'){
  const result=reply({ok:true});
  result.cookies.set(accessCookie,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});
  return result;
 }
 if(body.action==='link'){
  const accessToken=typeof body.accessToken==='string'?body.accessToken:'';
  if(accessToken.length<40||accessToken.length>6000)return reply({error:'Invalid sign-in token'},400);
  try{
   const cfg=authConfig();
   const result=await fetch(cfg.url+'/auth/v1/user',{
    headers:{apikey:cfg.anon,Authorization:'Bearer '+accessToken},
    cache:'no-store',signal:AbortSignal.timeout(8000)
   });
   if(!result.ok)return reply({error:'Your sign-in link has expired. Request a new one.'},401);
   const user=await result.json() as {email?:string;email_confirmed_at?:string;exp?:number};
   if(!user.email||!user.email_confirmed_at)return reply({error:'Email verification required'},403);
   const staff=await isAllowedStaff(user.email);
   if(!staff)return reply({error:'Not authorized'},403);
   const response=reply({ok:true,staff});
   response.cookies.set(accessCookie,accessToken,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:3600});
   return response;
  }catch{return reply({error:'Unable to verify your sign-in link'},503)}
 }
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return reply({error:'Enter a valid email'},400);
 let staff;
 try{staff=await isAllowedStaff(email)}catch{return reply({error:'Sign-in unavailable'},503)}
 if(!staff)return reply(generic);
 const cfg=authConfig();
 if(body.action==='send'){
  try{
   const res=await fetch(cfg.url+'/auth/v1/otp?redirect_to='+encodeURIComponent('https://www.jitap.app/coordinator'+(body.next==='/coordinator/providers'?'?next=%2Fcoordinator%2Fproviders':'')),{method:'POST',headers:{apikey:cfg.anon,'Content-Type':'application/json'},body:JSON.stringify({email,create_user:true}),cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(res.status===429){
    console.warn('Coordinator sign-in email rate limited',{status:429});
    const seconds=Number(res.headers.get('retry-after')||'');
    const headers={'Retry-After':String(Number.isFinite(seconds)&&seconds>0?Math.min(seconds,3600):3600)};
    return new Response(JSON.stringify({error:'Supabase has reached its email sending limit. Please try again later or configure custom SMTP for reliable JiTap staff sign-in.',code:'email_rate_limited'}),{status:429,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
   }
   if(!res.ok){
    console.warn('Coordinator OTP provider error',{status:res.status});
    return reply({error:'Supabase could not send the email. Please check the Auth email delivery settings.',code:'email_provider_unavailable'},503);
   }
  }catch{
   console.warn('Coordinator OTP transport failed');
   return reply({error:'The email service could not be reached. Please retry later.'},503);
  }
  return reply(generic);
 }
 if(body.action==='verify'){
  const token=typeof body.token==='string'?body.token.trim():'';
  if(!/^\d{6,8}$/.test(token))return reply({error:'Enter the code from your email'},400);
  try{
   const verify=await fetch(cfg.url+'/auth/v1/verify',{method:'POST',headers:{apikey:cfg.anon,'Content-Type':'application/json'},body:JSON.stringify({email,token,type:'email'}),cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!verify.ok)return reply({error:'Code invalid or expired'},401);
   const data=await verify.json() as {access_token?:string;expires_in?:number;user?:{email?:string;email_confirmed_at?:string}};
   if(!data.access_token||data.user?.email?.toLowerCase()!==email||!data.user?.email_confirmed_at)return reply({error:'Account verification failed'},403);
   const allowed=await isAllowedStaff(data.user.email);
   if(!allowed)return reply({error:'Access not authorized'},403);
   const response=reply({ok:true,staff:allowed});
   response.cookies.set(accessCookie,data.access_token,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:Math.min(data.expires_in||3600,3600)});
   return response;
  }catch{return reply({error:'Could not verify code'},503)}
 }
 return reply({error:'Unknown operation'},400);
}
