import {NextResponse,type NextRequest} from 'next/server';
// Secondary write barrier for design reviewers. Reviewer accounts intentionally
// have no Supabase access token and must never create real bookings or perform
// production API mutations, including otherwise-public guest intake routes.
export function middleware(req:NextRequest){
 if(!req.cookies.has('jt_design_review'))return NextResponse.next();
 const method=req.method.toUpperCase();
 if(method==='GET'||method==='HEAD'||method==='OPTIONS')return NextResponse.next();
 const p=req.nextUrl.pathname;
 if((p==='/api/auth/review'&&['POST','DELETE'].includes(method))||
    (p==='/api/auth/mode'&&method==='POST')||
    (p==='/api/auth/session'&&method==='DELETE'))return NextResponse.next();
 return NextResponse.json({error:'Design review mode is read-only. No production changes were made.'},{status:403,headers:{'Cache-Control':'private, no-store'}});
}
export const config={matcher:['/api/:path*']};
