import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};
const limit=new Map<string,{start:number,count:number}>();
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('suggest'),query:z.string().trim().min(3).max(90),sessionToken:z.string().uuid()}),
 z.object({action:z.literal('details'),placeId:z.string().regex(/^[A-Za-z0-9_:-]{4,250}$/),sessionToken:z.string().uuid(),selectedName:z.string().trim().min(2).max(160).optional()})
]);
const plusCode=/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,}(?:,|\s|$)/i;
const isUseful=(name:string)=>!!name&&!plusCode.test(name)&&!/^(mombasa|kenya|coast province)$/i.test(name.trim());
function sameOrigin(req:NextRequest){
 const origin=req.headers.get('origin');
 if(!origin)return true;
 try{const u=new URL(origin);const host=req.headers.get('x-forwarded-host')||req.headers.get('host')||'';
 return u.origin===req.nextUrl.origin||u.origin==='https://'+host||u.origin==='https://www.jitap.app';
 }catch{return false}
}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403,headers:noStore});
 if(!req.headers.get('content-type')?.includes('application/json'))return NextResponse.json({error:'JSON required'},{status:415,headers:noStore});
 const ip=(req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-forwarded-for')||'unknown').split(',')[0].slice(0,85);
 const now=Date.now();const prev=limit.get(ip);const entry=!prev||now-prev.start>60000?{start:now,count:1}:{...prev,count:prev.count+1};
 if(limit.size>3500)limit.clear();limit.set(ip,entry);
 if(entry.count>45)return NextResponse.json({error:'Too many searches. Try again shortly.'},{status:429,headers:noStore});
 let input:unknown;try{const body=await req.text();if(body.length>1000)return NextResponse.json({error:'Request too long'},{status:413,headers:noStore});input=JSON.parse(body)}catch{return NextResponse.json({error:'Invalid request'},{status:400,headers:noStore})}
 const p=schema.safeParse(input);if(!p.success)return NextResponse.json({error:'Invalid location search'},{status:422,headers:noStore});
 const key=process.env.GOOGLE_MAPS_API_KEY;
 if(!key)return NextResponse.json({error:'Place suggestions temporarily unavailable'},{status:503,headers:noStore});
 const suggest=p.data.action==='suggest';
 const url=p.data.action==='suggest'?'https://places.googleapis.com/v1/places:autocomplete':'https://places.googleapis.com/v1/places/'+encodeURIComponent(p.data.placeId);
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),6500);
 try{
  const r=await fetch(url,{
   method:suggest?'POST':'GET',
   headers:{'X-Goog-Api-Key':key,...(suggest?{'Content-Type':'application/json','X-Goog-FieldMask':'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat'}:{'X-Goog-FieldMask':'id,formattedAddress,location,displayName,types'})},
   ...(p.data.action==='suggest'?{body:JSON.stringify({
    input:p.data.query,sessionToken:p.data.sessionToken,
    includedRegionCodes:['ke'],
    locationBias:{circle:{center:{latitude:-4.045,longitude:39.675},radius:40000}}
   })}:{ }),
   cache:'no-store',signal:controller.signal
  });
  if(!r.ok){console.error('Google Places request failed',{status:r.status,kind:p.data.action});
   return NextResponse.json({error:r.status===403?'Places API (New) needs enabling in Google Cloud':'Place lookup unavailable. Use the map pin or type an address.'},{status:503,headers:noStore});}
  const data=await r.json();
  if(p.data.action==='suggest'){
   const suggestions=(Array.isArray(data.suggestions)?data.suggestions:[]).flatMap((s:{placePrediction?:{placeId?:string;text?:{text?:string};structuredFormat?:{mainText?:{text?:string};secondaryText?:{text?:string}}}})=>{
    const x=s.placePrediction;
    return x?.placeId&&x?.text?.text?[{placeId:x.placeId,label:x.text.text,main:x.structuredFormat?.mainText?.text||x.text.text,secondary:x.structuredFormat?.secondaryText?.text||''}]:[];
   }).slice(0,5);
   return NextResponse.json({suggestions},{headers:noStore});
  }
  const lat=data.location?.latitude,lng=data.location?.longitude;
  if(typeof lat!=='number'||typeof lng!=='number'||lat< -5||lat>5||lng<33||lng>42)return NextResponse.json({error:'Location could not be confirmed in Kenya'},{status:422,headers:noStore});
  const broadTypes=['locality','administrative_area_level_1','administrative_area_level_2','country'];
  if(Array.isArray(data.types)&&data.types.some((type:string)=>broadTypes.includes(type))&&!data.types.some((type:string)=>['street_address','route','premise','establishment','point_of_interest'].includes(type)))
   return NextResponse.json({error:'Please choose a street, building or landmark, not just a city.'},{status:422,headers:noStore});
  // Use Google's actual place name, not a nearby business, inferred address or plus code.
  // The picker may prefer the user's exact autocomplete selection (e.g. Vescon 1).
  const displayName=typeof data.displayName?.text==='string'?data.displayName.text.trim():'';
  const formattedAddress=typeof data.formattedAddress==='string'?data.formattedAddress.trim():'';
  // Preserve the exact named autocomplete result the user chose. Google may return
  // a plus code as formattedAddress even for a correctly named apartment/estate.
  const chosenName=p.data.selectedName?.trim()||'';
  const label=isUseful(chosenName)?chosenName:isUseful(displayName)?displayName:(!plusCode.test(formattedAddress)&&isUseful(formattedAddress)?formattedAddress:'');
  if(!label)return NextResponse.json({error:'This map result has no identifiable place name. Search for the exact building or choose a named pin.'},{status:422,headers:noStore});
  return NextResponse.json({place:{label,placeId:data.id,lat,lng}},{headers:noStore});
 }catch{return NextResponse.json({error:'Location service unavailable; select a map pin or type the address'},{status:503,headers:noStore})}
 finally{clearTimeout(timeout)}
}
