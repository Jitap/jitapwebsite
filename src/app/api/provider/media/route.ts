import {NextRequest,NextResponse} from 'next/server';
import {getProviderSession} from '@/lib/provider-session-server';
import {sameOrigin,setAuthCookies} from '@/lib/jitap-auth';
import {getProviderMedia,MEDIA_KINDS,readProviderMedia,uploadProviderMedia,type MediaKind} from '@/lib/provider-media-server';
import {supabasePrivate} from '@/lib/coordinator-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
function valid(value:unknown):value is MediaKind{return typeof value==='string'&&MEDIA_KINDS.includes(value as MediaKind)}
export async function GET(req:NextRequest){
 const session=await getProviderSession(req);
 if(!session)return NextResponse.json({error:'Provider sign-in required'},{status:401,headers});
 const kind=req.nextUrl.searchParams.get('kind');
 if(!valid(kind))return NextResponse.json({error:'Invalid image type'},{status:422,headers});
 try{
  const found=await readProviderMedia(session.userId,kind);
  if(!found)return NextResponse.json({error:'Image not uploaded'},{status:404,headers});
  const res=new NextResponse(found.body,{status:200,headers:{...headers,'Content-Type':found.contentType,'Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'; sandbox"}});
  if(session.rotated)setAuthCookies(res,session.rotated.access,session.rotated.refresh,session.rotated.expires);
  return res;
 }catch{return NextResponse.json({error:'Image unavailable'},{status:503,headers})}
}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403,headers});
 const session=await getProviderSession(req);
 if(!session)return NextResponse.json({error:'Provider sign-in required'},{status:401,headers});
 if(Number(req.headers.get('content-length')||'0')>6*1024*1024)return NextResponse.json({error:'File too large (maximum 5 MB)'},{status:413,headers});
 try{
  // Approved providers cannot silently replace verified national IDs.
  const approved=await supabasePrivate<{status:string}[]>('jitap_provider_reviews?user_id=eq.'+encodeURIComponent(session.userId)+'&select=status');
  const previouslyUploaded=await getProviderMedia(session.userId);
  const data=await req.formData();
  const kind=data.get('kind'),file=data.get('file');
  if(!valid(kind)||!(file instanceof File))return NextResponse.json({error:'Select an image'},{status:422,headers});
  if(approved[0]?.status==='approved'&&(kind==='id_front'||kind==='id_back')){
   return NextResponse.json({error:'Contact JiTap Service Operations to update verified identity documents.'},{status:403,headers});
  }
  const saved=await uploadProviderMedia(session.userId,kind,file);
  // Alert Service Operations once, when the second identity image arrives.
  // Never attach document images, credentials or ID numbers to the email.
  if((kind==='id_front'||kind==='id_back')&&
    !['id_front','id_back'].every(k=>previouslyUploaded.some(m=>m.kind===k))){
   const now=await getProviderMedia(session.userId);
   if(['id_front','id_back'].every(k=>now.some(m=>m.kind===k))){
    const apiKey=process.env.RESEND_API_KEY,from=process.env.JITAP_EMAIL_FROM;
    if(apiKey&&from){
     try{
      await fetch('https://api.resend.com/emails',{
       method:'POST',
       headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json',
        'Idempotency-Key':'jitap-provider-verification-'+session.userId},
       body:JSON.stringify({from,to:['providers@jitap.app'],
        subject:'JiTap provider application ready for ID review',
        text:'A JiTap provider has uploaded both sides of their ID. Sign in to Service Operations to review the private documents and approve or reject: https://www.jitap.app/coordinator/providers'})
       ,signal:AbortSignal.timeout(5000),cache:'no-store'
      });
     }catch{console.error('JiTap provider review email unavailable')}
    }
   }
  }
  const response=NextResponse.json(saved,{headers});
  if(session.rotated)setAuthCookies(response,session.rotated.access,session.rotated.refresh,session.rotated.expires);
  return response;
 }catch(e){
  const message=e instanceof Error&&(/Only JPG|under 5 MB|valid JPG/.test(e.message))?e.message:'Unable to upload image. Try again.';
  return NextResponse.json({error:message},{status:422,headers});
 }
}
