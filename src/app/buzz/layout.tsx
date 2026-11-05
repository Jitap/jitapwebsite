import type {Metadata} from 'next';
export const metadata:Metadata={
 title:'Respond to JiTap BUZZ',
 description:'Private provider opportunity response.',
 robots:{index:false,follow:false,noarchive:true},
 referrer:'no-referrer'
};
export default function BuzzLayout({children}:{children:React.ReactNode}){return children;}
