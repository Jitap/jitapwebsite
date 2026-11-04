import Link from 'next/link';
import {ProviderShowcase} from '@/components/ProviderShowcase';
export default async function MoverProfile({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 return <main className="container jt-profile"><Link href="/fundis" className="jt-profile-back">← Back to local professionals</Link><ProviderShowcase detail profileId={id}/></main>;
}
