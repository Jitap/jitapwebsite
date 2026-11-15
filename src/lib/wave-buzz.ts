/** JiTap Wave Buzz: pure, deterministic geographic dispatch logic.
 * Only providers with recent, consented GPS coordinates are eligible.
 * Area labels never substitute for measured distance.
 */
import {canonicalTrade} from '@/lib/provider-ranking';

export const WAVE_SECONDS=15;
export const WAVE_BANDS_KM=[[0,2],[2,5],[5,10]] as const;
export type Coordinates={lat:number;lng:number};
export type WaveProvider={
 id:string;categories:string[];online:boolean;verified:boolean;
 latitude:number|null;longitude:number|null;locationUpdatedAt:string|null;
 rating?:number|null;reviewCount?:number|null;responseRate?:number|null;
};
export type RankedWaveProvider=WaveProvider&{distanceKm:number;wave:1|2|3;score:number};
export function validGps(lat:number,lng:number){
 return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
}
export function haversineKm(a:Coordinates,b:Coordinates){
 if(!validGps(a.lat,a.lng)||!validGps(b.lat,b.lng))return Number.POSITIVE_INFINITY;
 const toRad=Math.PI/180;
 const dLat=(b.lat-a.lat)*toRad,dLng=(b.lng-a.lng)*toRad;
 const v=Math.sin(dLat/2)**2+Math.cos(a.lat*toRad)*Math.cos(b.lat*toRad)*Math.sin(dLng/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(v),Math.sqrt(Math.max(0,1-v)));
}
export function waveForDistance(km:number):1|2|3|null{
 if(!Number.isFinite(km)||km<0)return null;
 if(km<2)return 1;
 if(km<5)return 2;
 if(km<=10)return 3;
 return null;
}
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(n,hi));
export function rankWaveCandidates(providers:WaveProvider[],trade:string,location:Coordinates,now=Date.now()):RankedWaveProvider[]{
 if(!validGps(location.lat,location.lng))return [];
 const category=canonicalTrade(trade);
 return providers.flatMap(p=>{
  if(!p.verified||!p.online||p.latitude===null||p.longitude===null||!p.locationUpdatedAt)return [];
  const fresh=now-Date.parse(p.locationUpdatedAt);
  if(!Number.isFinite(fresh)||fresh<0||fresh>15*60*1000)return [];
  if(!p.categories.some(c=>canonicalTrade(c)===category))return [];
  const distanceKm=haversineKm(location,{lat:p.latitude,lng:p.longitude});
  const wave=waveForDistance(distanceKm);
  if(!wave)return [];
  // Ranking within each wave; never invent unknown ratings/response rates.
  const score=clamp(p.rating||0,0,5)*10+clamp(p.responseRate||0,0,1)*15+
   Math.min(10,Math.max(0,p.reviewCount||0))*0.5+(10-distanceKm)*1.5;
  return [{...p,wave,distanceKm,score}];
 }).sort((a,b)=>a.wave-b.wave||b.score-a.score||a.distanceKm-b.distanceKm||a.id.localeCompare(b.id));
}
export function waveAtElapsed(elapsedMs:number):1|2|3|'ended'{
 if(elapsedMs<0)return 1;
 if(elapsedMs<15000)return 1;
 if(elapsedMs<30000)return 2;
 if(elapsedMs<45000)return 3;
 return 'ended';
}
