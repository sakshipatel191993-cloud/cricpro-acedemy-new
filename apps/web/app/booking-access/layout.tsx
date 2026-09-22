import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Secure booking access | CricPro', robots: { index:false,follow:false }, referrer:'no-referrer' };
export default function AccessLayout({children}:{children:React.ReactNode}) { return children; }
