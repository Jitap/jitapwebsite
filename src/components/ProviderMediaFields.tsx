'use client';
import {useRef,useState} from 'react';
import {Camera,CheckCircle2,ImagePlus,ShieldCheck} from 'lucide-react';

export type MediaKind='profile_photo'|'business_logo'|'id_front'|'id_back';
type Entry={kind:MediaKind;uploadedAt:string};
type Props={uploaded:Entry[];kinds:MediaKind[];onUploaded:()=>Promise<void>;lockedIDs?:boolean};
type PickerMode='camera'|'gallery';
const labels:Record<MediaKind,string>={
 profile_photo:'Profile photo (optional)',
 business_logo:'Business logo (optional)',
 id_front:'Front side of national ID *',
 id_back:'Back side of national ID *'
};

export function ProviderMediaFields({uploaded,kinds,onUploaded,lockedIDs=false}:Props){
 const [working,setWorking]=useState<MediaKind|null>(null);
 const [error,setError]=useState('');
 const [kycConsent,setKycConsent]=useState(false);
 const inputs=useRef<Record<string,HTMLInputElement|null>>({});
 const isId=(kind:MediaKind)=>kind==='id_front'||kind==='id_back';
 function openPicker(kind:MediaKind,mode:PickerMode){
  setError('');
  if(working)return;
  if(isId(kind)&&lockedIDs){
   setError('Your approved identity documents are locked. Contact JiTap Service Operations to update them.');
   return;
  }
  if(isId(kind)&&!kycConsent){
   setError('Please tick the identity verification consent box below, then choose Take Photo or Gallery.');
   document.getElementById('jt-provider-id-consent')?.scrollIntoView({behavior:'smooth',block:'center'});
   return;
  }
  // A separate file input with capture="environment" requests the rear
  // camera on supported mobile browsers; the gallery input has no capture.
  // Direct click inside a user gesture preserves browser picker permissions.
  inputs.current[kind+'-'+mode]?.click();
 }
 async function send(kind:MediaKind,file:File){
  setError('');
  if(isId(kind)&&!kycConsent){
   setError('Please agree to the identity verification notice first.');
   return;
  }
  if(file.size>5*1024*1024||!['image/jpeg','image/png'].includes(file.type)){
   setError('Choose a JPG or PNG photo, maximum 5 MB.');
   return;
  }
  setWorking(kind);
  try{
   const form=new FormData();
   form.set('kind',kind);
   form.set('file',file);
   if(isId(kind))form.set('kycConsent','true');
   const response=await fetch('/api/provider/media',{method:'POST',body:form,cache:'no-store'});
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(body.error||'Upload failed');
   await onUploaded();
  }catch(e){
   setError(e instanceof Error?e.message:'Upload failed');
  }finally{
   setWorking(null);
  }
 }
 return <div className="jt-provider-media-group">
  {kinds.some(isId)&&<label className="jt-provider-id-consent" id="jt-provider-id-consent">
   <input type="checkbox" checked={kycConsent} onChange={e=>{setKycConsent(e.target.checked);setError('')}}/>
   <span>I agree to JiTap securely collecting and reviewing my national ID images solely for provider identity verification, accessible only to authorized staff.</span>
  </label>}
  {kinds.map(kind=>{
   const entry=uploaded.find(m=>m.kind===kind);
   const id=isId(kind);
   const locked=id&&lockedIDs;
   return <div className="jt-provider-media-item" key={kind}>
    <div className="jt-provider-media-label">{labels[kind]}</div>
    <div className={'jt-provider-upload-card '+(entry?'uploaded':'')}>
     {entry&&!id?<img alt={kind==='profile_photo'?'Your uploaded profile picture':'Your business logo'}
       src={'/api/provider/media?kind='+kind+'&v='+encodeURIComponent(entry.uploadedAt)}
       className="jt-provider-media-preview"/>:
      entry?<CheckCircle2 size={23} className="jt-provider-upload-icon"/>:
      id?<ImagePlus size={24} className="jt-provider-upload-icon"/>:<Camera size={24} className="jt-provider-upload-icon"/>}
     <span><strong>{working===kind?'Uploading securely…':entry?(id?'Photo received securely':'Photo uploaded'):
       id?'Upload '+(kind==='id_front'?'front':'back')+' side of your national ID':'Add a photo'}</strong>
      <small>JPG or PNG · Maximum 5 MB · Private storage</small></span>
    </div>
    <div className="jt-provider-photo-actions">
     <button type="button" disabled={!!working||locked} onClick={()=>openPicker(kind,'camera')}
       aria-label={'Take photo: '+labels[kind]}><Camera size={18}/> Take Photo</button>
     <button type="button" disabled={!!working||locked} onClick={()=>openPicker(kind,'gallery')}
       aria-label={'Choose from gallery: '+labels[kind]}><ImagePlus size={18}/> Choose from Gallery</button>
    </div>
    <input className="jt-provider-hidden-picker" ref={el=>{inputs.current[kind+'-camera']=el}} type="file"
      accept="image/jpeg,image/png" capture="environment"
      aria-label={'Camera image: '+labels[kind]}
      onChange={e=>{const file=e.target.files?.[0];if(file)void send(kind,file);e.target.value=''}}/>
    <input className="jt-provider-hidden-picker" ref={el=>{inputs.current[kind+'-gallery']=el}} type="file"
      accept="image/jpeg,image/png"
      aria-label={'Gallery image: '+labels[kind]}
      onChange={e=>{const file=e.target.files?.[0];if(file)void send(kind,file);e.target.value=''}}/>
   </div>;
  })}
  {error&&<p role="alert" className="jt-provider-error">{error}</p>}
  {kinds.some(isId)&&<div className="jt-provider-id-guidance"><ShieldCheck size={21}/><div>
   <strong>Make sure your ID photo is clear</strong>
   <ul><li>All information must be visible</li><li>Avoid glare or blurry images</li>
   <li>JPG or PNG only · up to 5 MB each</li><li>Visible only to authorized JiTap reviewers</li></ul>
  </div></div>}
 </div>;
}
