import {createHmac,timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {sendWasilianaSms} from '@/lib/wasiliana';

export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
function reject(status:number,reason='unspecified'){if(status!==405)console.error('[jitap-sms-hook]',reason,'status',status);return NextResponse.json({error:'SMS hook request rejected'},{status,headers});}
function signatureValid(body:string,request:Request,secret:string){
 // Supabase Auth HTTP hooks use Standard Webhooks (id.timestamp.body).
 // Never allow an unauthenticated network request to trigger paid SMS.
 const id=request.headers.get('webhook-id')||'';
 const ts=request.headers.get('webhook-timestamp')||'';
 const signatures=request.headers.get('webhook-signature')||'';
 if(!id||!/^\d{10}$/.test(ts)||!signatures)return false;
 const now=Math.floor(Date.now()/1000);
 if(Math.abs(now-Number(ts))>300)return false;
 if(!secret.startsWith('v1,whsec_'))return false;
 let key:Buffer;
 try{key=Buffer.from(secret.slice('v1,whsec_'.length),'base64');}catch{return false}
 if(key.length<24)return false;
 const expected=createHmac('sha256',key).update(id+'.'+ts+'.'+body,'utf8').digest();
 for(const part of signatures.split(/\s+/)){
  const [version,encoded]=part.split(',');
  if(version!=='v1'||!encoded)continue;
  try{const actual=Buffer.from(encoded,'base64');if(actual.length===expected.length&&timingSafeEqual(actual,expected))return true;}catch{}
 }
 return false;
}
export async function POST(request:Request){
 const configured=process.env.SUPABASE_SEND_SMS_HOOK_SECRET?.trim();
 if(!configured)return reject(503,'hook_secret_missing');
 if(!process.env.WASILIANA_API_KEY)return reject(503,'wasiliana_key_missing');
 if(!process.env.WASILIANA_SENDER_ID)return reject(503,'wasiliana_sender_missing');
 if(Number(request.headers.get('content-length')||0)>18000)return reject(413,'payload_too_large');
 let body:string;try{body=await request.text();}catch{return reject(400,'body_unreadable')}
 if(body.length>18000)return reject(413,'payload_too_large');
 if(!signatureValid(body,request,configured))return reject(401,'signature_invalid');
 let event:unknown;try{event=JSON.parse(body)}catch{return reject(400,'invalid_json')}
 const payload=event as {user?:{phone?:unknown};sms?:{otp?:unknown}};
 const phone=payload?.user?.phone;
 const otp=payload?.sms?.otp;
 if(typeof phone!=='string'||!/^\+254[17][0-9]{8}$/.test(phone)||typeof otp!=='string'||!/^\d{6,8}$/.test(otp))return reject(422,'invalid_hook_payload');
 // The OTP originates inside Supabase Auth; never trust browser-supplied codes.
 // Wasiliana delivers it; Supabase verifies it. Never log the code or phone.
 const message='JiTap verification code: '+otp+'. Do not share this code with anyone.';
 try{
  const result=await sendWasilianaSms(phone,message,true);
  if(!result.accepted)return reject(502,'wasiliana_unconfirmed_or_rejected');
  return NextResponse.json({},{headers});
 }catch{return reject(503,'wasiliana_transport_error')}
}
export async function GET(){return reject(405)}
