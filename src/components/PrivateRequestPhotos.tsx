'use client';
import {useEffect,useState} from 'react';

type ImageItem={id:number;url:string;type:string;observation?:string|null};
/** Only the request owner or an authorized, unexpired BUZZ recipient may view these photos. */
export function PrivateRequestPhotos({requestId,buzzToken}:{requestId?:string;buzzToken?:string}){
 const [images,setImages]=useState<ImageItem[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 useEffect(()=>{
  if(!requestId&&!buzzToken)return;
  const controller=new AbortController();
  setLoading(true);setImages([]);setError('');
  const method=buzzToken?'POST':'GET';
  const url=buzzToken?'/api/request/photos/access':'/api/request/photos/access?requestId='+encodeURIComponent(requestId||'');
  fetch(url,{method,headers:buzzToken?{'Content-Type':'application/json'}:undefined,
    body:buzzToken?JSON.stringify({token:buzzToken}):undefined,
    credentials:'same-origin',cache:'no-store',signal:controller.signal})
   .then(async r=>{if(!r.ok)throw Error('Private photos unavailable');return r.json()})
   .then(data=>{if(!controller.signal.aborted)setImages(Array.isArray(data.images)?data.images:[])})
   .catch(()=>{if(!controller.signal.aborted)setError('Could not load the service photos. Please reopen the request.')})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[requestId,buzzToken]);
 if(!loading&&!error&&!images.length)return null;
 return <section className="jt-private-request-photos" aria-label="Service photos" style={{margin:'14px 0',padding:'12px',border:'1px solid #dfebe6',borderRadius:12}}>
  <strong style={{display:'block',marginBottom:9,color:'#163e32'}}>Service photos</strong>
  {loading&&<p role="status" style={{fontSize:13}}>Loading photos…</p>}
  {error&&<p role="status" style={{fontSize:13,color:'#64748b'}}>{error}</p>}
  {images.length>0&&<div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
   {images.map((img,i)=><figure key={img.id} style={{margin:0}}><a href={img.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={'Open service photo '+(i+1)}>
    <img src={img.url} alt={'Customer service photo '+(i+1)} referrerPolicy="no-referrer" style={{width:'100%',aspectRatio:'4 / 3',objectFit:'cover',borderRadius:9,border:'1px solid #e1e7e7'}}/>
   </a>{img.observation&&<figcaption style={{fontSize:12,color:'#526875',marginTop:5}}>AI photo note: {img.observation}</figcaption>}</figure>)}
  </div>}
  {images.length>0&&<small style={{display:'block',marginTop:8,color:'#64748b'}}>Only authorized viewers can access these photos. Photo links expire shortly.</small>}
 </section>;
}
