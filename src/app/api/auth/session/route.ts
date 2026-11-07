import {NextResponse,type NextRequest} from 'next/server';
import {accountQuery,clearAuthCookies,goTrue,sameOrigin,setAuthCookies} from '@/lib/jitap-auth';
export const runtime='nodejs';
const noStore={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){
 let access=req.cookies.get('jt_access')?.value||'';
 const refresh=req.cookies.get('jt_refresh')?.value||'';
 if(!access&&!refresh)return NextResponse.json({authenticated:false},{status:401,headers:noStore});
 let user=access?await goTrue('user',undefined,access,'GET'):null;
 let refreshed:{access_token?:string;refresh_token?:string;expires_in?:number}|null=null;
 if((!user||!user.ok)&&refresh){
  const response=await goTrue('token?grant_type=refresh_token',{refresh_token:refresh});
  if(response.ok){
   refreshed=response.data as {access_token?:string;refresh_token?:string;expires_in?:number};
   if(refreshed.access_token){access=refreshed.access_token;user=await goTrue('user',undefined,access,'GET')}
  }
 }
 if(!user?.ok)return NextResponse.json({authenticated:false},{status:401,headers:noStore});
 const data=user.data as {id?:string;phone?:string};
 if(!data.id)return NextResponse.json({authenticated:false},{status:401,headers:noStore});
 const lookup=await accountQuery(access,'?user_id=eq.'+encodeURIComponent(data.id)+'&select=account_type,phone,full_name');
 if(!lookup.ok||!Array.isArray(lookup.data)||!lookup.data[0])return NextResponse.json({authenticated:false,error:'Account profile unavailable'},{status:503,headers:noStore});
 const profile=lookup.data[0];
 const activeMode=profile.account_type==='provider'&&req.cookies.get('jt_mode')?.value==='customer'?'customer':profile.account_type;
 const response=NextResponse.json({authenticated:true,accountType:activeMode,primaryAccountType:profile.account_type,phone:profile.phone,fullName:profile.full_name},{headers:noStore});
 if(refreshed?.access_token&&refreshed.refresh_token)setAuthCookies(response,refreshed.access_token,refreshed.refresh_token,Number(refreshed.expires_in)||3600);
 return response;
}
export async function DELETE(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 const access=req.cookies.get('jt_access')?.value;
 if(access)await goTrue('logout',undefined,access,'POST');
 const response=NextResponse.json({signedOut:true},{headers:noStore});
 clearAuthCookies(response);response.cookies.delete('jt_mode');return response;
}
