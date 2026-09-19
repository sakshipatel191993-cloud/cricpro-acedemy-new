import { timingSafeEqual } from 'node:crypto';
import { processWhatsAppJobs } from '@/lib/services/whatsapp-jobs';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Both scheduler entry points require independent server-only credentials.
async function handleProcess(request: Request, secret: string | undefined) {
  const supplied = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || secret.length < 32 || supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try { return Response.json(await processWhatsAppJobs()); }
  catch { return Response.json({ error: 'WhatsApp processing failed' }, { status: 503 }); }
}

export async function POST(request: Request) {
  return handleProcess(request, process.env.WHATSAPP_WORKER_SECRET);
}

export async function GET(request: Request) {
  return handleProcess(request, process.env.CRON_SECRET);
}
