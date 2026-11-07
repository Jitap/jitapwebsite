import type {NextRequest} from 'next/server';
import {accountQuery,goTrue,normalizeKenyanPhone} from '@/lib/jitap-auth';

export type CustomerIdentity={
 userId:string;
 accessToken:string;
 phone:string;
 fullName:string|null;
 // On refresh the caller must set rotated cookies on the final response.
 rotated?:{access:string;refresh:string;expires:number};
};
export type CustomerIdentityResult=
 |{kind:'guest'}
 |{kind:'invalid'}
 |{kind:'provider'}
 |{kind:'customer';identity:CustomerIdentity};

// The cookie itself is never trusted. Supabase verifies its bearer token,
// and our account profile determines which kind of user can own requests.
export async function getCustomerIdentity(req:NextRequest):Promise<CustomerIdentityResult>{
 let token=req.cookies.get('jt_access')?.value;
 const refresh=req.cookies.get('jt_refresh')?.value;
 if(!token&&!refresh)return {kind:'guest'};
 let user=token?await goTrue('user',undefined,token,'GET'):null;
 let rotated:CustomerIdentity['rotated'];
 if(!user?.ok&&refresh){
  const fresh=await goTrue('token?grant_type=refresh_token',{refresh_token:refresh});
  const d=fresh.data as {access_token?:string;refresh_token?:string;expires_in?:number};
  if(fresh.ok&&typeof d?.access_token==='string'&&typeof d.refresh_token==='string'){
   token=d.access_token;
   user=await goTrue('user',undefined,token,'GET');
   if(user.ok)rotated={access:token,refresh:d.refresh_token,expires:Number(d.expires_in)||3600};
  }
 }
 if(!token||!user?.ok)return {kind:'invalid'};
 const u=user.data as {id?:string;phone?:string};
 if(!u.id)return {kind:'invalid'};
 const profile=await accountQuery(token,'?user_id=eq.'+encodeURIComponent(u.id)+'&select=account_type,phone,full_name');
 if(!profile.ok||!Array.isArray(profile.data)||!profile.data.length)return {kind:'invalid'};
 const account=profile.data[0] as {account_type?:string;phone?:string;full_name?:string|null};
 if(account.account_type!=='customer'&&!(account.account_type==='provider'&&req.cookies.get('jt_mode')?.value==='customer'))return {kind:'provider'};
 const phone=normalizeKenyanPhone(u.phone),storedPhone=normalizeKenyanPhone(account.phone);
 if(!phone||phone!==storedPhone)return {kind:'invalid'};
 return {kind:'customer',identity:{userId:u.id,accessToken:token,phone,fullName:account.full_name||null,rotated}};
}
