import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getCustomerIdentity} from '@/lib/customer-session-server';
import {normalizeKenyanPhone,sameOrigin,setAuthCookies} from '@/lib/jitap-auth';
import {supabasePrivate} from '@/lib/coordinator-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const schema=z.object({
 requestId:z.string().uuid(),stars:z.number().int().min(1).max(5),
 comment:z.string().trim().max(500).default('')
}).strict();
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers});
type RequestRow={id:string;customer_user_id:string|null;payload:Record<string,unknown>};
type Appointment={id:string;request_id:string;provider_user_id:string;status:string};
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return reply({error:'Invalid origin'},403);
 if(Number(req.headers.get('content-length')||0)>2200)return reply({error:'Payload too large'},413);
 const customer=await getCustomerIdentity(req);
 if(customer.kind!=='customer')return reply({error:'Customer sign-in required'},401);
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return reply({error:'Choose 1 to 5 stars and an optional review'},422);
 const input=parsed.data;
 try{
  const rows=await supabasePrivate<RequestRow[]>('website_intake?select=id,customer_user_id,payload&id=eq.'+input.requestId+'&kind=eq.request&limit=1');
  const booking=rows[0];
  // A request reference is NOT ownership: require both phone ownership and account binding.
  if(!booking||booking.customer_user_id!==customer.identity.userId||
     normalizeKenyanPhone(String(booking.payload?.phone||''))!==customer.identity.phone)
   return reply({error:'Request not found'},404);
  const appointments=await supabasePrivate<Appointment[]>('jitap_provider_appointments?select=id,request_id,provider_user_id,status&request_id=eq.'+input.requestId+'&status=eq.completed&limit=1');
  const appointment=appointments[0];
  if(!appointment)return reply({error:'You can review your provider after the job is completed'},409);
  const existing=await supabasePrivate<{id:string}[]>('jitap_customer_provider_reviews?select=id&appointment_id=eq.'+appointment.id+'&limit=1');
  if(existing.length)return reply({error:'You have already reviewed this job'},409);
  await supabasePrivate('jitap_customer_provider_reviews',{
   method:'POST',headers:{Prefer:'return=minimal'},
   body:JSON.stringify({
    appointment_id:appointment.id,request_id:input.requestId,
    provider_user_id:appointment.provider_user_id,
    customer_user_id:customer.identity.userId,
    stars:input.stars,comment:input.comment
   })
  });
  const response=reply({ok:true,reviewed:true},201);
  if(customer.identity.rotated)setAuthCookies(response,customer.identity.rotated.access,customer.identity.rotated.refresh,customer.identity.rotated.expires);
  return response;
 }catch(e){
  if(e instanceof Error&&e.message.includes('409'))return reply({error:'You have already reviewed this job'},409);
  return reply({error:'Unable to save your review. Please try again.'},503);
 }
}
