import {NextRequest,NextResponse} from 'next/server';
import {getProviderSession} from '@/lib/provider-session-server';
import {sameOrigin,setAuthCookies} from '@/lib/jitap-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403,headers});
 let payload:unknown;try{payload=await req.json()}catch{return NextResponse.json({error:'Invalid request'},{status:400,headers})}
 const mode=(payload as {mode?:string}|null)?.mode;
 if(mode!=='customer'&&mode!=='provider')return NextResponse.json({error:'Choose customer or provider mode'},{status:422,headers});
 const session=await getProviderSession(req);
 if(!session)return NextResponse.json({error:'Sign in with a provider account first'},{status:401,headers});
 const response=NextResponse.json({ok:true,mode},{headers});
 if(mode==='customer')response.cookies.set('jt_mode','customer',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*30});
 else response.cookies.delete('jt_mode');
 if(session.rotated)setAuthCookies(response,session.rotated.access,session.rotated.refresh,session.rotated.expires);
 return response;
}
