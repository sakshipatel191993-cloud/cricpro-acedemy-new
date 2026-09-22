import { createHash } from 'node:crypto';
import { normalizeWhatsAppPhone } from './whatsapp';

interface DeliveryEvent { id: string; message_id: string; status: string; occurred_at: string }

// Only handle signed, account-scoped delivery receipts and explicit opt-outs.
// Other customer message content is neither stored nor treated as instructions.
export function parseWhatsAppWebhook(payload: any, accountId: string, phoneId: string) {
  const deliveries: DeliveryEvent[] = [];
  const stops = new Set<string>();
  if (!accountId || !phoneId || payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return { deliveries, stops: [] };
  for (const entry of payload.entry) {
    if (entry?.id !== accountId || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      const value = change?.value;
      if (change?.field !== 'messages' || value?.metadata?.phone_number_id !== phoneId) continue;
      for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
        const timestamp = Number(status.timestamp);
        if (typeof status.id !== 'string' || !status.id || status.id.length > 512 ||
            !['sent', 'delivered', 'read', 'failed'].includes(status.status) ||
            !Number.isFinite(timestamp) || timestamp <= 0 || timestamp > Date.now() / 1000 + 300) continue;
        deliveries.push({ id: createHash('sha256').update(`${status.id}|${status.status}|${timestamp}`).digest('hex'),
          message_id: status.id, status: status.status, occurred_at: new Date(timestamp * 1000).toISOString() });
      }
      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        if (message?.type !== 'text' || typeof message.text?.body !== 'string' || typeof message.from !== 'string') continue;
        if (!/^(stop|unsubscribe|cancel|end|quit|stopall)$/i.test(message.text.body.trim())) continue;
        const phone = normalizeWhatsAppPhone(message.from);
        if (phone) stops.add(phone);
      }
    }
  }
  return { deliveries, stops: [...stops] };
}
