import {NextResponse,type NextRequest} from 'next/server';
import {accountQuery,goTrue,isAccountType,normalizeKenyanPhone,sameOrigin,setAuthCookies} from '@/lib/jitap-auth';
export const runtime='nodejs';
function error(message:string,status:number){return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}})}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return error('Invalid request origin.',403);
 const len=Number(req.headers.get('content-length')||0);if(len>3000)return error('Request too large.',413);
 let input:Record<string,unknown>;
 try{input=await req.json()}catch{return error('Invalid request.',400)}
 const phone=normalizeKenyanPhone(input.phone);
 if(!phone)return error('Enter a valid Kenyan mobile number.',422);
 if(!isAccountType(input.role))return error('Choose how you want to use JiTap.',422);
 if(input.action==='send'){
  const intent=input.intent==='login'?'login':'signup';
  if(intent==='signup'&&input.consent!==true)return error('Please accept the terms and privacy notice.',422);
  const result=await goTrue('otp',{phone,create_user:intent==='signup',channel:'sms'});
  if(!result.ok){
   if(result.status===429)return error('Too many code requests. Try again later.',429);
   if(result.status===503)return error('SMS login is currently unavailable. Please try again later.',503);
   if(result.status===400||result.status===422)return error(intent==='login'?'No account found, or SMS sign-in is not enabled.':'SMS sign-in is not yet enabled for JiTap. Please contact support.',result.status);
   return error('Unable to send a code right now. Please try again later.',502);
  }
  return NextResponse.json({sent:true,phone},{headers:{'Cache-Control':'no-store'}});
 }
 if(input.action!=='verify')return error('Unsupported action.',400);
 const code=typeof input.code==='string'?input.code.trim():'';
 if(!/^\d{6}$/.test(code))return error('Enter the six-digit verification code.',422);
 const verify=await goTrue('verify',{phone,token:code,type:'sms'});
 const payload=verify.data as Record<string,unknown>;
 if(!verify.ok||!payload?.access_token||!payload?.refresh_token||!payload?.user)return error('The code is invalid or has expired. Request a new code.',401);
 const access=String(payload.access_token);
 const user=payload.user as {id?:string;phone?:string};
 if(!user.id||user.phone!==phone)return error('Verification could not be completed.',401);
 const lookup=await accountQuery(access,'?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id,account_type,phone,full_name');
 if(!lookup.ok||!Array.isArray(lookup.data))return error('Unable to load your account. Please try again.',503);
 let account=lookup.data[0] as {account_type:string;phone:string;full_name:string|null}|undefined;
 if(!account){
  if(input.intent==='login')return error('No JiTap profile found. Please choose Sign up.',404);
  const fullName=typeof input.fullName==='string'?input.fullName.trim().slice(0,120):'';
  const create=await accountQuery(access,'','POST',{user_id:user.id,account_type:input.role,phone,full_name:fullName||null});
  if(create.ok&&Array.isArray(create.data)&&create.data.length)account=create.data[0];
  else {
   // A concurrent verification may have created this account.
   const retry=await accountQuery(access,'?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id,account_type,phone,full_name');
   if(retry.ok&&Array.isArray(retry.data))account=retry.data[0];
   if(!account)return error('We could not finish creating your account. Please retry.',503);
  }
 }
 if(!account||!isAccountType(account.account_type))return error('Account type is unavailable.',503);
 const result=NextResponse.json({authenticated:true,accountType:account.account_type,requestedRole:input.role,redirect:'/account'},{headers:{'Cache-Control':'no-store'}});
 setAuthCookies(result,access,String(payload.refresh_token),Number(payload.expires_in)||3600);
 return result;
}
