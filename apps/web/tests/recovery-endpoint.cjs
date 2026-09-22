const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
let calls = 0, fail = false;
const deps = {
  'node:crypto': require('node:crypto'),
  '@/lib/services/checkout-attempts': { reconcileCheckoutAttempts: async n => { calls++; assert.equal(n, 20); if (fail) throw Error('private details'); return { checked: 0 }; } },
  '@/lib/services/booking-outbox': { dispatchBookingNotifications: async n => { calls++; assert.equal(n, 10); return { sent: 0 }; } },
};
const m = { exports: {} };
new Function('require', 'module', 'exports', ts.transpile(fs.readFileSync(path.join(__dirname, '../app/api/internal/payment-recovery/route.ts'), 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }))(n => deps[n], m, m.exports);
(async () => {
  const prior = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    const request = token => new Request('https://example.invalid/api/internal/payment-recovery', { headers: token ? { authorization: token } : {} });
    assert.equal((await m.exports.GET(request())).status, 401);
    process.env.CRON_SECRET = 'a'.repeat(32);
    assert.equal((await m.exports.GET(request('Bearer ' + 'b'.repeat(32)))).status, 401);
    assert.equal(calls, 0);
    const ok = await m.exports.GET(request('Bearer ' + process.env.CRON_SECRET));
    assert.equal(ok.status, 200); assert.equal(calls, 2); assert.equal(ok.headers.get('cache-control'), 'no-store');
    fail = true;
    const bad = await m.exports.GET(request('Bearer ' + process.env.CRON_SECRET));
    assert.equal(bad.status, 503); assert.ok(!(await bad.text()).includes('private details'));
    console.log('PASS: scheduler authentication, bounded work and redacted failure');
  } finally { if (prior === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prior; }
})().catch(e => { console.error(e); process.exitCode = 1; });
