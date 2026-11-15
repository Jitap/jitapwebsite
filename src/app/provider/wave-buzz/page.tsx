import type {Metadata} from 'next';
import {WaveBuzzSimulator} from '@/components/WaveBuzzSimulator';
export const metadata:Metadata={
 title:'JiTap Wave Buzz Simulator',
 description:'Test spatial BUZZ dispatch waves, countdown, sonar, audio and vibration without creating real service requests.'
};
export default function WaveBuzzSimulationPage(){return <main><WaveBuzzSimulator/></main>}
