import type {ReactNode} from 'react';
import ProviderBottomNavigation from '@/components/ProviderBottomNavigation';
import {ProviderDueReminders} from '@/components/ProviderDueReminders';
import './provider-mobile-shell.css';
export default function ProviderLayout({children}:{children:ReactNode}){
 return <div className="jt-provider-layout"><div className="jt-provider-content">{children}</div><ProviderDueReminders/><ProviderBottomNavigation/></div>;
}
