import {NextRequest,NextResponse} from 'next/server';
import {getProviderSession} from '@/lib/provider-session-server';
import {sameOrigin} from '@/lib/jitap-auth';
import {supabasePrivate} from '@/lib/coordinator-server';
import {z} from 'zod';
export const runtime='nodejs';export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private,no-store','X-Robots-Tag':'noindex'}});
type Reminder={id:string;appointment_id:string;due_at:string;channel:'in_app'|'whatsapp_manual'};
type Appointment={id:string;request_id:string;starts_at:string|null;status:string};
type Intake={id:string;payload:Record<string,unknown>};
export async function GET(req:NextRequest){
 const session=await getProviderSession(req);if(!session)return reply({error:'Provider sign-in required'},401);
 try{
  const now=new Date();
  const since=new Date(now.getTime()-24*3600000).toISOString();
  const [reminders,appointments]=await Promise.all([
   supabasePrivate<Reminder[]>('jitap_provider_job_reminders?provider_user_id=eq.'+session.userId+'&dismissed_at=is.null&due_at=lte.'+encodeURIComponent(now.toISOString())+'&due_at=gte.'+encodeURIComponent(since)+'&select=id,appointment_id,due_at,channel&order=due_at.asc&limit=35'),
   supabasePrivate<Appointment[]>('jitap_provider_appointments?provider_user_id=eq.'+session.userId+'&status=in.(confirmed,on_my_way,arrived,in_progress)&select=id,request_id,starts_at&limit=250')
  ]);
  const active=new Map(appointments.map(a=>[a.id,a]));
  const eligible=reminders.filter(r=>active.has(r.appointment_id));
  const ids=[...new Set(eligible.map(r=>active.get(r.appointment_id)!.request_id))];
  const intakes=ids.length?await supabasePrivate<Intake[]>('website_intake?id=in.('+ids.join(',')+')&select=id,payload'):[];
  const byId=new Map(intakes.map(x=>[x.id,x]));
  return reply({reminders:eligible.map(r=>{
   const a=active.get(r.appointment_id)!;const p=byId.get(a.request_id)?.payload||{};
   return {id:r.id,appointmentId:r.appointment_id,requestId:a.request_id,
    dueAt:r.due_at,startsAt:a.starts_at,
    title:typeof p.title==='string'?p.title.slice(0,120):typeof p.category==='string'?p.category.slice(0,100):'Scheduled work',
    customerName:typeof p.name==='string'?p.name.slice(0,120):'Customer',
    phone:typeof p.phone==='string'?p.phone.slice(0,28):'',
    location:typeof p.locationLabel==='string'?p.locationLabel.slice(0,160):'',
    channel:r.channel}
  })});
 }catch{return reply({error:'Reminders temporarily unavailable'},503)}
}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return reply({error:'Invalid origin'},403);
 const session=await getProviderSession(req);if(!session)return reply({error:'Provider sign-in required'},401);
 const data=z.object({id:z.string().uuid()}).strict().safeParse(await req.json().catch(()=>null));
 if(!data.success)return reply({error:'Invalid reminder'},422);
 try{
  const rows=await supabasePrivate<{id:string}[]>('jitap_provider_job_reminders?id=eq.'+data.data.id+'&provider_user_id=eq.'+session.userId+'&dismissed_at=is.null',{
   method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({dismissed_at:new Date().toISOString()})
  });
  if(!rows.length)return reply({error:'Reminder not found'},404);
  return reply({dismissed:true});
 }catch{return reply({error:'Could not dismiss reminder'},503)}
}
