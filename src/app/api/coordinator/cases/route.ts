import {NextRequest} from 'next/server';
import {reply,requireCoordinator,supabasePrivate,validOrigin} from '@/lib/coordinator-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type CaseRow={id:string;source_kind:'website_request'|'moving_lead';source_id:string;status:string;priority:string;assigned_to:string|null;next_followup_at:string|null;created_at:string;updated_at:string};
type Intake={id:string;created_at:string;status:string;payload:Record<string,unknown>};
type Move={id:string;created_at:string;current_stage:number;pickup_address:string|null;dropoff_address:string|null;moving_date:string|null;moving_time:string|null;home_size:string|null;customer_phone:string|null;customer_email:string|null};
function safeText(v:unknown,max=500){return typeof v==='string'?v.slice(0,max):''}
function normalizedRecord(c:CaseRow,source?:Intake|Move){
 const isRequest=c.source_kind==='website_request';
 const payload=isRequest?(source as Intake|undefined)?.payload||{}:{};
 const move=!isRequest?source as Move|undefined:undefined;
 const description=isRequest?safeText(payload.description,1600):[move?.home_size?'Move: '+move.home_size:'Moving enquiry',move?.pickup_address?'from '+move.pickup_address:'',move?.dropoff_address?'to '+move.dropoff_address:''].filter(Boolean).join(' ');
 return {
  ...c,reference:c.source_id.slice(0,8).toUpperCase(),
  category:isRequest?safeText(payload.category,70)||'other-services':'moving',
  area:isRequest?safeText(payload.area,120):safeText(move?.pickup_address,120),
  description,name:isRequest?safeText(payload.name,120):'',
  phone:isRequest?safeText(payload.phone,35):safeText(move?.customer_phone,35),
  preferredDate:isRequest?safeText(payload.preferredDate,30):safeText(move?.moving_date,30),
  preferredTime:isRequest?safeText(payload.preferredTime,30):safeText(move?.moving_time,30),
  locationLabel:isRequest?safeText(payload.locationLabel,180):safeText(move?.pickup_address,180),
  destination:isRequest?'':safeText(move?.dropoff_address,180),
  intakeStatus:isRequest?safeText((source as Intake)?.status,30):move?.current_stage,
  needsLocation:isRequest?!safeText(payload.locationLabel):!move?.pickup_address||!move?.dropoff_address,
  needsPhone:isRequest?!safeText(payload.phone):!move?.customer_phone,
  needsSchedule:isRequest?!safeText(payload.preferredDate):!move?.moving_date,
  canContact:isRequest?!!safeText(payload.phone):!!move?.customer_phone
 };
}
function inFilter(ids:string[]){return 'in.('+ids.join(',')+')'}
export async function GET(req:NextRequest){
 let staff;
 try{staff=await requireCoordinator(req)}catch{return reply({error:'Coordinator service unavailable'},503)}
 if(!staff)return reply({error:'Sign in required'},401);
 try{
  const url=new URL(req.url);
  const detailId=url.searchParams.get('id');
  if(detailId&&!/^[a-f0-9-]{36}$/i.test(detailId))return reply({error:'Invalid case ID'},400);
  const status=url.searchParams.get('status');
  const permitted=new Set(['new','incomplete','needs_sourcing','matching','provider_contacted','awaiting_quote','scheduled','in_progress','completed','cancelled','closed']);
  if(status&&!permitted.has(status))return reply({error:'Invalid status'},400);
  const q=detailId?'id=eq.'+encodeURIComponent(detailId):status?'status=eq.'+encodeURIComponent(status):'id=not.is.null';
  const cases=await supabasePrivate<CaseRow[]>('coordinator_cases?select=id,source_kind,source_id,status,priority,assigned_to,next_followup_at,created_at,updated_at&'+q+'&order=created_at.desc&limit='+(detailId?'1':'100'));
  if(detailId&&!cases.length)return reply({error:'Case not found'},404);
  const intakeIds=cases.filter(c=>c.source_kind==='website_request').map(c=>c.source_id);
  const moveIds=cases.filter(c=>c.source_kind==='moving_lead').map(c=>c.source_id);
  const [intakes,moves]=await Promise.all([
   intakeIds.length?supabasePrivate<Intake[]>('website_intake?select=id,created_at,status,payload&id='+inFilter(intakeIds)):Promise.resolve([]),
   moveIds.length?supabasePrivate<Move[]>('moving_leads?select=id,created_at,current_stage,pickup_address,dropoff_address,moving_date,moving_time,home_size,customer_phone,customer_email&id='+inFilter(moveIds)):Promise.resolve([])
  ]);
  const sources=new Map<string,Intake|Move>([...intakes,...moves].map(x=>[x.id,x]));
  const rows=cases.map(c=>normalizedRecord(c,sources.get(c.source_id)));
  if(detailId){
   const activity=await supabasePrivate<{action:string;actor_email:string;note:string|null;old_value:string|null;new_value:string|null;created_at:string}[]>('coordinator_activity?case_id=eq.'+encodeURIComponent(detailId)+'&select=action,actor_email,note,old_value,new_value,created_at&order=created_at.desc&limit=100');
   return reply({ok:true,case:rows[0],activity,staff});
  }
  return reply({ok:true,cases:rows,staff,totals:{all:rows.length,new:rows.filter(x=>x.status==='new').length,incomplete:rows.filter(x=>x.status==='incomplete').length,needs_sourcing:rows.filter(x=>x.status==='needs_sourcing').length,in_progress:rows.filter(x=>x.status==='in_progress').length,completed:rows.filter(x=>x.status==='completed').length}});
 }catch{return reply({error:'Could not load coordinator queue'},503)}
}
export async function PATCH(req:NextRequest){
 if(!validOrigin(req))return reply({error:'Invalid origin'},403);
 let staff;
 try{staff=await requireCoordinator(req)}catch{return reply({error:'Coordinator unavailable'},503)}
 if(!staff)return reply({error:'Sign in required'},401);
 let data:{id?:string;action?:string;value?:string|null;note?:string}={};
 try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
 if(!data.id||!/^[a-f0-9-]{36}$/i.test(data.id)||typeof data.action!=='string')return reply({error:'Invalid update'},400);
 const actions=new Set(['status_changed','priority_changed','assignment_changed','followup_changed','note_added']);
 if(!actions.has(data.action))return reply({error:'Unsupported action'},400);
 if(typeof data.value==='string'&&data.value.length>150)return reply({error:'Value too long'},400);
 if(typeof data.note==='string'&&data.note.length>2000)return reply({error:'Note too long'},400);
 try{
  const result=await supabasePrivate<CaseRow>('rpc/coordinator_update_case',{method:'POST',body:JSON.stringify({p_case_id:data.id,p_actor_email:staff.email,p_action:data.action,p_value:data.value||null,p_note:data.note||null})});
  return reply({ok:true,case:result});
 }catch{return reply({error:'Update rejected. Check status or permissions.'},422)}
}
