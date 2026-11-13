import {NextResponse,type NextRequest} from 'next/server';
import {accountQuery,goTrue,isAccountType,normalizeKenyanPhone,sameOrigin,setAuthCookies} from '@/lib/jitap-auth';
import {isMobileClient} from '@/lib/jitap-session';
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
  if(input.consent!==true)return error('Please accept the JiTap Terms of Service and Privacy Policy.',422);
  // One verified phone sign-in for existing and new accounts. Supabase only
  // creates a new identity if the phone has not been registered before.
  const result=await goTrue('otp',{phone,create_user:true,channel:'sms'});
  if(!result.ok){
   if(result.status===429)return error('Too many code requests. Try again later.',429);
   if(result.status===503)return error('SMS login is currently unavailable. Please try again later.',503);
   if(result.status===400||result.status===422)return error('SMS sign-in is currently unavailable. Please try again or contact JiTap support.',result.status);
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
 // Confirm the token resolves to the same Supabase user and Kenyan mobile
 // instead of comparing raw phone strings, which can vary in E.164 formatting.
 const verified=await goTrue('user',undefined,access,'GET');
 if(!verified.ok)return error('Unable to confirm your verified account. Please try again.',401);
 const user=verified.data as {id?:string;phone?:string};
 const phoneFromAuth=normalizeKenyanPhone(user.phone);
 if(!user.id||!phoneFromAuth||phoneFromAuth!==phone)return error('Verification could not be completed.',401);
 const lookup=await accountQuery(access,'?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id,account_type,phone,full_name');
 if(!lookup.ok||!Array.isArray(lookup.data))return error('Unable to load your account. Please try again.',503);
 let account=lookup.data[0] as {account_type:string;phone:string;full_name:string|null}|undefined;
 if(!account){
  if(input.consent!==true)return error('Please accept the JiTap Terms of Service and Privacy Policy.',422);
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
 const requestedRole=input.role;
 // A verified customer may become a provider on the same account. Provider
 // onboarding remains separate from authentication and starts at /provider.
 if(requestedRole==='provider'&&account.account_type==='customer'){
  const url=process.env.SUPABASE_URL?.replace(/[/]$/,'');
  const key=process.env.SUPABASE_ANON_KEY;
  if(!url||!key)return error('Unable to activate provider onboarding right now.',503);
  try{
   const activated=await fetch(url+'/rest/v1/rpc/jitap_activate_provider_mode',{
    method:'POST',
    headers:{apikey:key,Authorization:'Bearer '+access,'Content-Type':'application/json'},
    body:'{}',cache:'no-store',signal:AbortSignal.timeout(9000)
   });
   if(!activated.ok)return error('Unable to activate provider onboarding. Please try again.',503);
  }catch{return error('Unable to activate provider onboarding. Please try again.',503)}
  account={...account,account_type:'provider'};
 }
 const expiresIn=Number(payload.expires_in)||3600;
 const refresh=String(payload.refresh_token);
 const body:Record<string,unknown>={
  authenticated:true,
  accountType:requestedRole,
  primaryAccountType:account.account_type,
  requestedRole,
  redirect:requestedRole==='provider'?'/provider':'/account'
 };
 if(isMobileClient(req)){
  body.accessToken=access;
  body.refreshToken=refresh;
  body.expiresIn=expiresIn;
 }
 const result=NextResponse.json(body,{headers:{'Cache-Control':'no-store'}});
 setAuthCookies(result,access,refresh,expiresIn);
 if(requestedRole==='customer'&&account.account_type==='provider')
  result.cookies.set('jt_mode','customer',{
   httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*30
  });
 else result.cookies.delete('jt_mode');
 return result;
}
