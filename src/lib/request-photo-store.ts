// Photos survive the navigation from /request to /request/match but stay on the customer's device until submission.
const database='jitap-service-draft';
const store='photos';
export async function saveDraftPhotos(files:File[]){
 if(!('indexedDB' in window))throw Error('Photo storage unavailable in this browser');
 await new Promise<void>((resolve,reject)=>{
  const open=indexedDB.open(database,1);
  open.onupgradeneeded=()=>{if(!open.result.objectStoreNames.contains(store))open.result.createObjectStore(store)};
  open.onerror=()=>reject(Error('Cannot open draft storage'));
  open.onsuccess=()=>{
   const db=open.result;const tx=db.transaction(store,'readwrite');
   tx.objectStore(store).put(files.slice(0,4),'current');
   tx.oncomplete=()=>{db.close();resolve()};
   tx.onerror=()=>{db.close();reject(Error('Cannot save selected photos'))};
  };
 });
}
export async function readDraftPhotos():Promise<File[]>{
 if(!('indexedDB' in window))return [];
 return new Promise(resolve=>{
  const open=indexedDB.open(database,1);
  open.onupgradeneeded=()=>{if(!open.result.objectStoreNames.contains(store))open.result.createObjectStore(store)};
  open.onerror=()=>resolve([]);
  open.onsuccess=()=>{
   const db=open.result;const tx=db.transaction(store,'readonly');const request=tx.objectStore(store).get('current');
   request.onsuccess=()=>{resolve(Array.isArray(request.result)?request.result.filter((x:unknown)=>x instanceof File):[]);db.close()};
   request.onerror=()=>{resolve([]);db.close()};
  };
 });
}
export async function clearDraftPhotos(){
 if(!('indexedDB' in window))return;
 const open=indexedDB.open(database,1);open.onsuccess=()=>{const db=open.result;const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete('current');tx.oncomplete=()=>db.close()};
}
