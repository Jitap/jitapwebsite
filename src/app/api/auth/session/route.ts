import {getReviewSession,clearReviewSession} from '@/lib/jitap-review-session';
import {NextResponse,type NextRequest} from 'next/server';
import {accountQuery,clearAuthCookies,goTrue,sameOrigin,setAuthCookies} from '@/lib/jitap-auth';
import {actingAsCustomer, parseBearerAuthorization, resolveAccessSession} from '@/lib/jitap-session';
export const runtime='nodejs';
const noStore={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){
 const reviewer=getReviewSession(req);
 if(reviewer)return NextResponse.json({authenticated:true,reviewer:true,accountType:reviewer.role,primaryAccountType:'provider',phone:'Not required',fullName:'Sena · Design Reviewer'},{headers:noStore});
 const resolved=await resolveAccessSession(req);
 if(!resolved)return NextResponse.json({authenticated:false},{status:401,headers:noStore});
 const access=resolved.accessToken;
 const user=await goTrue('user',undefined,access,'GET');
 if(!user?.ok)return NextResponse.json({authenticated:false},{status:401,headers:noStore});
 const data=user.data as {id?:string;phone?:string};
 if(!data.id)return NextResponse.json({authenticated:false},{status:401,headers:noStore});
 const lookup=await accountQuery(access,'?user_id=eq.'+encodeURIComponent(data.id)+'&select=account_type,phone,full_name');
 if(!lookup.ok||!Array.isArray(lookup.data)||!lookup.data[0])return NextResponse.json({authenticated:false,error:'Account profile unavailable'},{status:503,headers:noStore});
 const profile=lookup.data[0];
 const activeMode=profile.account_type==='provider'&&actingAsCustomer(req)?'customer':profile.account_type;
 const response=NextResponse.json({authenticated:true,accountType:activeMode,primaryAccountType:profile.account_type,phone:profile.phone,fullName:profile.full_name},{headers:noStore});
 if(resolved.rotated)setAuthCookies(response,resolved.rotated.access,resolved.rotated.refresh,resolved.rotated.expires);
 return response;
}
export async function DELETE(req:NextRequest){
 const bearer=parseBearerAuthorization(req);
 if(!bearer&&!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 if(getReviewSession(req)){
  const response=NextResponse.json({signedOut:true},{headers:noStore});clearReviewSession(response);clearAuthCookies(response);return response;
 }
 const resolved=await resolveAccessSession(req);
 const access=resolved?.accessToken||req.cookies.get('jt_access')?.value;
 if(access)await goTrue('logout',undefined,access,'POST');
 const response=NextResponse.json({signedOut:true},{headers:noStore});
 if(!bearer)clearAuthCookies(response);
 response.cookies.delete('jt_mode');
 return response;
}
