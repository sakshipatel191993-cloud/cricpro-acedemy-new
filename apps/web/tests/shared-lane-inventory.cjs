const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, deps = {}) {
  const exports = {};
  new Function('exports', 'require', ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText)(exports, name => {
    if (name in deps) return deps[name];
    throw new Error(`Unexpected dependency ${name}`);
  });
  return exports;
}

const engine = load('lib/booking-quote.ts');
const service = load('lib/services/booking-quotes.ts', {
  'node:crypto': require('node:crypto'),
  './supabase': { supabaseAdmin: {} },
  '../booking-quote': engine,
});

function futureDate() {
  return new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
}

function configuration(date) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return {
    resources: [
      { id: 'lane-1', name: 'Lane 1', type: 'lane', active: true },
      { id: 'side-arm', name: 'Side Arm', type: 'side_arm', active: true },
    ],
    resource_availability_rules: [
      { id: 'lane-hours', resource_id: 'lane-1', day_of_week: weekday, start_time: weekday === 0 || weekday === 6 ? '09:00' : '15:00', end_time: '23:00', slot_duration_mins: 60, buffer_mins: 0, active: true },
    ],
    pricing_rules: [
      { id: 'lane-price', resource_id: 'lane-1', days: [weekday], start_time: '09:00', end_time: '23:00', price: '25', priority: 1, active: true },
      { id: 'side-arm-price', resource_id: 'side-arm', days: [weekday], start_time: '09:00', end_time: '23:00', price: '30', priority: 1, active: true },
    ],
    slot_overrides: [],
    blocked_slots: [],
  };
}

test('side-arm uses lane availability and service pricing on the same lane inventory', async () => {
  const bookingDate = futureDate();
  const weekday = new Date(`${bookingDate}T12:00:00Z`).getUTCDay();
  const startTime = weekday === 0 || weekday === 6 ? '09:00' : '15:00';
  const input = { serviceType: 'side_arm', resourceId: 'lane-1', bookingDate, startTime, durationMinutes: 60 };
  const snapshot = configuration(bookingDate);

  const quote = await service.authoritativeQuote(input, snapshot, []);
  assert.equal(quote.resourceId, 'lane-1');
  assert.equal(quote.pricingResourceId, 'side-arm');
  assert.equal(quote.amountPence, 3000);
  assert.equal(snapshot.resource_availability_rules.some(rule => rule.resource_id === 'side-arm'), false);

  await assert.rejects(
    () => service.authoritativeQuote(input, snapshot, [{ resource_id: 'lane-1', pricing_resource_id: 'lane-1', start_at: quote.startAt, end_at: quote.endAt, buffer_mins: 0 }]),
    /unavailable/,
  );

  await assert.rejects(
    () => service.authoritativeQuote(
      { ...input, serviceType: 'lane_hire' },
      snapshot,
      [{ resource_id: 'lane-1', pricing_resource_id: 'side-arm', start_at: quote.startAt, end_at: quote.endAt, buffer_mins: 0 }],
    ),
    /unavailable/,
  );
});

test('equipment conflicts remain shared across physical lanes', async () => {
  const bookingDate = futureDate();
  const weekday = new Date(`${bookingDate}T12:00:00Z`).getUTCDay();
  const startTime = weekday === 0 || weekday === 6 ? '09:00' : '15:00';
  const snapshot = configuration(bookingDate);
  snapshot.resources.push({ id: 'lane-2', name: 'Lane 2', type: 'lane', active: true });
  snapshot.resource_availability_rules.push({ ...snapshot.resource_availability_rules[0], id: 'lane-2-hours', resource_id: 'lane-2' });
  snapshot.pricing_rules.push({ ...snapshot.pricing_rules[0], id: 'lane-2-price', resource_id: 'lane-2' });
  const input = { serviceType: 'side_arm', resourceId: 'lane-2', bookingDate, startTime, durationMinutes: 60 };
  const available = await service.authoritativeQuote(input, snapshot, []);

  await assert.rejects(
    () => service.authoritativeQuote(input, snapshot, [{ resource_id: 'lane-1', pricing_resource_id: 'side-arm', start_at: available.startAt, end_at: available.endAt, buffer_mins: 0 }]),
    /unavailable/,
  );
});
