import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
const maxAge=30*60*1000;
function key(){const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!secret)throw Error('Photo storage is not configured');return secret}
export function issuePhotoToken(requestId:string){
 const expiry=Date.now()+maxAge;
 const message=requestId+'.'+expiry;
 const mac=createHmac('sha256',key()).update(message).digest('hex');
 return expiry+'.'+mac;
}
export function validatePhotoToken(requestId:string,token:string){
 const [expiry,mac,...rest]=token.split('.');
 if(rest.length||!/^[0-9]{13}$/.test(expiry||'')||!/^[a-f0-9]{64}$/.test(mac||''))return false;
 const time=Number(expiry);
 if(time<Date.now()||time>Date.now()+maxAge)return false;
 const wanted=createHmac('sha256',key()).update(requestId+'.'+expiry).digest();
 const actual=Buffer.from(mac,'hex');
 return wanted.length===actual.length&&timingSafeEqual(wanted,actual);
}
