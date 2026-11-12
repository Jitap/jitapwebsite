import {createHash} from 'node:crypto';
import {NextRequest,after} from 'next/server';
import {dispatchKapsoQueue} from '@/lib/kapso-dispatcher';
import {dispatchServiceFollowups} from '@/lib/service-followup-dispatcher';
import {z} from 'zod';
import {reply,supabasePrivate,validOrigin} from '@/lib/coordinator-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const token=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const request=z.discriminatedUnion('action',[
 z.object({action:z.literal('preview'),token}),
 z.object({action:z.literal('respond'),token,decision:z.enum(['accepted','declined','needs_clarification']),note:z.string().trim().max(500).optional()})
]);
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');

export async function POST(req:NextRequest){
 if(!validOrigin(req))return reply({error:'Invalid request origin'},403);
 try{
  const length=Number(req.headers.get('content-length')||'0');
  if(length>1800)return reply({error:'Request too large'},413);
  const parsed=request.safeParse(await req.json());
  if(!parsed.success)return reply({error:'Please check your response'},400);
  const d=parsed.data;
  if(d.action==='respond'&&d.decision==='needs_clarification'&&(!d.note||d.note.length<3))return reply({error:'Please describe what you need clarified'},400);
  const name=d.action==='preview'?'provider_buzz_preview':'provider_buzz_respond';
  const body=d.action==='preview'?{p_token_hash:hash(d.token)}:{p_token_hash:hash(d.token),p_decision:d.decision,p_note:d.note||null};
  const result=await supabasePrivate<Record<string,unknown>>('rpc/'+name,{method:'POST',body:JSON.stringify(body)});
  if(d.action==='respond'&&d.decision==='accepted'&&result.status==='recorded'){
   // The accepted-assignment DB trigger queues the approved customer booking
   // notification. Dispatch this particular request promptly after the response.
   const links=await supabasePrivate<{case_id:string}[]>('provider_response_links?select=case_id&token_hash=eq.'+hash(d.token)+'&limit=1');
   if(links[0]){
    const cases=await supabasePrivate<{source_id:string;source_kind:string}[]>('coordinator_cases?select=source_id,source_kind&id=eq.'+links[0].case_id+'&limit=1');
    if(cases[0]?.source_kind==='website_request'){
     const requestId=cases[0].source_id;
     after(async()=>{await Promise.allSettled([dispatchKapsoQueue(2,requestId),dispatchServiceFollowups(2)])});
    }
   }
  }
  return reply(result);
 }catch{
  return reply({error:'Unable to process the response. Please contact JiTap Service Operations.'},503);
 }
}
