import { notFound } from 'next/navigation';
import WhatsAppDemo from './whatsapp-demo';

export const dynamic = 'force-dynamic';
export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <WhatsAppDemo />;
}
