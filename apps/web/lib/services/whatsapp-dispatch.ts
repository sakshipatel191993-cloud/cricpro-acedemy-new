import { after } from 'next/server';
import { processWhatsAppJobs } from './whatsapp-jobs';

/** Dispatch only committed jobs for this request. The durable queue remains the
 * source of truth; an authenticated scheduler must recover missed invocations. */
export function dispatchWhatsApp(table: 'bookings' | 'group_session_bookings' | 'inquiries', id: string) {
  if (process.env.WHATSAPP_ENABLED !== 'true') return;
  after(async () => {
    try { await processWhatsAppJobs(undefined, undefined, { table, id }); }
    catch { console.error('whatsapp_dispatch_failed'); }
  });
}
