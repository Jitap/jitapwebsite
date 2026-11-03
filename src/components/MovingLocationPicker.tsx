'use client';
import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {MapPin,MapPinned,Search,LocateFixed,Plus,Minus,X,Check} from 'lucide-react';

export type MoveLocation={label:string;placeId?:string;lat?:number;lng?:number};
type Suggestion={placeId:string;label:string;main:string;secondary:string};
const coordToWorld=(lat:number,lng:number,zoom:number)=>{
 const size=256*Math.pow(2,zoom),sin=Math.sin(lat*Math.PI/180);
 return {x:(lng+180)/360*size,y:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*size};
};
const worldToCoord=(x:number,y:number,zoom:number)=>{
 const size=256*Math.pow(2,zoom),n=Math.PI-2*Math.PI*y/size;
 return {lat:180/Math.PI*Math.atan(Math.sinh(n)),lng:(x/size*360)-180};
};
const clamp=(lat:number,lng:number)=>({lat:Math.max(-4.9,Math.min(4.7,lat)),lng:Math.max(33.6,Math.min(41.8,lng))});
function PinnedMap({onSelect,onClose,initial}:{onSelect:(v:MoveLocation)=>void;onClose:()=>void;initial?:MoveLocation}){
 const [center,setCenter]=useState({lat:initial?.lat??-4.044,lng:initial?.lng??39.67});
 const [zoom,setZoom]=useState(13);
 const [size,setSize]=useState({w:620,h:310});
 const [landmark,setLandmark]=useState('');
 const el=useRef<HTMLDivElement|null>(null);
 const pointer=useRef<{x:number;y:number;mapX:number;mapY:number}|null>(null);
 useEffect(()=>{if(!el.current)return;const node=el.current;const obs=new ResizeObserver(()=>setSize({w:node.clientWidth,h:node.clientHeight}));obs.observe(node);return ()=>obs.disconnect()},[]);
 const world=coordToWorld(center.lat,center.lng,zoom);
 const minX=Math.floor((world.x-size.w/2)/256),maxX=Math.ceil((world.x+size.w/2)/256);
 const minY=Math.floor((world.y-size.h/2)/256),maxY=Math.ceil((world.y+size.h/2)/256);
 const tiles=[] as {x:number;y:number;left:number;top:number;url:string}[];
 for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){
  if(x>=0&&y>=0&&x<2**zoom&&y<2**zoom)tiles.push({x,y,left:x*256-world.x+size.w/2,top:y*256-world.y+size.h/2,url:'https://tile.openstreetmap.org/'+zoom+'/'+x+'/'+y+'.png'});
 }
 function pointerDown(e:PointerEvent<HTMLDivElement>){if(e.button!==0)return;const w=coordToWorld(center.lat,center.lng,zoom);pointer.current={x:e.clientX,y:e.clientY,mapX:w.x,mapY:w.y};e.currentTarget.setPointerCapture(e.pointerId)}
 function pointerMove(e:PointerEvent<HTMLDivElement>){const p=pointer.current;if(!p)return;const c=worldToCoord(p.mapX-(e.clientX-p.x),p.mapY-(e.clientY-p.y),zoom);setCenter(clamp(c.lat,c.lng))}
 function pointerUp(e:PointerEvent<HTMLDivElement>){pointer.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}
 return <div className="jt-pin-backdrop" role="presentation" onClick={onClose}>
 <section className="jt-pin-dialog" role="dialog" aria-modal="true" aria-label="Choose a moving location on the map" onClick={e=>e.stopPropagation()}>
  <div className="jt-pin-header"><div><strong>Drop a pin</strong><small>Drag the map to position the pin on your pickup or destination</small></div><button type="button" aria-label="Close map" onClick={onClose}><X size={21}/></button></div>
  <div ref={el} className="jt-pin-map" role="application" aria-label="Interactive map. Drag to position the centre pin. Use zoom buttons to adjust." onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
   {tiles.map(t=><img key={zoom+'-'+t.x+'-'+t.y} alt="" draggable={false} loading="lazy" src={t.url} style={{position:'absolute',left:t.left,top:t.top,width:256,height:256,userSelect:'none',pointerEvents:'none'}}/>)}
   <span className="jt-pin-center" aria-hidden="true"><MapPin size={34} fill="#172078" color="#fff"/></span>
   <div className="jt-pin-controls" onPointerDown={e=>e.stopPropagation()}>
    <button type="button" aria-label="Zoom in" onClick={()=>setZoom(z=>Math.min(17,z+1))}><Plus size={18}/></button>
    <button type="button" aria-label="Zoom out" onClick={()=>setZoom(z=>Math.max(7,z-1))}><Minus size={18}/></button>
   </div>
   <a className="jt-pin-attribution" target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/copyright" onPointerDown={e=>e.stopPropagation()}>© OpenStreetMap contributors</a>
  </div>
  <div className="jt-pin-footer">
   <label htmlFor="jt-pin-landmark">Building or landmark (optional)<input id="jt-pin-landmark" maxLength={80} value={landmark} onChange={e=>setLandmark(e.target.value)} placeholder="e.g. near Coast General Hospital"/></label>
   <small>Pin: {center.lat.toFixed(5)}, {center.lng.toFixed(5)} · Confirm access with your mover</small>
   <button type="button" className="jt-pin-confirm" onClick={()=>{onSelect({label:(landmark.trim()?landmark.trim()+' · ':'')+'Map pin ('+center.lat.toFixed(5)+', '+center.lng.toFixed(5)+')',lat:center.lat,lng:center.lng});onClose()}}><Check size={18}/> Use this location</button>
  </div>
 </section></div>;
}
export function MovingLocationPicker({title,value,selected,onChange,onSelect}:{title:string;value:string;selected?:MoveLocation|null;onChange:(v:string)=>void;onSelect:(v:MoveLocation)=>void}){
 const [results,setResults]=useState<Suggestion[]>([]);
 const [loading,setLoading]=useState(false);
 const [focused,setFocused]=useState(false);
 const [error,setError]=useState('');
 const [mapOpen,setMapOpen]=useState(false);
 const token=useRef('');
 const requestIndex=useRef(0);
 useEffect(()=>{token.current=crypto.randomUUID()},[]);
 useEffect(()=>{
  if(!focused||selected||value.trim().length<3){setResults([]);setLoading(false);return}
  const controller=new AbortController();const id=++requestIndex.current;
  const t=setTimeout(async()=>{
   setLoading(true);setError('');
   try{
    const r=await fetch('/api/places',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'suggest',query:value.trim(),sessionToken:token.current}),signal:controller.signal});
    const data=await r.json();
    if(id!==requestIndex.current)return;
    if(!r.ok){setResults([]);setError(data.error||'Suggestions unavailable');return}
    setResults(data.suggestions||[]);
   }catch(e){if(!controller.signal.aborted){setResults([]);setError('Suggestions unavailable')}}
   finally{if(id===requestIndex.current)setLoading(false)}
  },450);
  return ()=>{clearTimeout(t);controller.abort()}
 },[value,focused,selected]);
 async function choose(s:Suggestion){
  setFocused(false);setResults([]);onSelect({label:s.label,placeId:s.placeId});
  try{
   const r=await fetch('/api/places',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'details',placeId:s.placeId,sessionToken:token.current})});
   const data=await r.json();
   if(r.ok&&data.place)onSelect(data.place);
  }catch{}
  token.current=crypto.randomUUID();
 }
 return <div className="jt-location-search">
  <label htmlFor={'jt-location-'+title}>{title}</label>
  <div className="jt-location-input"><Search size={18} aria-hidden="true"/><input id={'jt-location-'+title} autoComplete="off" role="combobox" aria-expanded={focused&&results.length>0} aria-autocomplete="list" placeholder="Search neighbourhood, building or landmark" maxLength={200} required value={value} onFocus={()=>setFocused(true)} onChange={e=>{onChange(e.target.value);setFocused(true)}}/>{selected&&<Check size={17} color="#00a16c" aria-label="Selected location"/>}</div>
  {focused&&results.length>0&&<div className="jt-location-suggestions" role="listbox" aria-label={title+' suggestions'}>{results.map(s=><button type="button" role="option" aria-selected={false} key={s.placeId} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(s)}><MapPin size={17}/><span><strong>{s.main}</strong><small>{s.secondary}</small></span></button>)}</div>}
  {loading&&<small className="jt-location-status">Finding locations…</small>}
  {error&&<small className="jt-location-status">{error}. You can still use a typed address or map pin.</small>}
  <div className="jt-location-extras"><button type="button" onClick={()=>setMapOpen(true)}><MapPinned size={16}/> Choose on map</button>{!selected&&value.trim().length>=3&&<button type="button" onClick={()=>{onSelect({label:value.trim()});setFocused(false);setResults([])}}><Check size={15}/> Use typed address</button>}</div>
  {selected&&<small className="jt-location-selected"><Check size={13}/> {selected.placeId?'Place selected':selected.lat!==undefined?'Map pin selected':'Address noted'} · You can edit to change it</small>}
  {mapOpen&&<PinnedMap initial={selected||undefined} onClose={()=>setMapOpen(false)} onSelect={onSelect}/>}
 </div>;
}
