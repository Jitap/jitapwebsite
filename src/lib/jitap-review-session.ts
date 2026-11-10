import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
import type {NextRequest} from 'next/server';
import type {NextResponse} from 'next/server';

export type ReviewRole='customer'|'provider';
const cookie='jt_design_review';
const hours=8;
const opts={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/',maxAge:hours*3600};
function sign(value:string){
 const secret=process.env.JITAP_REVIEW_SIGNING_SECRET;
 if(!secret||secret.length<40)return '';
 return createHmac('sha256',secret).update(value).digest('base64url');
}
function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function checkReviewCode(code:unknown){
 const expected=process.env.JITAP_REVIEW_ACCESS_CODE;
 return typeof code==='string'&&!!expected&&expected.length>=24&&equal(code.trim(),expected);
}
export function getReviewSession(req:NextRequest):{role:ReviewRole;expires:number}|null{
 const token=req.cookies.get(cookie)?.value||'';
 const parts=token.split('.');
 if(parts.length!==3)return null;
 const [role,expiry,signature]=parts;
 if(role!=='customer'&&role!=='provider')return null;
 if(!/^\d{10,15}$/.test(expiry)||Number(expiry)<Date.now()||Number(expiry)>Date.now()+hours*3600000)return null;
 const h=sign(role+'.'+expiry);
 if(!h||!equal(h,signature))return null;
 return {role,expires:Number(expiry)};
}
export function setReviewSession(response:NextResponse,role:ReviewRole){
 const expiry=String(Date.now()+hours*3600000);
 response.cookies.set(cookie,role+'.'+expiry+'.'+sign(role+'.'+expiry),opts);
 response.cookies.delete('jt_mode');
 return response;
}
export function clearReviewSession(response:NextResponse){response.cookies.set(cookie,'',{...opts,maxAge:0});return response;}
export const reviewHeaders={'Cache-Control':'private, no-store'};
