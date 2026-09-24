const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function load(file, resolver = require) {
  const exports = {}
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(exports, resolver)
  return exports
}
const confirmation = load('confirmed-customer.ts')
test('only Auth-confirmed, non-anonymous customers qualify', () => {
  for (const user of [null, undefined, {}, { email_confirmed_at: null }, { user_metadata: { email_verified: true } }, { email_confirmed_at: '2026-09-24', is_anonymous: true }]) {
    assert.equal(confirmation.isConfirmedCustomer(user), false)
  }
  assert.equal(confirmation.isConfirmedCustomer({ email_confirmed_at: '2026-09-24' }), true)
})
test('customer API guard requires server-verified email confirmation', async () => {
  let user = { id: 'customer-test', email_confirmed_at: null }
  let error = null
  let calls = 0
  const { getVerifiedCustomerId } = load('customer-auth.ts', name => {
    if (name === './confirmed-customer') return confirmation
    if (name === '@/lib/services/supabase') return {
      isSupabaseConfigured: true,
      supabaseAdmin: { auth: { getUser: async () => { calls++; return { data: { user }, error } } } },
    }
    return require(name)
  })
  const request = new Request('https://example.test/api/bookings', { headers: { authorization: 'Bearer test-token' } })
  assert.equal(await getVerifiedCustomerId(new Request(request.url)), null)
  assert.equal(calls, 0)
  assert.equal(await getVerifiedCustomerId(request), null)
  user = { ...user, email_confirmed_at: '2026-09-24' }
  assert.equal(await getVerifiedCustomerId(request), user.id)
  error = new Error('Invalid token')
  assert.equal(await getVerifiedCustomerId(request), null)
})
