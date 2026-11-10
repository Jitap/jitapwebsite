import {getReviewSession} from '@/lib/jitap-review-session';
import {reviewerTickets} from '@/lib/jitap-review-fixtures';
import {NextRequest,NextResponse} from 'next/server';
import {getCustomerIdentity} from '@/lib/customer-session-server';
import {ownCustomerRequests,setAuthCookies} from '@/lib/jitap-auth';
import {formatCustomerTickets,type RequestRecord} from '@/lib/customer-ticket-view';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:NextRequest){
 const review=getReviewSession(req);
 if(review)return review.role==='customer'?NextResponse.json({ok:true,reviewer:true,requests:reviewerTickets},{headers}):NextResponse.json({error:'Customer mode required'},{status:403,headers});
 const session=await getCustomerIdentity(req);
 if(session.kind!=='customer')return NextResponse.json({error:'Customer sign-in required.'},{status:401,headers});
 const {identity}=session;
 const result=await ownCustomerRequests(identity.accessToken,identity.userId);
 if(!result.ok||!Array.isArray(result.data)){
  return NextResponse.json({error:'We could not load your requests right now.'},{status:503,headers});
 }
 const requests=await formatCustomerTickets(result.data as RequestRecord[]);
 const response=NextResponse.json({ok:true,requests},{headers});
 if(identity.rotated)setAuthCookies(response,identity.rotated.access,identity.rotated.refresh,identity.rotated.expires);
 return response;
}
