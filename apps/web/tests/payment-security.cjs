const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
function load(file, dependencies) {
  const mod = { exports: {} };
  const code = ts.transpile(fs.readFileSync(path.join(root, file), 'utf8'), {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  });
  new Function('require', 'module', 'exports', code)(name => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency ${name}`);
  }, mod, mod.exports);
  return mod.exports;
}
const next = { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200, headers: init?.headers }) } };

(async () => {
  // No database/Stripe dependencies are permitted in the retired route.
  const retired = load('apps/web/app/api/payments/create-session/route.ts', { 'next/server': next });
  const rejected = await retired.POST({ json() { throw new Error('Must not process supplied IDs'); } });
  assert.equal(rejected.status, 410);
  assert.equal(rejected.headers['Cache-Control'], 'no-store');

  const calls = [];
  class FakeStripe {
    checkout = { sessions: { create: async (params, options) => {
      calls.push({ params, options });
      return { id: 'cs_test_current', url: 'https://checkout.stripe.com/test' };
    } } };
  }
  const oldKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'test-only-not-a-credential';
  try {
    const stripe = load('apps/web/lib/services/stripe.ts', { stripe: { default: FakeStripe } });
    const params = {
      bookingId: 'booking-1', bookingReference: 'TEST-1', serviceType: 'lane',
      amount: '25.00', customerEmail: 'customer@example.invalid', customerName: 'Test',
      description: 'Lane booking', expiresAt: 1900000000,
    };
    await stripe.createCheckoutSession(params);
    await stripe.createCheckoutSession(params);
    assert.deepEqual(calls[0], calls[1], 'Retries must use the same key AND identical parameters');
    assert.equal(calls[0].options.idempotencyKey, 'resource-checkout-booking-1');
    assert.equal(calls[0].params.expires_at, params.expiresAt);
    assert.equal(calls[0].params.line_items[0].price_data.unit_amount, 2500);
    await stripe.createCheckoutSession({ ...params, bookingKind: 'group_session' });
    assert.equal(calls[2].options.idempotencyKey, 'group-checkout-booking-1');
    await assert.rejects(() => stripe.createCheckoutSession({ ...params, expiresAt: undefined }), /fixed checkout expiry/);
    assert.equal(calls.length, 3);
  } finally {
    if (oldKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = oldKey;
  }

  let event, signatureValid = true, dbFailure = false;
  let record, mutations = 0, confirmations = 0, groupExpiries = 0;
  const db = { from(table) {
    assert.equal(table, 'bookings');
    const filters = [];
    let changes;
    return {
      update(values) { changes = values; return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      then(resolve) {
        if (dbFailure) return Promise.resolve({ error: new Error('Database unavailable') }).then(resolve);
        if (filters.every(([key, value]) => record[key] === value)) {
          Object.assign(record, changes); mutations++;
        }
        return Promise.resolve({ error: null }).then(resolve);
      },
    };
  } };
  const webhook = load('apps/web/app/api/webhooks/stripe/route.ts', {
    'next/server': next,
    '@/lib/services/supabase': { supabaseAdmin: db },
    '@/lib/services/booking-outbox': { dispatchBookingNotifications: async () => ({}), dispatchBlockBookingNotifications: async () => ({}) },
    '@/lib/services/block-bookings': { confirmBlockBooking: async () => {}, expireBlockBooking: async () => {} },
    '@/lib/services/stripe': { verifyWebhookSignature(body, signature) {
      assert.equal(body, 'raw-payload'); assert.equal(signature, 'signed-test');
      if (!signatureValid) throw new Error('Invalid signature');
      return event;
    } },
    '@/lib/services/confirm-booking': { confirmBooking: async (id, session) => {
      assert.equal(id, 'booking-1'); assert.equal(session, 'cs_test_current'); confirmations++;
    } },
    '@/lib/services/confirm-group-booking': { confirmGroupBooking: async () => { confirmations++; } },
    '@/lib/services/session-checkout': { expireGroupCheckout: async (id, session) => {
      assert.equal(id, 'booking-1'); assert.equal(session, 'cs_test_current'); groupExpiries++;
    } },
  });
  const request = { text: async () => 'raw-payload', headers: new Headers({ 'stripe-signature': 'signed-test' }) };
  assert.equal((await webhook.POST({ ...request, headers: new Headers() })).status, 400);
  signatureValid = false;
  assert.equal((await webhook.POST(request)).status, 400);
  signatureValid = true;
  assert.equal(mutations, 0);

  for (const type of ['checkout.session.expired', 'checkout.session.async_payment_failed']) {
    record = { id: 'booking-1', stripe_session_id: 'cs_test_current', status: 'pending_payment' };
    event = { type, data: { object: { id: 'cs_test_old', metadata: { booking_id: 'booking-1' } } } };
    const before = mutations;
    assert.equal((await webhook.POST(request)).status, 200);
    assert.equal(mutations, before, 'An old session must not cancel a newer checkout');
    event.data.object.id = 'cs_test_current';
    assert.equal((await webhook.POST(request)).status, 200);
    assert.equal(record.status, 'cancelled');
    assert.equal(record.payment_status, 'failed');
    await webhook.POST(request);
    assert.equal(mutations, before + 1, 'Duplicate expiry must be harmless');
    record.status = 'confirmed';
    await webhook.POST(request);
    assert.equal(record.status, 'confirmed', 'A paid booking must not be cancelled');
  }
  dbFailure = true;
  assert.equal((await webhook.POST(request)).status, 500, 'Database failures must ask Stripe to retry');
  dbFailure = false;
  event.data.object.metadata.booking_kind = 'group_session';
  assert.equal((await webhook.POST(request)).status, 200);
  assert.equal(groupExpiries, 1);
  for (const type of ['checkout.session.completed', 'checkout.session.async_payment_succeeded']) {
    event = { type, data: { object: { id: 'cs_test_current', payment_status: 'unpaid', metadata: { booking_id: 'booking-1' } } } };
    const before = confirmations;
    await webhook.POST(request);
    assert.equal(confirmations, before);
    event.data.object.payment_status = 'paid';
    await webhook.POST(request);
    assert.equal(confirmations, before + 1, 'Paid events retain the verified fulfillment path');
  }
  console.log('PASS: retired ID-only retry, stable idempotency, signed/current-session-only failure handling');
})().catch(error => { console.error(error); process.exit(1); });
