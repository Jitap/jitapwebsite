import {NextResponse} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)return NextResponse.json({profiles:[]},{headers:{'Cache-Control':'no-store'}});
 try{
  const response=await fetch(url+'/rest/v1/provider_profiles?select=id,display_name,business_name,service_categories,service_areas,base_area,description,logo_url,rating,review_count,years_experience,similar_jobs_completed,verified_at,is_online&is_public=eq.true&limit=500',{
   headers:{apikey:key,Authorization:'Bearer '+key},cache:'no-store',signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw new Error('Provider directory unavailable');
  const rows:unknown=await response.json();
  const profiles=Array.isArray(rows)?rows.filter((p)=>p&&typeof p==='object'&&Array.isArray(p.service_categories)&&p.service_categories.some((category:unknown)=>typeof category==='string'&&/moving|relocat/i.test(category))):[];
  return NextResponse.json({profiles},{headers:{'Cache-Control':'public, max-age=0, s-maxage=60'}});
 }catch{return NextResponse.json({profiles:[]},{headers:{'Cache-Control':'no-store'}})}
}
