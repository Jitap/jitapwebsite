/** Unlock and reuse the notification chime in the provider's explicit Online tap.
 * Browsers can block audio without a user gesture; never claim sound was played
 * if the device/browser blocks it.
 */
let audio:AudioContext|null=null;
export function armProviderBuzzAudio(){
 if(typeof window==='undefined')return;
 try{
  if(!audio)audio=new AudioContext();
  void audio.resume().catch(()=>{});
 }catch{/* Device does not support audio output. */}
}
export function playProviderBuzzChime(){
 if(!audio||audio.state!=='running')return;
 try{
  const t=audio.currentTime;
  [784,1047].forEach((hz,i)=>{
   const oscillator=audio!.createOscillator(),gain=audio!.createGain();
   oscillator.type='sine';oscillator.frequency.value=hz;
   gain.gain.setValueAtTime(.0001,t+i*.11);
   gain.gain.exponentialRampToValueAtTime(.055,t+i*.11+.02);
   gain.gain.exponentialRampToValueAtTime(.0001,t+i*.11+.24);
   oscillator.connect(gain).connect(audio!.destination);
   oscillator.start(t+i*.11);oscillator.stop(t+i*.11+.25);
  });
 }catch{/* Alerts remain visual if audio fails. */}
}
