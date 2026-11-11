import type {Metadata} from 'next';
import {RequestMatch} from '@/components/RequestMatch';
export const metadata:Metadata={title:'Finding providers near you | JiTap',robots:{index:false,follow:false}};
export default function MatchPage(){return <RequestMatch/>}
