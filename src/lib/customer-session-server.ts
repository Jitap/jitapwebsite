import type {NextRequest} from 'next/server';
import {accountQuery, goTrue, normalizeKenyanPhone} from '@/lib/jitap-auth';
import {actingAsCustomer, resolveAccessSession} from '@/lib/jitap-session';

export type CustomerIdentity={
 userId:string;
 accessToken:string;
 phone:string;
 fullName:string|null;
 rotated?:{access:string;refresh:string;expires:number};
};
export type CustomerIdentityResult=
 |{kind:'guest'}
 |{kind:'invalid'}
 |{kind:'provider'}
 |{kind:'customer';identity:CustomerIdentity};

export async function getCustomerIdentity(req:NextRequest):Promise<CustomerIdentityResult>{
 const resolved=await resolveAccessSession(req);
 if(!resolved)return {kind:'guest'};
 const token=resolved.accessToken;
 const user=await goTrue('user',undefined,token,'GET');
 if(!user?.ok)return {kind:'invalid'};
 const u=user.data as {id?:string;phone?:string};
 if(!u.id)return {kind:'invalid'};
 const profile=await accountQuery(token,'?user_id=eq.'+encodeURIComponent(u.id)+'&select=account_type,phone,full_name');
 if(!profile.ok||!Array.isArray(profile.data)||!profile.data.length)return {kind:'invalid'};
 const account=profile.data[0] as {account_type?:string;phone?:string;full_name?:string|null};
 if(account.account_type!=='customer'&&!(account.account_type==='provider'&&actingAsCustomer(req)))return {kind:'provider'};
 const phone=normalizeKenyanPhone(u.phone),storedPhone=normalizeKenyanPhone(account.phone);
 if(!phone||phone!==storedPhone)return {kind:'invalid'};
 return {kind:'customer',identity:{userId:u.id,accessToken:token,phone,fullName:account.full_name||null,rotated:resolved.rotated}};
}
