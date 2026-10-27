import type {Metadata,Viewport} from 'next';import {Header,Footer} from '@/components/SiteChrome';import './globals.css';
const site=process.env.NEXT_PUBLIC_SITE_URL||'https://www.jitap.app';
export const metadata:Metadata={metadataBase:new URL(site),title:{default:'JiTap | Need help? Find someone nearby.',template:'%s | JiTap'},description:'JiTap is an AI-powered real-time local service network connecting people and nearby skills. Pilot in Mombasa. ASK • MATCH • BUZZ.',openGraph:{title:'JiTap — ASK • MATCH • BUZZ',siteName:'JiTap',description:'Need help? Find someone nearby.',type:'website'},robots:{index:true,follow:true}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#FFFFFF'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><a className="skip" href="#main">Skip to content</a><Header/><main id="main">{children}</main><Footer/></body></html>}
