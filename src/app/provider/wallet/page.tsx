import Image from 'next/image';
import type {Metadata} from 'next';
import './wallet.css';

export const metadata:Metadata={
 title:'Wallet Coming Soon | JiTap',
 description:'JiTap Wallet is launching soon. Payments, balances and withdrawals are not yet available.'
};

export default function ProviderWalletComingSoon(){
 return <main className="jt-wallet-coming-soon" aria-labelledby="jt-wallet-title">
  <h1 id="jt-wallet-title" className="jt-wallet-screen-reader-only">JiTap Wallet coming soon</h1>
  <div className="jt-wallet-poster">
   <Image src="/images/JiTap%20Wallet%20Launching%20Soon.png?v=use-credit-1"
    alt="JiTap Wallet Coming Soon — illustrative wallet with a future KES balance and withdrawal feature, marked Launching soon. The figures are mockups, not actual balances."
    width={896} height={1792} sizes="(max-width: 680px) 100vw, 560px"
    priority unoptimized className="jt-wallet-poster-image"/>
  </div>
  <p className="jt-wallet-disclaimer">Wallet balances and withdrawals are not available yet. Amounts in the preview are illustrative.</p>
 </main>;
}
