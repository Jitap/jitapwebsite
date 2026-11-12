import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {dispatchKapsoQueue} from '@/lib/kapso-dispatcher';
import {dispatchProviderAlerts} from '@/lib/provider-alerts';
export const runtime='nodejs';export const dynamic='force-dynamic';
function equalSecret(a:string,b:string){
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&timingSafeEqual(x,y);
}
export async function GET(req:NextRequest){
 const authorization=req.headers.get('authorization')||'';
 const key=authorization.startsWith('Bearer ')?authorization.slice(7):'';
 const allowed=[process.env.CRON_SECRET,process.env.KAPSO_DISPATCH_TOKEN].filter((x):x is string=>Boolean(x&&x.length>=32));
 if(!key||!allowed.some(x=>equalSecret(key,x)))
  return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{
  // Keep regular booking templates and consent-scoped provider alerts on the same protected cron.
  const [bookingAlerts,providerAlerts]=await Promise.allSettled([dispatchKapsoQueue(4),dispatchProviderAlerts(4)]);
  const result={bookingAlerts:bookingAlerts.status==='fulfilled'?bookingAlerts.value:{error:'booking_dispatch_unavailable'},providerAlerts:providerAlerts.status==='fulfilled'?providerAlerts.value:{error:'provider_alert_dispatch_unavailable'}};
  console.info('JiTap notification tick',result);
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  console.error('JiTap Kapso dispatch exception',e instanceof Error?e.message:'unknown');
  return NextResponse.json({error:'Kapso dispatcher unavailable'},{status:503});
 }
}
