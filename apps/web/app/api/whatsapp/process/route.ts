import { timingSafeEqual } from 'node:crypto';
import { processWhatsAppJobs } from '@/lib/services/whatsapp-jobs';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Only an authenticated scheduler/operator may run the worker. Not a public GET.
export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_WORKER_SECRET;
  const supplied = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || secret.length < 32 || supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try { return Response.json(await processWhatsAppJobs()); }
  catch { return Response.json({ error: 'WhatsApp processing failed' }, { status: 503 }); }
}
