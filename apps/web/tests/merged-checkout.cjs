const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
function load(file, deps) {
  const module = { exports: {} };
  const source = ts.transpile(fs.readFileSync(path.join(root, file), 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
  new Function('require', 'module', 'exports', source)(name => {
    if (!(name in deps)) throw Error(`Unexpected dependency ${name}`);
    return deps[name];
  }, module, module.exports);
  return module.exports;
}
const next = { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200, headers: init?.headers, cookies: { set() {} } }) } };
test('resource quotes preserve server-stamped WhatsApp consent with and without coupons', async () => {
  const consent = load('apps/web/lib/whatsapp-consent.ts', {});
  const whatsapp = load('apps/web/lib/services/whatsapp.ts', { 'node:crypto': require('node:crypto'), '../whatsapp-consent': consent });
  const { QuoteError } = load('apps/web/lib/booking-quote.ts', {});
  let promotion = false, reserves = 0, saved, rpcName;
  const route = load('apps/web/app/api/bookings/route.ts', {
    'next/server': next,
    '@/lib/services/whatsapp': { whatsappConsentFields: (phone, checked) => whatsapp.whatsappConsentFields(phone, checked, 'true') },
    '@/lib/services/supabase': { isSupabaseConfigured: true, supabaseAdmin: { rpc: async (name, args) => {
      reserves++; rpcName = name; saved = args;
      return { data: { id: 'booking', booking_reference: 'TEST', service_type: 'lane_hire', amount: promotion ? '34.00' : '40.00', customer_name: 'Synthetic', customer_email: 'test@example.invalid', booking_date: '2039-01-01', expires_at: '2039-01-01T16:00:00Z' } };
    } } },
    '@/lib/services/stripe': { paymentsEnabled: true },
    '@/lib/security/rate-limit': { enforceRateLimit: async () => null },
    '@/lib/security/request-body': { readJsonBody: r => r.json(), RequestBodyError: class extends Error {} },
    '@/lib/services/booking-quotes': { requireQuoteRollout() {}, quoteCapability: () => 'a'.repeat(64) },
    '@/lib/booking-quote': { QuoteError },
    '@/lib/services/checkout-attempts': { startPersistedCheckout: async params => {
      assert.equal(params.amount, promotion ? '34.00' : '40.00'); return { url: 'https://checkout.stripe.com/synthetic' };
    } },
    '@/lib/security/guest-access': { provisionBookingAccess: async () => null },
    '@/lib/security/admin-auth': { isSameOriginRequest: () => true },
    '@/lib/security/customer-auth': {},
    '@/lib/services/coupons': { couponsEnabled: () => promotion, couponRequest: async () => ({ p_code: 'COACH15' }) },
  });
  const body = { quoteId: 'synthetic-quote', customerName: 'Synthetic', customerEmail: 'test@example.invalid', customerPhone: '+447700900123', whatsappConsent: true, amount: 1 };
  for (const enabled of [false, true]) {
    promotion = enabled;
    assert.equal((await route.POST({ json: async () => body })).status, 200);
    assert.equal(rpcName, enabled ? 'reserve_quote_with_coupon' : 'reserve_booking_quote');
    assert.equal(saved.p_customer.whatsapp_consent.phone, '447700900123');
    assert.equal(saved.p_customer.whatsapp_consent.version, 'transactional-v1');
    assert.ok(Math.abs(Date.now() - Date.parse(saved.p_customer.whatsapp_consent.grantedAt)) < 2000);
    assert.equal(saved.p_customer.amount, undefined, 'No client price enters the transaction');
  }
  const before = reserves;
  assert.equal((await route.POST({ json: async () => ({ ...body, whatsappConsent: 'yes' }) })).status, 400);
  assert.equal(reserves, before);
  assert.equal((await route.POST({ json: async () => ({ ...body, whatsappConsent: false }) })).status, 200);
  assert.equal(saved.p_customer.whatsapp_consent, undefined);
});
test('payment-success fallback dispatches durable emails for resource and group bookings without leaking private data', async () => {
  let group = false, confirms = 0, dispatches = 0;
  const route = load('apps/web/app/api/payments/verify-session/route.ts', {
    'next/server': next, '@/lib/services/supabase': {},
    '@/lib/services/stripe': { getStripe: () => ({ checkout: { sessions: { retrieve: async () => ({ id: 'cs_synthetic123', payment_status: 'paid', metadata: { booking_id: 'booking', ...(group ? { booking_kind: 'group_session' } : {}) } }) } } }) },
    '@/lib/services/confirm-booking': { confirmBooking: async () => { confirms++; } },
    '@/lib/services/confirm-group-booking': { confirmGroupBooking: async () => { confirms++; return { id: 'booking' }; } },
    '@/lib/services/booking-outbox': { dispatchBookingNotifications: async () => { assert.equal(confirms, dispatches + 1); dispatches++; } },
    '@/lib/security/guest-access': { guestSameOrigin: () => true, guestAccessEnabled: () => false },
    '@/lib/security/rate-limit': { enforceRateLimit: async () => null },
    '@/lib/security/request-body': { readJsonBody: async () => ({ sessionId: 'cs_synthetic123' }) },
  });
  for (group of [false, true]) {
    const response = await route.POST({});
    assert.deepEqual(response.body, { success: true, booking: null });
    assert.equal(response.headers['Cache-Control'], 'private, no-store');
  }
  assert.equal(dispatches, 2);
});
test('all feature environment names survive Turbo strict environment filtering', () => {
  const example = fs.readFileSync(path.join(root, 'apps/web/.env.example'), 'utf8');
  const configured = new Set(JSON.parse(fs.readFileSync(path.join(root, 'turbo.json'), 'utf8')).globalEnv);
  for (const match of example.matchAll(/^([A-Z][A-Z_0-9]+)=/gm)) assert.ok(configured.has(match[1]), `Missing ${match[1]} in turbo.json`);
});
