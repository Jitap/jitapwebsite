import 'server-only';
import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {supabasePrivate} from '@/lib/coordinator-server';

/** Native Expo clients must present the Supabase session access token.
 * No browser cookie, shared app secret, or user-controlled provider ID.
 */
export async function nativeVerifiedProvider(req:NextRequest):Promise<string|null>{
 const header=req.headers.get('authorization')||'';
 if(!header.startsWith('Bearer '))return null;
 const jwt=header.slice(7);
 if(jwt.length<30||jwt.length>5000)return null;
 const base=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const anon=process.env.SUPABASE_ANON_KEY;
 if(!base||!anon)return null;
 const result=await fetch(base+'/auth/v1/user',{
  headers:{apikey:anon,Authorization:'Bearer '+jwt},
  cache:'no-store',signal:AbortSignal.timeout(8000)
 });
 if(!result.ok)return null;
 const user=await result.json() as {id?:string};
 if(!user.id||!z.string().uuid().safeParse(user.id).success)return null;
 const accounts=await supabasePrivate<{account_type:string}[]>(
  'jitap_accounts?select=account_type&user_id=eq.'+user.id+'&limit=1');
 if(accounts[0]?.account_type!=='provider')return null;
 const reviews=await supabasePrivate<{status:string}[]>(
  'jitap_provider_reviews?select=status&user_id=eq.'+user.id+'&limit=1');
 return reviews[0]?.status==='approved'?user.id:null;
}
