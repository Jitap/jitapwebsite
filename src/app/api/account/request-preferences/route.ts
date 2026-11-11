import {NextRequest,NextResponse} from 'next/server';
import {getCustomerIdentity} from '@/lib/customer-session-server';
import {supabasePrivate} from '@/lib/coordinator-server';
import {setAuthCookies} from '@/lib/jitap-auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const customer=await getCustomerIdentity(req);
 if(customer.kind!=='customer')return NextResponse.json({configured:false},{headers:{'Cache-Control':'no-store'}});
 try{
  const records=await supabasePrivate<{privacy_accepted_at:string|null;sms_updates_opt_in:boolean|null;whatsapp_updates_opt_in:boolean|null;request_preferences_set_at:string|null}[]>('jitap_accounts?user_id=eq.'+encodeURIComponent(customer.identity.userId)+'&select=privacy_accepted_at,sms_updates_opt_in,whatsapp_updates_opt_in,request_preferences_set_at&limit=1');
  const settings=records[0];
  const response=NextResponse.json({configured:!!settings?.request_preferences_set_at,consent:!!settings?.privacy_accepted_at,notifyOptIn:settings?.sms_updates_opt_in??false,whatsappOptIn:settings?.whatsapp_updates_opt_in??false},{headers:{'Cache-Control':'no-store'}});
  if(customer.identity.rotated)setAuthCookies(response,customer.identity.rotated.access,customer.identity.rotated.refresh,customer.identity.rotated.expires);
  return response;
 }catch{return NextResponse.json({configured:false,error:'Preferences unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
