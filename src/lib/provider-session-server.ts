import type {NextRequest} from 'next/server';
import {accountQuery, normalizeKenyanPhone} from '@/lib/jitap-auth';
import {actingAsCustomer, resolveAccessSession} from '@/lib/jitap-session';

export type ProviderSession={
 userId:string;accessToken:string;phone:string;fullName:string|null;
 rotated?:{access:string;refresh:string;expires:number};
};

export async function getProviderSession(req:NextRequest):Promise<ProviderSession|null>{
 if(actingAsCustomer(req))return null;
 const resolved=await resolveAccessSession(req);
 if(!resolved)return null;
 const phone=normalizeKenyanPhone(resolved.authPhone);
 if(!phone)return null;
 const row=await accountQuery(resolved.accessToken,'?user_id=eq.'+encodeURIComponent(resolved.userId)+'&select=account_type,phone,full_name');
 if(!row.ok||!Array.isArray(row.data)||row.data.length!==1)return null;
 const profile=row.data[0] as {account_type:string;phone:string;full_name:string|null};
 if(profile.account_type!=='provider'||normalizeKenyanPhone(profile.phone)!==phone)return null;
 return {userId:resolved.userId,accessToken:resolved.accessToken,phone,fullName:profile.full_name,rotated:resolved.rotated};
}
