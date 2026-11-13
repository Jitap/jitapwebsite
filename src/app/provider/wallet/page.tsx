import type {Metadata} from 'next';
import './wallet.css';

export const metadata:Metadata={
 title:'JiTap Wallet | Coming Soon',
 description:'Preview the JiTap provider wallet. Wallet features are launching soon.'
};

const previewAmount='KES 1,500';

export default function ProviderWalletComingSoon(){
 return <main className="jt-wallet-coming-soon" aria-labelledby="jt-wallet-title">
  <section className="jt-wallet-preview" aria-label="JiTap wallet preview">
   <div className="jt-wallet-topline"><span className="jt-wallet-brand">JiTap <span>Wallet</span></span><span className="jt-wallet-soon">Launching soon</span></div>
   <div className="jt-wallet-hero">
    <p className="jt-wallet-eyebrow">Wallet preview</p>
    <h1 id="jt-wallet-title">{previewAmount}</h1>
    <p className="jt-wallet-caption">Free Credit</p>
   </div>
   <div className="jt-wallet-summary">
    <div className="jt-wallet-summary-card"><span>Free Credit</span><strong>{previewAmount}</strong></div>
    <div className="jt-wallet-summary-card"><span>Balance</span><strong>{previewAmount}</strong></div>
   </div>
   <div className="jt-wallet-launch"><span className="jt-wallet-launch-icon" aria-hidden="true">✦</span><div><strong>JiTap Wallet is coming soon</strong><p>More wallet features are on the way.</p></div></div>
  </section>
  <p className="jt-wallet-disclaimer">This is a preview only. The displayed amounts are illustrative, not available credit or a withdrawable balance.</p>
 </main>;
}
