'use client';

import { WHATSAPP_CONSENT_TEXT } from '@/lib/whatsapp-consent';

export function WhatsAppOptIn({ checked, onChange, disabled = false }: {
  checked?: boolean; onChange?: (checked: boolean) => void; disabled?: boolean;
}) {
  // Hidden until onboarding and end-to-end delivery tests are complete.
  if (process.env.NEXT_PUBLIC_WHATSAPP_ENABLED !== 'true') return null;
  return (
    <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
      <input type="checkbox" name="whatsappConsent" value="yes"
        className="mt-1 h-4 w-4 shrink-0" disabled={disabled}
        checked={checked} onChange={onChange ? event => onChange(event.target.checked) : undefined} />
      <span>{WHATSAPP_CONSENT_TEXT}</span>
    </label>
  );
}
