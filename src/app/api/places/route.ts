import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};
const limit=new Map<string,{start:number,count:number}>();
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('suggest'),query:z.string().trim().min(3).max(90),sessionToken:z.string().uuid()}),
 z.object({action:z.literal('details'),placeId:z.string().regex(/^[A-Za-z0-9_:-]{4,250}$/),sessionToken:z.string().uuid()}),
 z.object({action:z.literal('nearby'),lat:z.number().min(-5).max(5),lng:z.number().min(33).max(42),sessionToken:z.string().uuid()})
]);
type NearbyPlace={displayName?:{text?:string};formattedAddress?:string};
const plusCode=/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,}(?:,|\s|$)/i;
const clean=(text:string)=>text.replace(plusCode,'').replace(/^,\s*/,'').trim();
const isUseful=(name:string)=>!!name&&!plusCode.test(name)&&!/^(mombasa|kenya|coast province)$/i.test(name.trim());
async function nearbyPlace(key:string,lat:number,lng:number,signal:AbortSignal):Promise<string|null>{
 const response=await fetch('https://places.googleapis.com/v1/places:searchNearby',{
  method:'POST',
  headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'places.displayName,places.formattedAddress'},
  body:JSON.stringify({maxResultCount:3,rankPreference:'DISTANCE',locationRestriction:{circle:{center:{latitude:lat,longitude:lng},radius:250}}}),
  cache:'no-store',signal
 });
 if(!response.ok){console.error('Nearby place naming failed',{status:response.status});return null}
 const data=await response.json() as {places?:NearbyPlace[]};
 const chosen=data.places?.find(p=>isUseful(p.displayName?.text||''));
 if(!chosen)return null;
 return [chosen.displayName?.text,clean(chosen.formattedAddress||'')].filter(Boolean).join(', ').slice(0,180);
}
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
 const nearby=p.data.action==='nearby';
 const url=p.data.action==='suggest'?'https://places.googleapis.com/v1/places:autocomplete':p.data.action==='nearby'?'https://places.googleapis.com/v1/places:searchNearby':'https://places.googleapis.com/v1/places/'+encodeURIComponent(p.data.placeId);
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),6500);
 try{
  const r=await fetch(url,{
   method:suggest||nearby?'POST':'GET',
   headers:{'X-Goog-Api-Key':key,...(suggest?{'Content-Type':'application/json','X-Goog-FieldMask':'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat'}:nearby?{'Content-Type':'application/json','X-Goog-FieldMask':'places.displayName,places.formattedAddress'}:{'X-Goog-FieldMask':'id,formattedAddress,location,displayName'})},
   ...(p.data.action==='suggest'?{body:JSON.stringify({
    input:p.data.query,sessionToken:p.data.sessionToken,
    includedRegionCodes:['ke'],
    locationBias:{circle:{center:{latitude:-4.045,longitude:39.675},radius:40000}}
   })}:p.data.action==='nearby'?{body:JSON.stringify({maxResultCount:3,rankPreference:'DISTANCE',locationRestriction:{circle:{center:{latitude:p.data.lat,longitude:p.data.lng},radius:250}}})}:{ }),
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
  if(p.data.action==='nearby'){
   const places=(data.places||[]) as NearbyPlace[];
   const nearest=places.find(place=>isUseful(place.displayName?.text||''));
   const name=nearest?.displayName?.text;
   const address=clean(nearest?.formattedAddress||'');
   return NextResponse.json({label:name?'Near '+name+(address?', '+address:''):'Pinned location — add a building or landmark for easy identification'},{headers:noStore});
  }
  const lat=data.location?.latitude,lng=data.location?.longitude;
  if(typeof lat!=='number'||typeof lng!=='number'||lat< -5||lat>5||lng<33||lng>42)return NextResponse.json({error:'Location could not be confirmed in Kenya'},{status:422,headers:noStore});
  const original=data.formattedAddress||data.displayName?.text||'';
  let label=clean(original);
  if(plusCode.test(original)||!label||/^(mombasa,? kenya)$/i.test(label)){
   try{const near=await nearbyPlace(key,lat,lng,controller.signal);if(near)label='Near '+near;}
   catch{}
  }
  if(!label)label='Selected location near Mombasa';
  return NextResponse.json({place:{label,placeId:data.id,lat,lng}},{headers:noStore});
 }catch{return NextResponse.json({error:'Location service unavailable; select a map pin or type the address'},{status:503,headers:noStore})}
 finally{clearTimeout(timeout)}
}
