import {NextRequest,NextResponse} from 'next/server';
import {requireCoordinator} from '@/lib/coordinator-server';
import {MEDIA_KINDS,readProviderMedia,type MediaKind} from '@/lib/provider-media-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
export async function GET(req:NextRequest){
 const staff=await requireCoordinator(req);
 if(!staff)return NextResponse.json({error:'JiTap staff sign-in required'},{status:401,headers});
 const userId=req.nextUrl.searchParams.get('userId')||'',kind=req.nextUrl.searchParams.get('kind')||'';
 if(!/^[a-f\d-]{36}$/i.test(userId)||!MEDIA_KINDS.includes(kind as MediaKind))return NextResponse.json({error:'Invalid provider or image'},{status:422,headers});
 try{
  const image=await readProviderMedia(userId,kind as MediaKind);
  if(!image)return NextResponse.json({error:'Image not available'},{status:404,headers});
  return new NextResponse(image.body,{status:200,headers:{...headers,'Content-Type':image.contentType,'Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch{return NextResponse.json({error:'Unable to load image'},{status:503,headers})}
}
