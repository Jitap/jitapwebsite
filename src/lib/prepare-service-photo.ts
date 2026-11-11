// Keep mobile photos within serverless request limits and strip EXIF/GPS metadata.
export async function prepareServicePhoto(file:File):Promise<File>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Select a JPG, PNG or WebP photo.');
 if(file.size>20*1024*1024)throw Error('Photo is too large. Choose an image under 20 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));
  canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Photo processing is unavailable.');
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Unable to process this photo')),'image/jpeg',.78));
  if(blob.size>3*1024*1024)throw Error('Photo is too large after resizing. Try another image.');
  return new File([blob],(file.name||'service-photo').replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
 }finally{bitmap.close()}
}
