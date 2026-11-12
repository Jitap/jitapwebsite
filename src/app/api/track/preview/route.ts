import {NextRequest,NextResponse} from 'next/server';
import {verifyTrackingInvite} from '@/lib/provider-booking-acquisition';
import {supabasePrivate} from '@/lib/coordinator-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
type Intake={id:string;status:string};
type Appointment={status:string};
export async function GET(req:NextRequest){
 const reference=req.nextUrl.searchParams.get('ref')||'';
 const invite=req.nextUrl.searchParams.get('invite')||'';
 if(!/^JT-[0-9A-F]{8}$/.test(reference)||invite.length>100)
  return NextResponse.json({error:'Invalid tracking invitation'},{status:400,headers});
 if(!verifyTrackingInvite(reference,invite))
  return NextResponse.json({error:'Invitation unavailable or expired. Sign in to see your booking.'},{status:403,headers});
 const prefix=reference.slice(3).toLowerCase();
 try{
  const records=await supabasePrivate<Intake[]>('website_intake?select=id,status&kind=eq.request&id=gte.'+prefix+'-0000-0000-0000-000000000000&id=lte.'+prefix+'-ffff-ffff-ffff-ffffffffffff&limit=3');
  const request=records.find(r=>r.id.slice(0,8).toLowerCase()===prefix);
  if(!request)return NextResponse.json({error:'Booking unavailable'},{status:404,headers});
  const manual=await supabasePrivate<{request_id:string}[]>('jitap_provider_manual_jobs?select=request_id&request_id=eq.'+request.id+'&limit=1');
  if(!manual.length)return NextResponse.json({error:'This link is not a provider-created booking'},{status:404,headers});
  const appointments=await supabasePrivate<Appointment[]>('jitap_provider_appointments?select=status&request_id=eq.'+request.id+'&limit=1');
  const status=appointments[0]?.status||request.status;
  // Only coarse service progress: no customer/provider names, contact, location, or job description.
  const safeStatus=status==='completed'?'completed':status==='cancelled'?'cancelled':
   status==='on_my_way'?'on_my_way':status==='arrived'?'arrived':
   status==='in_progress'?'in_progress':'scheduled';
  return NextResponse.json({ok:true,reference,source:'provider_booking',status:safeStatus},{headers});
 }catch{return NextResponse.json({error:'Tracking preview is temporarily unavailable'},{status:503,headers})}
}
