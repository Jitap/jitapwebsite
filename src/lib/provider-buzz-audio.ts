/** A browser requires a trusted gesture per document before audio can play. */
let audio:AudioContext|null=null;
let lastChime=0;
export function armProviderBuzzAudio(){
 if(typeof window==='undefined')return;
 try{
  if(!audio||audio.state==='closed'){
   const Constructor=window.AudioContext||(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
   if(!Constructor)return;
   audio=new Constructor();
  }
  if(audio.state!=='running')void audio.resume().catch(()=>{});
 }catch{/* Visual BUZZ remains available. */}
}
export function playProviderBuzzChime(){
 if(!audio)return false;
 if(audio.state!=='running'){void audio.resume().catch(()=>{});return false}
 if(Date.now()-lastChime<900)return true;
 try{
  const t=audio.currentTime;
  [784,1047,1319].forEach((hz,i)=>{
   const oscillator=audio!.createOscillator(),gain=audio!.createGain();
   oscillator.type='sine';oscillator.frequency.value=hz;
   gain.gain.setValueAtTime(.0001,t+i*.15);
   gain.gain.exponentialRampToValueAtTime(.18,t+i*.15+.025);
   gain.gain.exponentialRampToValueAtTime(.0001,t+i*.15+.29);
   oscillator.connect(gain).connect(audio!.destination);
   oscillator.start(t+i*.15);oscillator.stop(t+i*.15+.3);
   oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
  });
  lastChime=Date.now();return true;
 }catch{return false}
}
