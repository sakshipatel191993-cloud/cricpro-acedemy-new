const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, deps = {}) {
  const exports = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(exports, name => {
    if (name in deps) return deps[name];
    throw new Error(`Unexpected dependency ${name}`);
  });
  return exports;
}
const engine = load('lib/booking-quote.ts');
const { blockBookingDates, blockBookingMaxEndDate } = load('lib/block-booking.ts', { '@/lib/booking-quote': engine });
test('weekly dates are inclusive, unique and calendar bounded', () => {
  assert.deepEqual(blockBookingDates({ startDate: '2026-09-24', endDate: '2026-10-08', weekdays: [4, 4] }), ['2026-09-24', '2026-10-01', '2026-10-08']);
  assert.doesNotThrow(() => blockBookingDates({ startDate: '2026-10-31', endDate: '2027-02-28', weekdays: [0] }));
  assert.equal(blockBookingMaxEndDate('2026-10-31'), '2027-02-28');
  assert.equal(blockBookingMaxEndDate('2026-11-30'), '2027-03-30');
  assert.equal(blockBookingMaxEndDate('2026-02-30'), null);
  assert.throws(() => blockBookingDates({ startDate: '2026-10-31', endDate: '2027-03-01', weekdays: [0] }), /four months/);
  for (const schedule of [
    { startDate: '2026-02-30', endDate: '2026-03-01', weekdays: [0] },
    { startDate: '2026-10-08', endDate: '2026-09-24', weekdays: [4] },
    { startDate: '2026-09-24', endDate: '2026-09-24', weekdays: [5] },
    { startDate: '2026-09-24', endDate: '2026-10-08', weekdays: [7] },
  ]) assert.throws(() => blockBookingDates(schedule), error => error.status === 400);
});
test('block checkout recovery validates kind and amount, then confirms or expires the whole block', async () => {
  let confirmed = 0, expired = 0, attached = 0;
  const session = { id: 'cs_block', metadata: { booking_id: 'b', booking_kind: 'block' }, mode: 'payment', currency: 'gbp', amount_total: 5500, payment_status: 'unpaid', status: 'open', url: 'https://checkout.stripe.com/test' };
  const helper = load('lib/services/checkout-attempts.ts', {
    '@/lib/services/supabase': { supabaseAdmin: { rpc: async name => { assert.equal(name, 'attach_block_checkout'); attached++; return {}; } } },
    '@/lib/services/stripe': { getStripe: () => ({ checkout: { sessions: { retrieve: async () => session } } }), createCheckoutSession: async () => ({ sessionId: session.id }) },
    '@/lib/services/confirm-booking': { confirmBooking: () => assert.fail('single confirmation') },
    '@/lib/services/confirm-group-booking': { confirmGroupBooking: () => assert.fail('group confirmation') },
    '@/lib/services/block-bookings': { confirmBlockBooking: async () => confirmed++, expireBlockBooking: async () => expired++ },
  });
  const attempt = { id: 'block:b', block_booking_id: 'b', resource_booking_id: null, group_booking_id: null, params: { bookingId: 'b', amount: '55' }, created_at: new Date().toISOString(), stripe_session_id: null };
  assert.equal((await helper.resumeCheckoutAttempt(attempt)).url, session.url);
  assert.equal(attached, 1);
  attempt.stripe_session_id = session.id;
  session.amount_total = 5000;
  await assert.rejects(() => helper.resumeCheckoutAttempt(attempt), /match/);
  session.amount_total = 5500;
  session.metadata.booking_kind = 'group_session';
  await assert.rejects(() => helper.resumeCheckoutAttempt(attempt), /match/);
  session.metadata.booking_kind = 'block'; session.status = 'complete'; session.payment_status = 'paid';
  assert.equal((await helper.resumeCheckoutAttempt(attempt)).url, null);
  assert.equal(confirmed, 1);
  session.status = 'expired'; session.payment_status = 'unpaid';
  await helper.resumeCheckoutAttempt(attempt);
  assert.equal(expired, 1);
});

test('booking endpoint rejects discounts and missing capability before reservation', async () => {
  let body = { quoteId: 'q', customerName: 'Test', customerEmail: 'test@example.invalid', couponCode: 'SAVE' };
  const route = load('app/api/block-bookings/route.ts', {
    'next/server': { NextResponse: { json: (value, options) => ({ value, status: options.status }) } },
    '@/lib/services/supabase': { supabaseAdmin: { rpc: () => assert.fail('must not reserve') } },
    '@/lib/services/stripe': { paymentsEnabled: true },
    '@/lib/security/admin-auth': { isSameOriginRequest: () => true },
    '@/lib/security/rate-limit': { enforceRateLimit: async () => null },
    '@/lib/security/request-body': { readJsonBody: async () => body, RequestBodyError: class extends Error {} },
    '@/lib/services/booking-quotes': { requireQuoteRollout: () => {}, quoteCapability: () => null },
    '@/lib/services/block-bookings': { blockQuoteCookieName: 'block' },
    '@/lib/booking-quote': engine,
    '@/lib/services/checkout-attempts': { checkoutAppUrl: () => 'http://127.0.0.1:3001', startPersistedCheckout: () => assert.fail('must not charge') },
    '@/lib/security/guest-access': {}, '@/lib/services/whatsapp': {},
  });
  assert.equal((await route.POST({})).status, 400);
  delete body.couponCode;
  assert.equal((await route.POST({})).status, 403);
  body = { ...body, discountMinor: 100 };
  assert.equal((await route.POST({})).status, 400);
});

test('block quotes sum authoritative prices and persist the configuration without exposing it', async () => {
  let inserted;
  const config = { secretConfiguration: true };
  const service = load('lib/services/block-bookings.ts', {
    'node:crypto': require('node:crypto'),
    './booking-quotes': {
      loadQuoteConfiguration: async () => config, loadQuoteBookings: async () => [], quoteTokenHash: () => 'hash',
      authoritativeQuote: async input => ({ ...input, resourceName: 'Lane', amountPence: input.bookingDate === '2026-09-24' ? 2500 : 3000, configuration: config }),
    },
    './supabase': { supabaseAdmin: { from: () => ({ insert: async value => { inserted = value; return {}; } }) } },
    './stripe': {}, './booking-documents': {}, '../block-booking': { blockBookingDates }, '../booking-quote': engine,
  });
  const result = await service.storeBlockQuote({ startDate: '2026-09-24', endDate: '2026-10-01', weekdays: [4], resourceId: 'lane', startTime: '16:00', durationMinutes: 60 });
  assert.equal(result.quote.amountPence, 5500);
  assert.equal(inserted.amount_pence, 5500);
  assert.equal(inserted.configuration, config);
  assert.equal(result.quote.occurrences[0].configuration, undefined);
  assert.equal(result.cookie.options.httpOnly, true);
});

test('six-week weekend blocks use the £22.50 hourly rate in the persisted payment quote', async () => {
  let inserted;
  const service = load('lib/services/block-bookings.ts', {
    'node:crypto': require('node:crypto'),
    './booking-quotes': {
      loadQuoteConfiguration: async () => ({}), loadQuoteBookings: async () => [], quoteTokenHash: () => 'hash',
      authoritativeQuote: async input => ({ ...input, resourceName: 'Lane', amountPence: 2500, breakdown: [{ hourlyPence: 2500, minutes: 60 }] }),
    },
    './supabase': { supabaseAdmin: { from: () => ({ insert: async value => { inserted = value; return {}; } }) } },
    './stripe': {}, './booking-documents': {}, '../block-booking': { blockBookingDates }, '../booking-quote': engine,
  });
  const result = await service.storeBlockQuote({ startDate: '2026-09-26', endDate: '2026-11-07', weekdays: [6], resourceId: 'lane', startTime: '09:00', durationMinutes: 60 });
  assert.equal(result.quote.standardAmountPence, 17_500);
  assert.equal(result.quote.discountPence, 1_750);
  assert.equal(result.quote.amountPence, 15_750);
  assert.equal(result.quote.occurrences[0].amountPence, 2_250);
  assert.equal(inserted.amount_pence, 15_750);
});
