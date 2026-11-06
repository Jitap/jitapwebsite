import type {Metadata} from 'next';
import {AccountAuth} from '@/components/AccountAuth';
export const metadata:Metadata={title:'Sign up or Log in | JiTap',description:'Sign up to JiTap as a customer or service provider using your Kenyan mobile number.'};
export default function LoginPage(){return <AccountAuth/>;}
