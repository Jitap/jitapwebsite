import {deflateSync} from 'node:zlib';

export const runtime='nodejs';
const SIZE=96;
function crc32(bytes:Uint8Array){
 let crc=0xffffffff;
 for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;}
 return (crc^0xffffffff)>>>0;
}
function chunk(tag:string,data:Uint8Array){
 const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length,0);out.write(tag,4,'ascii');Buffer.from(data).copy(out,8);out.writeUInt32BE(crc32(out.subarray(4,out.length-4)),out.length-4);return out;
}
function pigment(x:number,y:number):[number,number,number]{
 const dx=x-48,dy=y-48;
 if(dx*dx+dy*dy<11*11)return [23,22,115];
 const radius=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
 const green=(Math.abs(radius-29)<4.2||Math.abs(radius-41)<4.2);
 const left=dx<0&&Math.abs(angle)>2.18;
 const right=dx>0&&Math.abs(angle)<0.96;
 return green&&(left||right)?[0,196,81]:[255,255,255];
}
function createPng(){
 const raw=Buffer.alloc(SIZE*(1+4*SIZE));
 for(let y=0;y<SIZE;y++){const row=y*(1+4*SIZE);raw[row]=0;for(let x=0;x<SIZE;x++){
  let red=0,green=0,blue=0;
  for(let sy=0;sy<3;sy++)for(let sx=0;sx<3;sx++){const color=pigment(x+(sx+.5)/3,y+(sy+.5)/3);red+=color[0];green+=color[1];blue+=color[2];}
  const at=row+1+4*x;raw[at]=Math.round(red/9);raw[at+1]=Math.round(green/9);raw[at+2]=Math.round(blue/9);raw[at+3]=255;
 }}
 const header=Buffer.alloc(13);header.writeUInt32BE(SIZE,0);header.writeUInt32BE(SIZE,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',new Uint8Array())]);
}
const favicon=createPng();
export function GET(){return new Response(new Uint8Array(favicon),{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=604800, immutable','X-Content-Type-Options':'nosniff'}});}
