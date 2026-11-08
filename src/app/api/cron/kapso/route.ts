import {NextRequest,NextResponse} from 'next/server';
import {dispatchKapsoQueue} from '@/lib/kapso-dispatcher';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 if(!process.env.CRON_SECRET||req.headers.get('authorization')!=='Bearer '+process.env.CRON_SECRET)
  return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  return NextResponse.json(await dispatchKapsoQueue(10),{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Kapso dispatcher unavailable'},{status:503})}
}
