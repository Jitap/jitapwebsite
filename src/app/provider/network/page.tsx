'use client';
import Link from 'next/link';
import {ArrowLeft,UsersRound} from 'lucide-react';
import {NetworkPanel} from '@/components/NetworkPanel';
export default function ProviderNetworkPage(){
 return <main style={{minHeight:'100dvh',padding:'clamp(18px,5vw,36px) 16px 70px',background:'linear-gradient(160deg,#f6fbff,#eefaf2)',fontFamily:'Inter,ui-sans-serif,system-ui,sans-serif'}}>
  <div style={{maxWidth:740,margin:'0 auto 19px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
   <Link href="/provider" style={{display:'inline-flex',alignItems:'center',gap:8,fontWeight:750,fontSize:13,color:'#12245d'}}><ArrowLeft size={18}/> Provider Home</Link>
   <span style={{display:'inline-flex',gap:7,alignItems:'center',fontSize:12,color:'#087239',fontWeight:700}}><UsersRound size={17}/> JiTap Network</span>
  </div>
  <NetworkPanel mode="provider"/>
 </main>;
}
