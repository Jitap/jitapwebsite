import {NextRequest,NextResponse} from 'next/server';
import {getCustomerIdentity} from '@/lib/customer-session-server';
import {supabasePrivate} from '@/lib/coordinator-server';
import {normalizeKenyanPhone,setAuthCookies} from '@/lib/jitap-auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
type Intake={id:string;customer_user_id:string|null;status:string;payload:Record<string,unknown>;created_at:string};
export async function GET(req:NextRequest){
 const identity=await getCustomerIdentity(req);
 if(identity.kind!=='customer')return NextResponse.json({error:identity.kind==='provider'?'switch_mode':'sign_in_required'},{status:401,headers});
 const ref=req.nextUrl.searchParams.get('ref')||'';
 if(!/^JT-[0-9A-F]{8}$/.test(ref))return NextResponse.json({error:'Invalid JiTap Service ID'},{status:422,headers});
 const prefix=ref.slice(3).toLowerCase();
 const start=prefix+'-0000-0000-0000-000000000000';
 const end=prefix+'-ffff-ffff-ffff-ffffffffffff';
 try{
  const rows=await supabasePrivate<Intake[]>(
   'website_intake?select=id,customer_user_id,status,payload,created_at&kind=eq.request&id=gte.'+start+'&id=lte.'+end+'&limit=3');
  // A short SMS reference alone never authorizes access. The OTP-verified
  // account phone MUST match the phone on the original service request.
  const match=rows.find(r=>r.id.slice(0,8).toLowerCase()===prefix&&
   normalizeKenyanPhone(String(r.payload?.phone||''))===identity.identity.phone);
  if(!match)return NextResponse.json({error:'No request with this Service ID is linked to your verified phone number.'},{status:404,headers});
  if(match.customer_user_id&&match.customer_user_id!==identity.identity.userId)
   return NextResponse.json({error:'This request belongs to another verified account.'},{status:403,headers});
  if(!match.customer_user_id){
   await supabasePrivate<Intake[]>('website_intake?id=eq.'+encodeURIComponent(match.id)+'&customer_user_id=is.null',{
    method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({customer_user_id:identity.identity.userId})
   });
   const verify=await supabasePrivate<{customer_user_id:string|null}[]>('website_intake?select=customer_user_id&id=eq.'+encodeURIComponent(match.id));
   if(verify[0]?.customer_user_id!==identity.identity.userId)
    return NextResponse.json({error:'Unable to link this request to your account.'},{status:409,headers});
  }
  const [caseProgress]=await supabasePrivate<{status:string;updated_at:string}[]>(
   'coordinator_cases?source_kind=eq.website_request&source_id=eq.'+encodeURIComponent(match.id)+'&select=status,updated_at&limit=1');
  const payload=match.payload;
  const response=NextResponse.json({ok:true,ticket:{
   serviceId:ref,status:caseProgress?.status||match.status,updatedAt:caseProgress?.updated_at||match.created_at,
   category:typeof payload.category==='string'?payload.category:'Service',
   description:typeof payload.description==='string'?payload.description.slice(0,900):'Service request',
   area:typeof payload.area==='string'?payload.area:'',
   createdAt:match.created_at
  }},{headers});
  if(identity.identity.rotated)setAuthCookies(response,identity.identity.rotated.access,identity.identity.rotated.refresh,identity.identity.rotated.expires);
  return response;
 }catch{
  return NextResponse.json({error:'Unable to load the request right now. Try again.'},{status:503,headers});
 }
}
