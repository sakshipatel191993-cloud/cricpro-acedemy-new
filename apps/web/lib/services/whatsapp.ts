import { createHmac, timingSafeEqual } from 'node:crypto';

export const WHATSAPP_BUSINESS_NUMBER = '447728478115';
export const WHATSAPP_CONSENT_VERSION = 'transactional-v1';
export const WHATSAPP_CONSENT_TEXT = 'I would like Cricpro to send updates about this booking or enquiry to my number on WhatsApp. I can opt out at any time.';

export type WhatsAppEvent = 'booking_confirmed' | 'enquiry_received' | 'admin_booking' | 'admin_enquiry';
export interface WhatsAppConsent { phone: string; grantedAt: string; version: string }
export type WhatsAppResult =
  | { status: 'accepted'; messageId: string }
  | { status: 'skipped'; reason: 'disabled' | 'no_consent' | 'admin_disabled' }
  | { status: 'failed'; reason: string; retryable: boolean };

// Accept UK local numbers or explicit international numbers; reject ambiguous input.
export function normalizeWhatsAppPhone(input: string): string | null {
  const value = input.trim().replace(/[\s().-]/g, '');
  if (!/^(?:\+|00)?\d+$/.test(value)) return null;
  const digits = value.startsWith('+') ? value.slice(1) : value.startsWith('00') ? value.slice(2)
    : /^0\d{10}$/.test(value) ? `44${value.slice(1)}` : value;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function recordWhatsAppConsent(phone: string, checked: unknown): WhatsAppConsent | null {
  if (checked !== true) return null;
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) throw new Error('Enter a valid WhatsApp number including country code');
  return { phone: normalized, grantedAt: new Date().toISOString(), version: WHATSAPP_CONSENT_VERSION };
}

export function verifyWhatsAppSignature(body: string, signature: string | null, secret: string): boolean {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const actual = Buffer.from(signature.slice(7), 'hex');
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(actual, expected);
}

const templates: Record<WhatsAppEvent, { env: string; parameters: number }> = {
  booking_confirmed: { env: 'WHATSAPP_TEMPLATE_BOOKING', parameters: 4 },
  enquiry_received: { env: 'WHATSAPP_TEMPLATE_ENQUIRY', parameters: 2 },
  admin_booking: { env: 'WHATSAPP_TEMPLATE_ADMIN_BOOKING', parameters: 3 },
  admin_enquiry: { env: 'WHATSAPP_TEMPLATE_ADMIN_ENQUIRY', parameters: 2 },
};

/** Transport only. Call from a durable worker after checking current consent /
 * opt-outs and claiming a unique event+recipient job. Never call from the browser.
 * A successful API response means accepted, not delivered. A network timeout is
 * ambiguous and must be reconciled, not blindly retried (Meta has no send key).
 */
export async function sendWhatsAppTemplate(input: {
  event: WhatsAppEvent;
  phone: string;
  consent: WhatsAppConsent | null;
  values: string[];
}, config: NodeJS.ProcessEnv = process.env, transport: typeof fetch = fetch): Promise<WhatsAppResult> {
  if (config.WHATSAPP_ENABLED !== 'true') return { status: 'skipped', reason: 'disabled' };
  const phone = normalizeWhatsAppPhone(input.phone);
  if (!phone) return { status: 'failed', reason: 'invalid_phone', retryable: false };
  if (phone === normalizeWhatsAppPhone(config.WHATSAPP_SENDER_NUMBER || WHATSAPP_BUSINESS_NUMBER)) {
    return { status: 'failed', reason: 'sender_equals_recipient', retryable: false };
  }
  if (input.event.startsWith('admin_') && (config.WHATSAPP_ADMIN_ENABLED !== 'true' ||
      phone !== normalizeWhatsAppPhone(config.WHATSAPP_ADMIN_NUMBER || ''))) {
    return { status: 'skipped', reason: 'admin_disabled' };
  }
  if (!input.consent || input.consent.phone !== phone || input.consent.version !== WHATSAPP_CONSENT_VERSION ||
      !Number.isFinite(Date.parse(input.consent.grantedAt)) || Date.parse(input.consent.grantedAt) > Date.now()) {
    return { status: 'skipped', reason: 'no_consent' };
  }
  const template = templates[input.event];
  const name = config[template.env];
  const version = config.WHATSAPP_GRAPH_VERSION;
  const phoneId = config.WHATSAPP_PHONE_NUMBER_ID;
  if (!name || !/^[a-z0-9_]+$/.test(name) || !version || !/^v\d+\.\d+$/.test(version) ||
      !phoneId || !/^\d+$/.test(phoneId) || !config.WHATSAPP_ACCESS_TOKEN) {
    return { status: 'failed', reason: 'missing_configuration', retryable: false };
  }
  if (input.values.length !== template.parameters || input.values.some(value => typeof value !== 'string' || !value.trim() || value.length > 500)) {
    return { status: 'failed', reason: 'invalid_template_parameters', retryable: false };
  }
  try {
    const response = await transport(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'template',
        template: { name, language: { code: config.WHATSAPP_TEMPLATE_LANGUAGE || 'en_GB' },
          components: [{ type: 'body', parameters: input.values.map(text => ({ type: 'text', text: text.replace(/[\r\n\t]+/g, ' ') })) }] },
      }),
    });
    if (!response.ok) return { status: 'failed', reason: `provider_http_${response.status}`, retryable: response.status === 429 };
    const payload = await response.json();
    const id = payload.messages?.[0]?.id;
    if (typeof id !== 'string' || !id) return { status: 'failed', reason: 'ambiguous_response', retryable: false };
    return { status: 'accepted', messageId: id };
  } catch {
    // Do not log tokens, phone numbers, message contents, or provider bodies.
    return { status: 'failed', reason: 'ambiguous_network_failure', retryable: false };
  }
}
