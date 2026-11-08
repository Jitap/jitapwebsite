import type {Metadata} from 'next';
import {AccountAuth} from '@/components/AccountAuth';
export const metadata:Metadata={title:'Sign In | JiTap',description:'Sign in to JiTap using one verified mobile number. New customers and providers onboard automatically.'};
export default function LoginPage(){return <AccountAuth/>;}
