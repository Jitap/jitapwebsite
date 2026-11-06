import {NextRequest,NextResponse} from 'next/server';
import {getCustomerIdentity} from '@/lib/customer-session-server';
import {ownCustomerRequests,setAuthCookies} from '@/lib/jitap-auth';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){
 const session=await getCustomerIdentity(req);
 if(session.kind!=='customer')return NextResponse.json({error:'Customer sign-in required.'},{status:401,headers});
 const {identity}=session;
 const result=await ownCustomerRequests(identity.accessToken,identity.userId);
 if(!result.ok||!Array.isArray(result.data)){
  return NextResponse.json({error:'We could not load your requests right now.'},{status:503,headers});
 }
 // Only return job summary fields, never phone, exact location, or contact metadata.
 const requests=result.data.map((item:unknown)=>{
  const r=item as {id:string;status:string;created_at:string;payload?:Record<string,unknown>};
  return {
   reference:r.id,
   status:r.status,
   createdAt:r.created_at,
   category:typeof r.payload?.category==='string'?r.payload.category:'service',
   description:typeof r.payload?.description==='string'?r.payload.description.slice(0,180):'Service request',
   area:typeof r.payload?.area==='string'?r.payload.area:''
  };
 });
 const response=NextResponse.json({ok:true,requests},{headers});
 if(identity.rotated)setAuthCookies(response,identity.rotated.access,identity.rotated.refresh,identity.rotated.expires);
 return response;
}
