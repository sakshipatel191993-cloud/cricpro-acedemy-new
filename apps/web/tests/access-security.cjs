const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(path, mocks) {
  const mod = { exports: {} };
  const source = ts.transpile(fs.readFileSync(path, 'utf8'), { module: ts.ModuleKind.CommonJS });
  new Function('exports', 'require', source)(mod.exports, name => {
    if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
    return mocks[name];
  });
  return mod.exports;
}

(async () => {
  let admin = false, identity = null, reads = 0, filters = [];
  const rows = [{ id: 'a', user_id: 'alice' }, { id: 'b', user_id: 'bob' }];
  const db = { from() {
    reads++; filters = [];
    const query = {
      select() { return this; }, order() { return this; }, limit() { return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      then(resolve) { resolve({ data: rows.filter(row => filters.every(([k,v]) => row[k] === v)), error: null }); },
    };
    return query;
  } };
  const mocks = {
    '@/lib/services/coupons': { couponsEnabled:()=>false, couponRequest:async()=>({}) },
    'next/server': { NextResponse: { json: (data, options = {}) => ({ data, status: options.status ?? 200, headers: options.headers }) } },
    '@/lib/services/supabase': { supabaseAdmin: db, isSupabaseConfigured: true },
    '@/lib/security/admin-auth': { isAdminRequest: async () => admin },
    '@/lib/security/customer-auth': { getVerifiedCustomerId: async () => identity },
    '@/lib/services/email': {}, '@/lib/services/stripe': {}, '@/lib/utils/rate-limit': {}, '@/lib/hours': {},
    '@/lib/security/rate-limit': { enforceRateLimit:async()=>null },
    '@/lib/security/request-body': {}, '@/lib/services/booking-quotes': {}, '@/lib/booking-quote': {},
    '@/lib/services/checkout-attempts': {}, '@/lib/security/guest-access': { guestAccessEnabled:()=>false },
  };
  const bookings = load('apps/web/app/api/bookings/route.ts', mocks);
  const inquiries = load('apps/web/app/api/inquiries/route.ts', mocks);
  const request = { nextUrl: new URL('https://example.test/api/bookings?email=bob@example.test&user_id=bob') };
  assert.equal((await bookings.GET(request)).status, 401);
  assert.equal((await inquiries.GET(request)).status, 401);
  assert.equal(reads, 0, 'unauthenticated requests must not query data');
  identity = 'alice';
  const result = await bookings.GET(request);
  assert.deepEqual(result.data.bookings, [rows[0]], 'customer cannot request another owner or email');
  assert.deepEqual(filters, [['user_id', 'alice']]);
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
  assert.equal((await inquiries.GET(request)).status, 401, 'customer is not administrator');
  const before = reads;
  assert.equal((await bookings.DELETE(request)).status, 410);
  assert.equal(reads, before, 'retired cancellation must never read or mutate bookings');
  admin = true;
  assert.equal((await bookings.GET({ nextUrl: new URL('https://example.test/api/bookings') })).data.bookings.length, 2);
  assert.equal((await inquiries.GET({ nextUrl: new URL('https://example.test/api/inquiries') })).status, 200);

  let authCalls = 0;
  const customerAuth = load('apps/web/lib/security/customer-auth.ts', {
    '@/lib/services/supabase': { isSupabaseConfigured: true, supabaseAdmin: { auth: { async getUser(token) {
      authCalls++;
      return token === 'valid' ? { data: { user: { id: 'alice' } }, error: null } : { data: { user: null }, error: new Error('Invalid token') };
    } } } },
  });
  assert.equal(await customerAuth.getVerifiedCustomerId(new Request('https://example.test')), null);
  assert.equal(authCalls, 0);
  assert.equal(await customerAuth.getVerifiedCustomerId(new Request('https://example.test', { headers: { Authorization: 'Bearer forged' } })), null);
  assert.equal(await customerAuth.getVerifiedCustomerId(new Request('https://example.test', { headers: { Authorization: 'Bearer valid' } })), 'alice');
  console.log('PASS: public rejection, cross-owner isolation, admin access, fail-closed bearer validation, retired cancellation without mutations');
})().catch(error => { console.error(error); process.exitCode = 1; });
