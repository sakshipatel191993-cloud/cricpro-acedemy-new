import { recordWhatsAppConsent, sendWhatsAppTemplate } from './whatsapp';

export type DemoScenario = 'delivered' | 'failed' | 'stopped' | 'unpaid';
export const DEMO_SCENARIOS = ['delivered', 'failed', 'stopped', 'unpaid'] as const;

// Hard-coded fictional fixture. Never accept recipient details or credentials.
export async function runWhatsAppDemo(consented: boolean, scenario: DemoScenario) {
  const message = 'Hi Alex Demo, your Cricpro booking DEMO-001 is confirmed. Session: Lane hire. Schedule: 3 October 2026 at 10:00. Reply STOP to stop WhatsApp updates.';
  const base = { simulated: true, recipient: '+44 7700 900123', message };
  if (scenario === 'stopped') return { ...base, status: 'skipped', detail: 'STOP recorded in this simulation. No further notification attempted.' };
  if (scenario === 'unpaid') return { ...base, status: 'skipped', detail: 'Payment not confirmed. No booking notification attempted.' };
  const result = await sendWhatsAppTemplate({ event: 'booking_confirmed', phone: base.recipient,
    consent: recordWhatsAppConsent(base.recipient, consented),
    values: ['Alex Demo', 'DEMO-001', 'Lane hire', '3 October 2026 at 10:00'] }, {
    NODE_ENV: 'development', WHATSAPP_ENABLED: 'true', WHATSAPP_PHONE_NUMBER_ID: '1234', WHATSAPP_ACCESS_TOKEN: 'fictional-demo-token',
    WHATSAPP_GRAPH_VERSION: 'v99.0', WHATSAPP_TEMPLATE_BOOKING: 'cricpro_booking_confirmed',
  }, async () => new Response(JSON.stringify({ messages: [{ id: 'demo-only-not-sent' }] }), { status: 200 }));
  if (result.status !== 'accepted') return { ...base, status: result.status, detail: result.reason === 'no_consent' ? 'No WhatsApp opt-in. Notification skipped.' : result.reason };
  // Simulate a later provider delivery event; acceptance alone is not delivery.
  return { ...base, status: scenario === 'failed' ? 'failed' : 'delivered',
    detail: scenario === 'failed' ? 'Mock provider accepted the message, then reported delivery failure.' : 'Mock provider accepted the message, then reported delivery.' };
}
