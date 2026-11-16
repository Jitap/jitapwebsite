import {NextRequest,NextResponse,after} from 'next/server';
import {z} from 'zod';
import {sameOrigin} from '@/lib/jitap-auth';
import {getProviderSession} from '@/lib/provider-session-server';
import {supabasePrivate} from '@/lib/coordinator-server';
import {notifyScheduledBooking} from '@/lib/customer-calendar-notifications';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
const schema=z.discriminatedUnion('action',[
 z.object({action:z.enum(['accept','decline']),bookingId:z.string().uuid()}).strict(),
 z.object({action:z.literal('propose'),bookingId:z.string().uuid(),
  startsAt:z.string().datetime({offset:true}),endsAt:z.string().datetime({offset:true}),
  note:z.string().max(500).default('')}).strict()
]);
type Invitation={id:string;request_id:string;customer_user_id:string;provider_user_id:string;
 starts_at:string;ends_at:string;note:string;status:string;proposed_start_at:string|null;proposed_end_at:string|null;response_note:string};
export async function GET(req:NextRequest){
 const provider=await getProviderSession(req);
 if(!provider)return reply({error:'Provider sign-in required'},401);
 try{
  const rows=await supabasePrivate<Invitation[]>(
   'jitap_customer_calendar_bookings?select=*&provider_user_id=eq.'+provider.userId+
   '&status=in.(pending,proposed,accepted,declined)&order=created_at.desc&limit=100');
  const ids=[...new Set(rows.map(r=>r.request_id))];
  const requests=ids.length?await supabasePrivate<{id:string;payload:Record<string,unknown>}[]>(
   'website_intake?select=id,payload&id=in.('+ids.join(',')+')'):[];
  const byId=new Map(requests.map(r=>[r.id,r.payload]));
  const invitations=rows.map(r=>{
   const p=byId.get(r.request_id)||{};
   const clean=(v:unknown,max=100)=>typeof v==='string'?v.trim().slice(0,max):'';
   // Customer contact and exact GPS are not included before confirmation.
   return {id:r.id,requestId:r.request_id,serviceId:'JT-'+r.request_id.slice(0,8).toUpperCase(),
    category:clean(p.category,70),area:clean(p.area,70),summary:clean(p.title)||clean(p.description,160),
    startsAt:r.starts_at,endsAt:r.ends_at,note:r.note,status:r.status,
    proposedStartAt:r.proposed_start_at,proposedEndAt:r.proposed_end_at,
    responseNote:r.response_note};
  });
  return reply({invitations});
 }catch{return reply({error:'Scheduled invitations unavailable'},503)}
}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return reply({error:'Invalid origin'},403);
 if(Number(req.headers.get('content-length')||0)>2000)return reply({error:'Payload too large'},413);
 const provider=await getProviderSession(req);
 if(!provider)return reply({error:'Provider sign-in required'},401);
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return reply({error:'Choose a valid calendar response'},422);
 const input=parsed.data;
 try{
  const result=await supabasePrivate<{ok?:boolean;error?:string;status?:string}>(
   'rpc/jitap_provider_respond_calendar_booking',{
    method:'POST',body:JSON.stringify({
     p_provider:provider.userId,p_booking:input.bookingId,p_action:input.action,
     p_start:input.action==='propose'?input.startsAt:null,
     p_end:input.action==='propose'?input.endsAt:null,
     p_note:input.action==='propose'?input.note:''
    })
   });
  if(!result.ok)return reply({error:({
   invitation_not_available:'This invitation has already been answered.',
   schedule_conflict:'Your calendar has a conflicting appointment.',
   booking_time_passed:'The proposed booking time has passed.'
  } as Record<string,string>)[result.error||'']||'Unable to respond to booking'},409);
  if(input.action==='propose'||input.action==='decline'||input.action==='accept'){
   after(async()=>{await notifyScheduledBooking(
    input.bookingId,input.action==='propose'?'proposed':input.action==='decline'?'declined':'accepted',
    'customer').catch(()=>{})});
  }
  return reply(result);
 }catch{return reply({error:'Unable to respond to scheduled booking'},503)}
}
