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
  // Existing customers may have accepted consent before the preference columns existed.
  let previous:{consent?:boolean;notifyOptIn?:boolean;whatsappOptIn?:boolean}|null=null;
  if(!settings?.request_preferences_set_at){
   const history=await supabasePrivate<{payload:unknown}[]>('website_intake?customer_user_id=eq.'+encodeURIComponent(customer.identity.userId)+'&kind=eq.request&select=payload&order=created_at.desc&limit=1');
   const payload=history[0]?.payload;
   if(payload&&typeof payload==='object'&&!Array.isArray(payload)){
    const saved=payload as {consent?:unknown;notifyOptIn?:unknown;whatsappOptIn?:unknown};
    if(saved.consent===true)previous={consent:true,notifyOptIn:saved.notifyOptIn===true,whatsappOptIn:saved.whatsappOptIn===true};
   }
  }
  const response=NextResponse.json({configured:!!settings?.request_preferences_set_at||!!previous,consent:!!settings?.privacy_accepted_at||!!previous?.consent,notifyOptIn:settings?.sms_updates_opt_in??previous?.notifyOptIn??false,whatsappOptIn:settings?.whatsapp_updates_opt_in??previous?.whatsappOptIn??false},{headers:{'Cache-Control':'no-store'}});
  if(customer.identity.rotated)setAuthCookies(response,customer.identity.rotated.access,customer.identity.rotated.refresh,customer.identity.rotated.expires);
  return response;
 }catch{return NextResponse.json({configured:false,error:'Preferences unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
