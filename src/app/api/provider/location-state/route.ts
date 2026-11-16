import {NextRequest,NextResponse} from 'next/server';
import {getProviderSession} from '@/lib/provider-session-server';
import {supabasePrivate} from '@/lib/coordinator-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){
 const session=await getProviderSession(req);
 if(!session)return NextResponse.json({online:false},{status:401,headers});
 try{
  const rows=await supabasePrivate<{is_online:boolean}[]>(
   'jitap_provider_workspaces?select=is_online&user_id=eq.'+session.userId+'&limit=1');
  return NextResponse.json({online:rows[0]?.is_online===true},{headers});
 }catch{return NextResponse.json({error:'Availability temporarily unavailable'},{status:503,headers})}
}
