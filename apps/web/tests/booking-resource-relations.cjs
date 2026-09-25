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
    if (!(name in deps)) throw new Error(`Unexpected dependency ${name}`);
    return deps[name];
  }, module, module.exports);
  return module.exports;
}
test('booking notifications disambiguate the physical lane from its pricing resource', async () => {
  const sent = [], updates = [];
  const worker = load('apps/web/lib/services/booking-outbox.ts', {
    '@/lib/services/supabase': { supabaseAdmin: {
      rpc: async () => ({ data: ['customer', 'admin'].map(role => ({ id: role, recipient_role: role, resource_booking_id: 'booking', attempts: 1, payment: { amount: 1275 } })) }),
      from() {
        let select;
        return {
          select(value) { select = value; return this; }, eq() { return this; },
          single: async () => select.includes('resources!bookings_resource_id_fkey(name)')
            ? { data: { payment_status: 'paid', resource: { name: 'Lane 4' } } }
            : { error: { code: 'PGRST201' } },
          update(value) { updates.push(value); return this; },
          then(resolve) { return Promise.resolve({ error: null }).then(resolve); },
        };
      },
    } },
    '@/lib/services/email': {
      sendBookingConfirmation: async (booking, id) => { assert.equal(booking.resource_name, 'Lane 4'); sent.push(id); return true; },
      sendAdminBookingNotification: async (_, id) => { sent.push(id); return true; },
      sendGroupSessionConfirmation: async () => { throw new Error('Unexpected group booking'); },
    },
  });
  assert.deepEqual(await worker.dispatchBookingNotifications(), { inspected: 2, sent: 2, deferred: 0 });
  assert.deepEqual(sent, ['customer', 'admin']);
  assert.ok(updates.every(update => update.state === 'sent'));
});
test('all booking resource embeds explicitly use the physical resource foreign key', () => {
  for (const file of ['app/api/bookings/route.ts', 'app/api/admin/bookings/route.ts', 'app/api/admin/stats/route.ts', 'app/api/payments/verify-session/route.ts', 'lib/services/booking-outbox.ts']) {
    const source = fs.readFileSync(path.join(root, 'apps/web', file), 'utf8');
    assert.ok(source.includes('resources!bookings_resource_id_fkey('), file);
    assert.doesNotMatch(source, /\bresources\s*\(/, file);
  }
});
test('payment success returns the physical lane for object and array relation responses', async () => {
  let resource = { name: 'Lane 4' };
  const route = load('apps/web/app/api/payments/verify-session/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } },
    '@/lib/services/supabase': { supabaseAdmin: { from() { return {
      select(value) { assert.ok(value.includes('resource:resources!bookings_resource_id_fkey(name)')); return this; },
      eq() { return this; }, single: async () => ({ data: { booking_reference: 'TEST', resource } }),
    }; } } },
    '@/lib/services/stripe': { getStripe: () => ({ checkout: { sessions: { retrieve: async () => ({ id: 'cs_test_fixture123', payment_status: 'paid', metadata: { booking_id: 'booking' } }) } } }) },
    '@/lib/services/confirm-group-booking': {},
    '@/lib/services/block-bookings': {},
    '@/lib/services/confirm-booking': { confirmBooking: async () => {} },
    '@/lib/services/booking-outbox': { dispatchBookingNotifications: async () => {}, dispatchBlockBookingNotifications: async () => {} },
    '@/lib/security/guest-access': { guestSameOrigin: () => true, guestAccessEnabled: () => true, accessibleScope: async () => ({ id: 'scope' }) },
    '@/lib/security/rate-limit': { enforceRateLimit: async () => null },
    '@/lib/security/request-body': { readJsonBody: async () => ({ sessionId: 'cs_test_fixture123' }) },
  });
  for (resource of [{ name: 'Lane 4' }, [{ name: 'Lane 4' }]]) {
    const result = await route.POST({});
    assert.equal(result.status, 200);
    assert.equal(result.body.booking.resource_name, 'Lane 4');
  }
});
test('quoted booking email and document times use London DST without shifting legacy bookings', async () => {
  const requests = [], documents = [];
  const email = load('apps/web/lib/services/email.ts', {
    resend: { Resend: class {} },
    '@/lib/services/outbox-delivery': { sendDurableEmail: async (_, request) => { requests.push(request); return true; } },
    '@/lib/location': { LOCATION: { name: 'Centre', address: 'Test address', googleMapsUrl: 'https://maps.google.com', appleMapsUrl: 'https://maps.apple.com' } },
    '@/lib/services/booking-documents': { bookingAttachments: async data => { documents.push(data); return []; } },
    '@/lib/coupon-summary': { couponRows: () => [] },
  });
  for (const fixture of [
    { date: '2026-09-25', quote_id: 'quote', start: '14:00', end: '15:00', expected: '15:00', expectedEnd: '16:00' },
    { date: '2026-12-04', quote_id: 'quote', start: '15:00', end: '16:00', expected: '15:00', expectedEnd: '16:00' },
    { date: '2026-09-25', quote_id: null, start: '15:00', end: '16:00', expected: '15:00', expectedEnd: '16:00' },
  ]) {
    const booking = { booking_reference: 'TEST', customer_name: 'Test Customer', customer_email: 'test@example.invalid', service_type: 'lane_hire', booking_date: fixture.date, start_at: `${fixture.date}T${fixture.start}:00Z`, end_at: `${fixture.date}T${fixture.end}:00Z`, amount: '15', quote_id: fixture.quote_id };
    await email.sendBookingConfirmation(booking, 'customer');
    await email.sendAdminBookingNotification(booking, 'admin');
    assert.ok(requests.at(-2).html.includes(`${fixture.expected} – ${fixture.expectedEnd}`));
    assert.ok(requests.at(-1).html.includes(fixture.expected));
    assert.deepEqual(documents.at(-1).details.find(([label]) => label === 'Time'), ['Time', `${fixture.expected} - ${fixture.expectedEnd}`]);
  }
});
