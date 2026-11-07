import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getProviderSession} from '@/lib/provider-session-server';
import {sameOrigin,setAuthCookies} from '@/lib/jitap-auth';
import {SERVICE_OPTIONS} from '@/lib/provider-options';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const daily=z.object({enabled:z.boolean(),from:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),to:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),breakFrom:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),breakTo:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional()}).strict().refine(v=>!v.enabled||v.from<v.to,{message:'End time must follow start time'}).refine(v=>!v.breakFrom&&!v.breakTo||(!!v.breakFrom&&!!v.breakTo&&v.breakFrom<v.breakTo&&v.breakFrom>=v.from&&v.breakTo<=v.to),{message:'Break must be within working hours'});
const service=z.object({id:z.string().uuid(),name:z.string().trim().min(2).max(80),category:z.string().min(1).max(80),description:z.string().trim().max(500),minPrice:z.number().int().min(0).max(10000000).nullable(),maxPrice:z.number().int().min(0).max(10000000).nullable()}).strict().refine(v=>v.minPrice===null||v.maxPrice===null||v.minPrice<=v.maxPrice,{message:'Invalid price range'});
const schema=z.object({services:z.array(service).max(12),workingHours:z.record(z.enum(['monday','tuesday','wednesday','thursday','friday','saturday','sunday']),daily),language:z.enum(['en','sw']),notificationsEnabled:z.boolean()}).strict();
function client(token:string,path:string,method='GET',data?:unknown){
 const url=process.env.SUPABASE_URL?.replace(/\/$/,'');const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw Error('Database unavailable');
 return fetch(url+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json',...(method!=='GET'?{Prefer:'resolution=merge-duplicates,return=representation'}:{})},...(data?{body:JSON.stringify(data)}:{}),cache:'no-store',signal:AbortSignal.timeout(9000)});
}
function out(data:unknown,session:NonNullable<Awaited<ReturnType<typeof getProviderSession>>>,status=200){
 const res=NextResponse.json(data,{status,headers});
 if(session.rotated)setAuthCookies(res,session.rotated.access,session.rotated.refresh,session.rotated.expires);
 return res;
}
export async function GET(req:NextRequest){
 const session=await getProviderSession(req);if(!session)return NextResponse.json({error:'Sign in as a provider'},{status:401,headers});
 try{
  const res=await client(session.accessToken,'jitap_provider_profile_preferences?user_id=eq.'+encodeURIComponent(session.userId)+'&select=services,working_hours,language,notifications_enabled');
  if(!res.ok)throw Error('read');
  const rows=await res.json();
  return out({preferences:rows[0]||null,phone:session.phone},session);
 }catch{return out({error:'Unable to load profile preferences'},session,503)}
}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403,headers});
 if(Number(req.headers.get('content-length')||0)>12000)return NextResponse.json({error:'Payload too large'},{status:413,headers});
 const session=await getProviderSession(req);if(!session)return NextResponse.json({error:'Sign in as a provider'},{status:401,headers});
 try{
  const input=schema.safeParse(await req.json());
  if(!input.success)return out({error:'Check the service information and working hours.'},session,422);
  const profile=await client(session.accessToken,'jitap_provider_workspaces?user_id=eq.'+encodeURIComponent(session.userId)+'&select=categories');
  if(!profile.ok)throw Error('profile');
  const rows=await profile.json();const approved:string[]=rows[0]?.categories||[];
  const known=new Set<string>(SERVICE_OPTIONS.map(o=>o.value));
  if(input.data.services.some(s=>!known.has(s.category)||!approved.includes(s.category)))return out({error:'New service categories require JiTap review. Choose an approved category or contact Service Operations.'},session,422);
  const ids=input.data.services.map(s=>s.id);if(new Set(ids).size!==ids.length)return out({error:'Duplicate service'},session,422);
  const saved=await client(session.accessToken,'jitap_provider_profile_preferences?on_conflict=user_id','POST',{
   user_id:session.userId,services:input.data.services,working_hours:input.data.workingHours,language:input.data.language,notifications_enabled:input.data.notificationsEnabled,updated_at:new Date().toISOString()
  });
  if(!saved.ok)throw Error('save');
  return out({saved:true},session);
 }catch{return out({error:'Unable to save your changes. Please try again.'},session,503)}
}
