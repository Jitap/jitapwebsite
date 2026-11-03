/**
 * Google Routes computation: callable only on the JiTap server.
 * TRAFFIC_UNAWARE is sufficient for distance pricing; it is not an ETA or truck-access guarantee.
 */
export type RoutingOutcome={status:'verified';distanceKm:number}|{status:'unavailable';distanceKm:null};
export async function calculateDrivingRoute(pickup:string,dropoff:string,pickupArea:string):Promise<RoutingOutcome>{
 const key=process.env.GOOGLE_MAPS_API_KEY;
 if(!key)return {status:'unavailable',distanceKm:null};
 const qualify=(input:string,area?:string)=>{
  const value=input.trim();
  const suffix=/\bkenya\b/i.test(value)?'':', Kenya';
  const context=area&&!value.toLowerCase().includes(area.toLowerCase())?', '+area+', Mombasa':'';
  return value+context+suffix;
 };
 try{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),7500);
  try{
   const response=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{
    method:'POST',
    headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'routes.distanceMeters'},
    body:JSON.stringify({
     origin:{address:qualify(pickup,pickupArea)},
     destination:{address:qualify(dropoff)},
     travelMode:'DRIVE',
     routingPreference:'TRAFFIC_UNAWARE',
     computeAlternativeRoutes:false,
     routeModifiers:{avoidFerries:false}
    }),
    signal:controller.signal,
    cache:'no-store'
   });
   if(!response.ok){console.error('JiTap Google Routes request unsuccessful',{status:response.status});return {status:'unavailable',distanceKm:null};}
   const responseData=await response.json() as {routes?:{distanceMeters?:number}[]};
   const meters=responseData.routes?.[0]?.distanceMeters;
   if(typeof meters!=='number'||!Number.isFinite(meters)||meters<0||meters>2000000){
    console.error('JiTap Google Routes returned no valid driving distance');
    return {status:'unavailable',distanceKm:null};
   }
   return {status:'verified',distanceKm:Math.round(meters/100)/10};
  }finally{clearTimeout(timeout)}
 }catch(e){console.error('JiTap Google Routes unavailable',{reason:e instanceof Error?e.name:'request'});return {status:'unavailable',distanceKm:null};}
}
