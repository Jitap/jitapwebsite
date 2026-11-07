'use client';
import {useState} from 'react';
import {Camera,CheckCircle2,ImagePlus,ShieldCheck} from 'lucide-react';
export type MediaKind='profile_photo'|'business_logo'|'id_front'|'id_back';
type Entry={kind:MediaKind;uploadedAt:string};
type Props={uploaded:Entry[];kinds:MediaKind[];onUploaded:()=>Promise<void>;lockedIDs?:boolean};
const labels:Record<MediaKind,string>={
 profile_photo:'Profile photo (optional)',
 business_logo:'Business logo (optional)',
 id_front:'Front side of national ID *',
 id_back:'Back side of national ID *'
};
export function ProviderMediaFields({uploaded,kinds,onUploaded,lockedIDs=false}:Props){
 const [working,setWorking]=useState<MediaKind|null>(null);
 const [error,setError]=useState('');
 async function send(kind:MediaKind,file:File){
  setError('');
  if(file.size>5*1024*1024||!['image/jpeg','image/png'].includes(file.type)){
   setError('Choose a JPG or PNG photo, maximum 5 MB.');return;
  }
  setWorking(kind);
  try{
   const form=new FormData();
   form.set('kind',kind);form.set('file',file);
   const response=await fetch('/api/provider/media',{method:'POST',body:form,cache:'no-store'});
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(body.error||'Upload failed');
   await onUploaded();
  }catch(e){setError(e instanceof Error?e.message:'Upload failed')}
  finally{setWorking(null)}
 }
 return <div className="jt-provider-media-group">
  {kinds.map(kind=>{
   const entry=uploaded.find(m=>m.kind===kind);
   const isID=kind==='id_front'||kind==='id_back';
   const disabled=!!working||(isID&&lockedIDs);
   return <div className="jt-provider-media-item" key={kind}>
    <div className="jt-provider-media-label">{labels[kind]}</div>
    <label className={'jt-provider-upload-card '+(entry?'uploaded':'')}>
     {entry&&!isID?<img alt={kind==='profile_photo'?'Your uploaded profile picture':'Your business logo'} src={'/api/provider/media?kind='+kind+'&v='+encodeURIComponent(entry.uploadedAt)} className="jt-provider-media-preview"/>:
      entry?<CheckCircle2 size={23} className="jt-provider-upload-icon"/>:
      isID?<ImagePlus size={24} className="jt-provider-upload-icon"/>:<Camera size={24} className="jt-provider-upload-icon"/>}
     <span><strong>{working===kind?'Uploading securely…':entry?(isID?'Photo received securely':'Change photo'):(isID?'Upload '+(kind==='id_front'?'front':'back')+' side of your national ID':'Choose an image')}</strong>
      <small>{entry?'JPG/PNG · Private storage': 'JPG or PNG · Maximum 5 MB'}</small></span>
     <input type="file" accept="image/jpeg,image/png" disabled={disabled} aria-label={labels[kind]} onChange={e=>{const file=e.target.files?.[0];if(file)void send(kind,file);e.target.value=''}}/>
    </label>
   </div>;
  })}
  {error&&<p role="alert" className="jt-provider-error">{error}</p>}
  {kinds.some(k=>k==='id_front'||k==='id_back')&&<div className="jt-provider-id-guidance"><ShieldCheck size={21}/><div><strong>Make sure your ID photo is clear</strong><ul><li>All information must be visible</li><li>Avoid glare or blurry images</li><li>JPG or PNG only · up to 5 MB each</li><li>Visible only to authorized JiTap reviewers</li></ul></div></div>}
 </div>;
}
