const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function load(file) {
  const output = { exports: {} }
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(output.exports, require)
  return output.exports
}
function request(ip = '192.0.2.1') { return new Request('https://example.test', { headers: { 'x-vercel-forwarded-for': ip } }) }
const environmentKeys = ['NODE_ENV', 'VERCEL', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'RATE_LIMIT_KEY_SECRET', 'RATE_LIMIT_NAMESPACE', 'RATE_LIMIT_LOCAL_FALLBACK']

test('distributed limiter shares backend decisions, hides identifiers, and fails closed for writes', async () => {
  const old = Object.fromEntries(environmentKeys.map(k => [k, process.env[k]]))
  const oldFetch = global.fetch
  try {
    Object.assign(process.env, { NODE_ENV: 'production', VERCEL: '1', UPSTASH_REDIS_REST_URL: 'https://redis.example.test', UPSTASH_REDIS_REST_TOKEN: 'test-only-token', RATE_LIMIT_KEY_SECRET: 'test-only-secret-at-least-thirty-two-characters', RATE_LIMIT_NAMESPACE: 'test', RATE_LIMIT_LOCAL_FALLBACK: 'true' })
    const workers = [load('rate-limit.ts'), load('rate-limit.ts')]
    // Shared atomic store double: verifies two independent module instances use
    // the same backend keys. Live Lua/Redis integration is a separate release gate.
    const counts = new Map()
    global.fetch = async (url, options) => {
      assert.equal(String(url), 'https://redis.example.test/')
      assert.equal(options.redirect, 'error')
      assert.equal(options.headers.Authorization, 'Bearer test-only-token')
      assert.ok(!options.body.includes('192.0.2.1'))
      assert.ok(!options.body.includes('customer@example.test'))
      const [command, script, size, ...rest] = JSON.parse(options.body)
      assert.equal(command, 'EVAL')
      assert.equal(script, workers[0].RATE_LIMIT_SCRIPT)
      assert.ok(script.includes("redis.call('TIME')"))
      const keys = rest.slice(0, size)
      const args = rest.slice(size)
      const blocked = keys.some((key, i) => (counts.get(key) || 0) >= args[1 + i * 2])
      if (!blocked) keys.forEach(key => counts.set(key, (counts.get(key) || 0) + 1))
      return Response.json({ result: blocked ? [0, 60_000] : [1, 0] })
    }
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => workers[i % 2].enforceRateLimit(request(), { policy: 'booking', subject: 'customer@example.test' })))
    assert.equal(results.filter(r => r === null).length, 5)
    for (const response of results.filter(Boolean)) { assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '60') }
    global.fetch = async () => { throw new Error('unavailable') }
    assert.equal((await workers[0].enforceRateLimit(request(), { policy: 'adminLogin' })).status, 503)
    assert.equal(await workers[0].enforceRateLimit(request(), { policy: 'privateRead', subject: 'verified-user' }), null)
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    assert.equal((await workers[0].enforceRateLimit(request(), { policy: 'guestRequest', subject: 'booking' })).status, 503)
    process.env.RATE_LIMIT_KEY_SECRET = ''
    assert.equal((await workers[0].enforceRateLimit(request(), { policy: 'booking' })).status, 503)
  } finally {
    global.fetch = oldFetch
    for (const [key, value] of Object.entries(old)) if (value === undefined) delete process.env[key]; else process.env[key] = value
  }
})

test('trusted IP source ignores spoofable headers and canonicalises IPv6', () => {
  const old = process.env.VERCEL
  const limiter = load('rate-limit.ts')
  try {
    delete process.env.VERCEL
    assert.equal(limiter.trustedClientIp(request()), 'unknown')
    process.env.VERCEL = '1'
    assert.equal(limiter.trustedClientIp(new Request('https://example.test', { headers: { 'x-forwarded-for': '192.0.2.9' } })), 'unknown')
    assert.equal(limiter.trustedClientIp(request('192.0.2.1, 192.0.2.2')), 'unknown')
    assert.equal(limiter.trustedClientIp(request('2001:db8:0:0:0:0:0:1')), limiter.trustedClientIp(request('2001:db8::1')))
  } finally { if (old === undefined) delete process.env.VERCEL; else process.env.VERCEL = old }
})

test('JSON reader rejects actual oversized stream bytes and invalid shapes', async () => {
  const { readJsonBody } = load('request-body.ts')
  const post = body => new Request('https://example.test', { method: 'POST', body })
  assert.deepEqual(await readJsonBody(post('{"ok":true}')), { ok: true })
  for (const body of ['null', '[]', 'not-json']) await assert.rejects(readJsonBody(post(body)), e => e.status === 400)
  await assert.rejects(readJsonBody(post(JSON.stringify({ value: 'é'.repeat(20) })), 30), e => e.status === 413)
})
