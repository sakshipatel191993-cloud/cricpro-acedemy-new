const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file, resolver = require) {
  const exports = {}
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8')
  new Function('exports', 'require', ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText)(exports, resolver)
  return exports
}

const auth = load('admin-auth.ts')
const { safeReturnPath } = load('return-path.ts')

test('return destinations reject external, executable, encoded and malformed paths', () => {
  for (const input of [null, '', 'https://evil.invalid', '//evil.invalid', 'javascript:alert(1)', '/\\evil.invalid', '/%2fevil.invalid', '/%252fevil.invalid', '/%5cevil.invalid', '/%0aevil.invalid', '/%', '/api/bookings', '/login']) {
    assert.equal(safeReturnPath(input), '/', String(input))
  }
  assert.equal(safeReturnPath('/booking-confirm?draft=abc#details'), '/booking-confirm?draft=abc#details')
  assert.equal(safeReturnPath('/account'), '/account')
  assert.equal(safeReturnPath('//evil.invalid', '/admin'), '/admin')
})

test('admin sessions and password verification fail closed and reject forged/expired/future cookies', async () => {
  const savedPassword = process.env.ADMIN_PASSWORD
  const savedSecret = process.env.ADMIN_SECRET
  try {
    delete process.env.ADMIN_PASSWORD
    delete process.env.ADMIN_SECRET
    assert.equal(auth.adminAuthConfigured(), false)
    assert.equal(await auth.verifyAdminPassword('admin123'), false)
    await assert.rejects(auth.createAdminSession())
    process.env.ADMIN_PASSWORD = 'test-password-only-not-a-real-secret'
    process.env.ADMIN_SECRET = 'test-only-HMAC-secret-longer-than-32-characters'
    assert.equal(auth.adminAuthConfigured(), true)
    assert.equal(await auth.verifyAdminPassword(process.env.ADMIN_PASSWORD), true)
    for (const input of [undefined, null, 17, {}, 'wrong']) assert.equal(await auth.verifyAdminPassword(input), false)
    const now = Date.now()
    const token = await auth.createAdminSession(now)
    assert.equal(await auth.verifyAdminSession(token, now), true)
    assert.equal(await auth.verifyAdminSession(token, now + auth.ADMIN_SESSION_TTL_MS), false)
    assert.equal(await auth.verifyAdminSession(token, now - 1), false)
    for (const input of [token + '.extra', token.replace('.', 'x.'), `${now}.${'0'.repeat(64)}`, 'bad']) assert.equal(await auth.verifyAdminSession(input, now), false)
    const request = new Request('https://example.test/api/admin/bookings', { headers: { cookie: `other=1; admin_session=${token}`, origin: 'https://example.test' } })
    assert.equal(await auth.isAdminRequest(request), true)
    assert.equal(await auth.isAdminMutationRequest(request), true)
    assert.equal(await auth.isAdminRequest(new Request(request.url)), false)
    assert.equal(await auth.isAdminRequest(new Request(request.url, { headers: { cookie: `admin_session=${token}; admin_session=${token}` } })), false)
    process.env.ADMIN_SECRET = 'rotated-test-only-secret-longer-than-32-characters'
    assert.equal(await auth.verifyAdminSession(token), false)
    process.env.ADMIN_SECRET = ''
    assert.equal(auth.adminAuthConfigured(), false)
  } finally {
    if (savedPassword === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = savedPassword
    if (savedSecret === undefined) delete process.env.ADMIN_SECRET; else process.env.ADMIN_SECRET = savedSecret
  }
})

test('existing configured credentials remain usable without forced rotation', async () => {
  const savedPassword = process.env.ADMIN_PASSWORD
  const savedSecret = process.env.ADMIN_SECRET
  try {
    for (const [password, secret] of [
      ['short-test', 'short-test-secret'],
      ['admin123', 'your-test-secret'],
      ['ngca-admin-2024', 'ngca-admin-secret-change-in-production'],
    ]) {
      process.env.ADMIN_PASSWORD = password
      process.env.ADMIN_SECRET = secret
      assert.equal(auth.adminAuthConfigured(), true)
      assert.equal(await auth.verifyAdminPassword(password), true)
      assert.equal(await auth.verifyAdminPassword('incorrect-test-password'), false)
      const token = await auth.createAdminSession()
      assert.equal(await auth.verifyAdminSession(token), true)
      assert.equal(process.env.ADMIN_PASSWORD, password)
      assert.equal(process.env.ADMIN_SECRET, secret)
    }
    process.env.ADMIN_PASSWORD = ''
    assert.equal(auth.adminAuthConfigured(), false)
    assert.equal(await auth.verifyAdminPassword(''), false)
  } finally {
    if (savedPassword === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = savedPassword
    if (savedSecret === undefined) delete process.env.ADMIN_SECRET; else process.env.ADMIN_SECRET = savedSecret
  }
})

test('mutation origin guard requires matching origin, not just same-site', () => {
  const url = 'https://example.test/api/admin/auth'
  for (const headers of [{}, { origin: 'null' }, { origin: 'https://evil.test' }, { origin: 'https://sub.example.test' }, { origin: 'https://example.test', 'sec-fetch-site': 'cross-site' }]) {
    assert.equal(auth.isSameOriginRequest(new Request(url, { headers })), false)
  }
  assert.equal(auth.isSameOriginRequest(new Request(url, { headers: { origin: 'https://example.test' } })), true)
})

test('admin login route rejects unsafe requests and applies throttling before checking passwords', async () => {
  let configured = true
  let allowed = true
  let passwordChecks = 0
  const json = (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers, cookies: { set() {}, delete() {} } })
  const route = load('../../app/api/admin/auth/route.ts', name => {
    if (name === 'next/server') return { NextResponse: { json } }
    if (name === '@/lib/security/admin-auth') return {
      adminAuthConfigured: () => configured, isSameOriginRequest: auth.isSameOriginRequest,
      verifyAdminPassword: async password => { passwordChecks++; return password === 'test-password' },
      createAdminSession: async () => 'test-session',
    }
    if (name === '@/lib/security/rate-limit') return { enforceRateLimit: async () => allowed ? null : new Response(null, { status: 429 }) }
    if (name === '@/lib/security/request-body') return load('request-body.ts')
    return require(name)
  })
  const request = (body = JSON.stringify({ password: 'test-password' }), origin = 'https://example.test') => new Request('https://example.test/api/admin/auth', { method: 'POST', headers: { origin }, body })
  assert.equal((await route.POST(request(undefined, 'https://evil.test'))).status, 403)
  configured = false
  assert.equal((await route.POST(request())).status, 503)
  configured = true; allowed = false
  assert.equal((await route.POST(request())).status, 429)
  assert.equal(passwordChecks, 0)
  allowed = true
  assert.equal((await route.POST(request('invalid-json'))).status, 400)
  assert.equal((await route.POST(request('x'.repeat(4097)))).status, 413)
  assert.equal((await route.POST(request(JSON.stringify({ password: 'wrong' })))).status, 401)
  assert.equal((await route.POST(request())).status, 200)
  assert.equal((await route.DELETE(request(undefined, 'https://evil.test'))).status, 403)
})

test('middleware authenticates admin routes and rejects cross-origin mutations', async () => {
  let authenticated = false
  const middleware = load('../../middleware.ts', name => {
    if (name === 'next/server') return { NextResponse: {
      next: () => ({ status: 200 }), json: (body, options) => ({ body, ...options }),
      redirect: url => ({ status: 307, url: String(url) }),
    } }
    if (name === './lib/security/admin-auth') return {
      isAdminRequest: async () => authenticated, isSameOriginRequest: auth.isSameOriginRequest,
    }
    return require(name)
  }).middleware
  const request = (pathname, method = 'GET', origin = 'https://example.test') => {
    const req = new Request(`https://example.test${pathname}`, { method, headers: { origin } })
    req.nextUrl = new URL(req.url)
    return req
  }
  assert.equal((await middleware(request('/api/admin/bookings'))).status, 401)
  assert.equal((await middleware(request('/admin'))).status, 307)
  assert.equal((await middleware(request('/admin/login'))).status, 200)
  assert.equal((await middleware(request('/admin/login-other'))).status, 307)
  assert.equal((await middleware(request('/api/admin/auth-other'))).status, 401)
  authenticated = true
  assert.equal((await middleware(request('/api/admin/bookings'))).status, 200)
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal((await middleware(request('/api/admin/bookings', method, 'https://evil.test'))).status, 403)
    assert.equal((await middleware(request('/api/admin/bookings', method))).status, 200)
  }
})
