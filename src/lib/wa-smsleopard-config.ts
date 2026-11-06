import 'server-only';
export const whatsappApiBase='https://whatsapp.smsleopard.com';
export function waAuth(){
 const key=process.env.SMSLEOPARD_API_KEY?.trim();
 const secret=process.env.SMSLEOPARD_API_SECRET?.trim();
 if(!key||!secret)throw new Error('WhatsApp API credentials not configured');
 return 'Basic '+Buffer.from(key+':'+secret).toString('base64');
}
export async function waApi(path:string, init:RequestInit={}):Promise<unknown>{
 const response=await fetch(whatsappApiBase+path,{
  ...init,headers:{Authorization:waAuth(),Accept:'application/json','Content-Type':'application/json',...init.headers},
  cache:'no-store',signal:AbortSignal.timeout(10000)
 });
 const data:unknown=await response.json().catch(()=>null);
 if(!response.ok)throw new Error('WhatsApp API HTTP '+response.status);
 return data;
}
