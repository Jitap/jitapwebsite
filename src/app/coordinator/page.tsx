import type {Metadata} from 'next';
import {CoordinatorDashboard} from '@/components/CoordinatorDashboard';
import './coordinator.css';
export const metadata:Metadata={title:'JiTap Service Operations',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default function CoordinatorPage(){return <CoordinatorDashboard/>}
