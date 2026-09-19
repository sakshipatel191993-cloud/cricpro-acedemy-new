import { DEMO_SCENARIOS, runWhatsAppDemo, type DemoScenario } from '@/lib/services/whatsapp-demo';

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') return new Response('Not found', { status: 404 });
  const url = new URL(request.url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return new Response('Not found', { status: 404 });
  if (request.headers.get('origin') !== url.origin) return new Response('Forbidden', { status: 403 });
  try {
    const body = await request.json();
    if (typeof body?.consented !== 'boolean' || !DEMO_SCENARIOS.includes(body.scenario)) return new Response('Invalid scenario', { status: 400 });
    return Response.json(await runWhatsAppDemo(body.consented, body.scenario as DemoScenario), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return new Response('Unable to run simulation', { status: 400 }); }
}
