import type {NextRequest} from 'next/server';
import {accountQuery,goTrue,normalizeKenyanPhone} from '@/lib/jitap-auth';
export type ProviderSession={
 userId:string;accessToken:string;phone:string;fullName:string|null;
 rotated?:{access:string;refresh:string;expires:number};
};
export async function getProviderSession(req:NextRequest):Promise<ProviderSession|null>{
 let access=req.cookies.get('jt_access')?.value;
 const refresh=req.cookies.get('jt_refresh')?.value;
 if(!access&&!refresh)return null;
 let user=access?await goTrue('user',undefined,access,'GET'):null;
 let rotated:ProviderSession['rotated'];
 if(!user?.ok&&refresh){
  const renewed=await goTrue('token?grant_type=refresh_token',{refresh_token:refresh});
  const data=renewed.data as {access_token?:string;refresh_token?:string;expires_in?:number};
  if(renewed.ok&&data.access_token&&data.refresh_token){
   access=data.access_token;
   user=await goTrue('user',undefined,access,'GET');
   if(user.ok)rotated={access,refresh:data.refresh_token,expires:Number(data.expires_in)||3600};
  }
 }
 if(!access||!user?.ok)return null;
 const verified=user.data as {id?:string;phone?:string};
 const phone=normalizeKenyanPhone(verified.phone);
 if(!verified.id||!phone)return null;
 const row=await accountQuery(access,'?user_id=eq.'+encodeURIComponent(verified.id)+'&select=account_type,phone,full_name');
 if(!row.ok||!Array.isArray(row.data)||row.data.length!==1)return null;
 const profile=row.data[0] as {account_type:string;phone:string;full_name:string|null};
 if(profile.account_type!=='provider'||normalizeKenyanPhone(profile.phone)!==phone)return null;
 return {userId:verified.id,accessToken:access,phone,fullName:profile.full_name,rotated};
}
