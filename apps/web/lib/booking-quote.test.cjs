const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const moduleExports = {};
new Function('exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'booking-quote.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(moduleExports);
const { quoteResource, londonInstant, moneyPence } = moduleExports;
const now = Date.parse('2026-09-22T08:00:00Z');
function config() { return {
  resource: { id: 'lane', active: true, type: 'lane', peak_price: '25.00', offpeak_price: '15.00' },
  rules: Array.from({ length: 7 }, (_, day) => ({ id: String(day), day_of_week: day, start_time: day === 0 || day === 6 ? '09:00' : '15:00', end_time: '23:00', slot_duration_mins: 60, buffer_mins: 0, active: true })),
  prices: [], overrides: [], blocks: [], bookings: [],
}; }
const input = { serviceType: 'lane_hire', resourceId: 'lane', bookingDate: '2026-09-23', startTime: '16:00', durationMinutes: 120 };
test('London conversion handles winter/summer and rejects nonexistent/ambiguous DST times', () => {
  assert.equal(londonInstant('2026-09-23', '16:00'), '2026-09-23T15:00:00.000Z');
  assert.equal(londonInstant('2026-12-23', '16:00'), '2026-12-23T16:00:00.000Z');
  assert.throws(() => londonInstant('2027-03-28', '01:30'), /does not exist/);
  assert.throws(() => londonInstant('2026-10-25', '01:30'), /ambiguous/);
  assert.throws(() => londonInstant('2026-02-30', '16:00'), /valid date/);
});
test('cross-boundary price uses each hourly rate, not just start hour', () => {
  const q = quoteResource(input, config(), now);
  assert.equal(q.amountPence, 4000);
  assert.deepEqual(q.breakdown.map(p => p.hourlyPence), [1500, 2500]);
  assert.equal(quoteResource({ ...input, bookingDate: '2026-09-26', startTime: '09:00' }, config(), now).amountPence, 5000);
});
test('blocked interval takes precedence over custom prices including mid-booking overlap', () => {
  const c = config();
  c.overrides = [{ id: 'special', start_at: '2026-09-23T15:00:00Z', end_at: '2026-09-23T17:00:00Z', custom_price: '1.00', blocked: true }];
  assert.throws(() => quoteResource(input, c, now), /unavailable/);
  c.overrides = []; c.blocks = [{ start_at: '2026-09-23T16:30:00Z', end_at: '2026-09-23T16:45:00Z' }];
  assert.throws(() => quoteResource(input, c, now), /unavailable/);
});
test('overrides outrank rules; lower priority numbers win; equal-priority conflict fails', () => {
  const c = config();
  c.prices = [{ id: 'rule', active: true, days: [3], start_time: '15:00', end_time: '23:00', priority: 1, price: '30.00' }];
  assert.equal(quoteResource(input, c, now).amountPence, 6000);
  c.overrides = [{ id: 'override', start_at: '2026-09-23T15:00:00Z', end_at: '2026-09-23T16:00:00Z', custom_price: '10.00', blocked: false }];
  assert.equal(quoteResource(input, c, now).amountPence, 4000);
  c.prices.push({ ...c.prices[0], id: 'conflict', price: '20.00' });
  assert.throws(() => quoteResource(input, c, now), /Conflicting/);
});
test('rejects inactive/wrong resources, unsupported service and unsafe durations', () => {
  for (const durationMinutes of [-60, 0, 30, 841, Infinity]) assert.throws(() => quoteResource({ ...input, durationMinutes }, config(), now));
  assert.throws(() => quoteResource({ ...input, startTime: '22:00' }, config(), now), /selected day|opening hours/);
  assert.throws(() => quoteResource({ ...input, serviceType: 'fake' }, config(), now), /Unsupported/);
  const inactive = config(); inactive.resource.active = false;
  assert.throws(() => quoteResource(input, inactive, now), /unavailable/);
  const wrong = config(); wrong.resource.type = 'side_arm';
  assert.throws(() => quoteResource(input, wrong, now), /support/);
});
test('buffer availability checks adjacent reservations and missing base price fails closed', () => {
  const c = config(); c.rules.forEach(r => r.buffer_mins = 15);
  c.bookings = [{ start_at: '2026-09-23T17:10:00Z', end_at: '2026-09-23T18:10:00Z' }];
  assert.throws(() => quoteResource(input, c, now), /unavailable/);
  c.bookings = []; delete c.resource.peak_price;
  assert.throws(() => quoteResource(input, c, now), /configured price/);
});
test('minor-unit conversion rejects malformed, negative and sub-penny amounts', () => {
  assert.equal(moneyPence('10.09'), 1009);
  for (const value of ['0', '-1', '1.001', '1e3', 'NaN', undefined]) assert.throws(() => moneyPence(value));
  for (const price of ['0.01', '9999999999999.00']) {
    const c = config(); c.resource.peak_price = price; c.resource.offpeak_price = price;
    assert.throws(() => quoteResource(input, c, now), /payment limits/);
  }
});
test('SQL quote reservation guards are service-only, atomic and preserve financial snapshot', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../../supabase/migrations/20260922124455_authoritative_booking_quotes.sql'), 'utf8');
  for (const expected of ['enable row level security', 'from public, anon, authenticated', 'for update', 'pg_advisory_xact_lock', 'bookings_quote_once', 'q.amount_pence::numeric/100', 'configuration changed', 'booking_inventory_guard']) assert.ok(sql.toLowerCase().includes(expected.toLowerCase()), expected);
});

test('one fixed quote cookie binds the token to exactly one quote and rejects duplicates', () => {
  const exports = {};
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'services/booking-quotes.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(exports, name => {
    if (name === './supabase') return { supabaseAdmin: {} };
    if (name === '../booking-quote') return moduleExports;
    return require(name);
  });
  const id = '00000000-0000-0000-0000-000000000001';
  const other = '00000000-0000-0000-0000-000000000002';
  const token = 'a'.repeat(64);
  const cookie = `cricpro_quote=${id}.${token}`;
  const request = value => new Request('https://example.test/api/bookings', { headers: { cookie: value } });
  assert.equal(exports.quoteCookieName, 'cricpro_quote');
  assert.equal(exports.quoteCapability(request(cookie), id), exports.quoteTokenHash(token));
  assert.equal(exports.quoteCapability(request(cookie), other), null);
  assert.equal(exports.quoteCapability(request(`${cookie}; ${cookie}`), id), null);
  assert.equal(exports.quoteCapability(request(`cricpro_quote=${id}.bad`), id), null);
});
