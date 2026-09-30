const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function routeFor(booking, sessionOverrides = {}, existingRefunds = []) {
  const calls = { refunds: 0, updates: [], dispatches: 0 };
  const session = { id: 'cs_test', mode: 'payment', payment_status: 'paid', currency: 'gbp', amount_total: 2500,
    payment_intent: 'pi_test', metadata: { booking_id: booking.id }, ...sessionOverrides };
  const updated = { id: booking.id, status: 'cancelled', payment_status: 'refunded', refund_status: 'succeeded' };
  const query = {
    select() { return this; }, eq() { return this; }, in() { return this; },
    single: async () => ({ data: calls.updates.length ? updated : booking, error: null }),
    update(value) { calls.updates.push(value); return this; },
  };
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, 'route.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, console: { error() {} },
    require: name => name === 'next/server' ? { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } }
      : name.includes('/stripe') ? { getStripe: () => ({ checkout: { sessions: { retrieve: async () => session } }, refunds: {
        create: async () => { calls.refunds++; return { id: 're_test', status: 'succeeded' }; }, retrieve: async () => ({ id: 're_test', status: 'succeeded' }),
        list: async () => ({ data: existingRefunds }),
      } }) }
      : name.includes('/supabase') ? { supabaseAdmin: { from: () => query } }
      : { dispatchCancellationNotifications: async () => { calls.dispatches++; } },
  });
  return { post: exports.POST, calls };
}

const paid = { id: 'booking-1', status: 'confirmed', payment_status: 'paid', amount: '25.00', stripe_session_id: 'cs_test',
  stripe_refund_id: null, admin_cancelled_at: null, block_booking_id: null };
const request = (refund = true) => ({ json: async () => ({ kind: 'resource', id: paid.id, refund }) });

test('paid cancellation verifies Stripe payment and requests one full refund', async () => {
  const { post, calls } = routeFor(paid);
  const result = await post(request());
  assert.equal(result.status, 200);
  assert.equal(calls.refunds, 1);
  assert.equal(calls.updates[0].status, 'cancelled');
  assert.equal(calls.updates[0].payment_status, 'refunded');
  assert.ok(calls.updates[0].admin_cancelled_at);
  assert.equal(calls.dispatches, 1);
});

test('mismatched Stripe payment cannot be refunded', async () => {
  const { post, calls } = routeFor(paid, { amount_total: 2600 });
  const result = await post(request());
  assert.equal(result.status, 409);
  assert.equal(calls.refunds, 0);
  assert.equal(calls.updates.length, 0);
});

test('a prior refund is reused after an interrupted database write', async () => {
  const prior = { id: 're_prior', status: 'succeeded', amount: 2500, metadata: { booking_id: paid.id, booking_kind: 'resource' } };
  const { post, calls } = routeFor(paid, {}, [prior]);
  assert.equal((await post(request())).status, 200);
  assert.equal(calls.refunds, 0);
  assert.equal(calls.updates[0].stripe_refund_id, 're_prior');
});

test('pending checkout and block occurrences cannot be cancelled individually', async () => {
  for (const booking of [{ ...paid, status: 'pending_payment' }, { ...paid, block_booking_id: 'block-1' }]) {
    const { post, calls } = routeFor(booking);
    assert.equal((await post(request())).status, 409);
    assert.equal(calls.refunds, 0);
  }
});

test('cancel without refund never calls Stripe', async () => {
  const { post, calls } = routeFor(paid);
  assert.equal((await post(request(false))).status, 200);
  assert.equal(calls.refunds, 0);
  assert.equal(calls.updates[0].status, 'cancelled');
  assert.ok(calls.updates[0].admin_cancelled_at);
});
