import type {Metadata} from 'next';
import {MarketplaceHome} from '@/components/MarketplaceHome';
export const metadata:Metadata={alternates:{canonical:'https://www.jitap.app/'}};
export default function Home(){return <MarketplaceHome/>}
