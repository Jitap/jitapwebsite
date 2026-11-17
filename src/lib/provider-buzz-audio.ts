/** Web Audio requires a trusted user gesture on Android Chrome and Safari.
 * An already-online account must arm sound again after a page reload.
 */
let audio:AudioContext|null=null;
export function providerBuzzAudioReady(){return audio?.state==='running'}
export async function armProviderBuzzAudio():Promise<boolean>{
 if(typeof window==='undefined')return false;
 try{
  if(!audio)audio=new AudioContext();
  if(audio.state!=='running')await audio.resume();
  return audio.state==='running';
 }catch{return false}
}
export function playProviderBuzzChime():boolean{
 if(!audio||audio.state!=='running')return false;
 try{
  const t=audio.currentTime+.005;
  [784,1047,1319].forEach((hz,i)=>{
   const osc=audio!.createOscillator(),gain=audio!.createGain();
   osc.type='sine';osc.frequency.value=hz;
   gain.gain.setValueAtTime(.0001,t+i*.14);
   gain.gain.exponentialRampToValueAtTime(.12,t+i*.14+.025);
   gain.gain.exponentialRampToValueAtTime(.0001,t+i*.14+.27);
   osc.connect(gain).connect(audio!.destination);
   osc.start(t+i*.14);osc.stop(t+i*.14+.28);
  });
  return true;
 }catch{return false}
}
