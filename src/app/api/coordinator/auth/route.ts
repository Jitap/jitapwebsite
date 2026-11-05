import {NextRequest} from 'next/server';
import {accessCookie,authConfig,isAllowedStaff,privateHeaders,reply,requireCoordinator,validOrigin} from '@/lib/coordinator-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const generic={ok:true,message:'If the email is authorized, a sign-in code will be sent.'};
export async function GET(req:NextRequest){
 try{const staff=await requireCoordinator(req);return reply(staff?{ok:true,staff}:{ok:false},staff?200:401)}
 catch{return reply({ok:false},503)}
}
export async function POST(req:NextRequest){
 if(!validOrigin(req))return reply({error:'Invalid origin'},403);
 let body:{action?:string;email?:string;token?:string}={};
 try{body=await req.json()}catch{return reply({error:'Invalid request'},400)}
 if(body.action==='logout'){
  const result=reply({ok:true});
  result.cookies.set(accessCookie,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});
  return result;
 }
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return reply({error:'Enter a valid email'},400);
 let staff;
 try{staff=await isAllowedStaff(email)}catch{return reply({error:'Sign-in unavailable'},503)}
 if(!staff)return reply(generic);
 const cfg=authConfig();
 if(body.action==='send'){
  try{
   const res=await fetch(cfg.url+'/auth/v1/otp',{method:'POST',headers:{apikey:cfg.anon,'Content-Type':'application/json'},body:JSON.stringify({email,create_user:true}),cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!res.ok)console.warn('Coordinator OTP provider error',{status:res.status});
  }catch{console.warn('Coordinator OTP transport failed')}
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
