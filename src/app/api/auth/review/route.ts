import {NextRequest,NextResponse} from 'next/server';
import {checkReviewCode,getReviewSession,setReviewSession,clearReviewSession,reviewHeaders} from '@/lib/jitap-review-session';
import {sameOrigin,clearAuthCookies} from '@/lib/jitap-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403,headers:reviewHeaders});
 if(Number(req.headers.get('content-length')||0)>1000)return NextResponse.json({error:'Invalid request'},{status:413});
 const body=await req.json().catch(()=>null) as {code?:unknown;role?:unknown}|null;
 if(!body||!checkReviewCode(body.code))return NextResponse.json({error:'Invalid reviewer access code'},{status:401,headers:reviewHeaders});
 const role=body.role==='provider'?'provider':'customer';
 const response=NextResponse.json({authenticated:true,reviewer:true,accountType:role,redirect:role==='provider'?'/provider':'/account'},{headers:reviewHeaders});
 clearAuthCookies(response);
 setReviewSession(response,role);
 return response;
}
export async function GET(req:NextRequest){
 const reviewer=getReviewSession(req);
 return NextResponse.json({active:!!reviewer,role:reviewer?.role||null},{headers:reviewHeaders});
}
export async function DELETE(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 const response=NextResponse.json({signedOut:true},{headers:reviewHeaders});
 clearReviewSession(response);
 return response;
}
