const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { createHmac } = require('node:crypto')
const api = {}
function load(file, mocks = {}) {
  const exports = {}
  new Function('exports', 'require', ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(exports, name => mocks[name] || require(name))
  return exports
}
Object.assign(api, load('whatsapp.ts', { '../whatsapp-consent': load('../whatsapp-consent.ts') }))
const config = { WHATSAPP_ENABLED: 'true', WHATSAPP_PHONE_NUMBER_ID: '1234', WHATSAPP_ACCESS_TOKEN: 'mock', WHATSAPP_GRAPH_VERSION: 'v99.0', WHATSAPP_TEMPLATE_ENQUIRY: 'cricpro_enquiry_received' }
const request = () => ({ event: 'enquiry_received', phone: '+44 7700 900123', consent: api.recordWhatsAppConsent('+44 7700 900123', true), values: ['Test', 'Coaching'] })

test('normalizes UK/international phones and requires explicit consent', () => {
  assert.equal(api.normalizeWhatsAppPhone('07728 478115'), '447728478115')
  assert.equal(api.normalizeWhatsAppPhone('+44 7728 478115'), '447728478115')
  assert.equal(api.normalizeWhatsAppPhone('0044 7728 478115'), '447728478115')
  for (const invalid of ['hello', '', '+0 12345678', '44abc7728478115', '123']) assert.equal(api.normalizeWhatsAppPhone(invalid), null)
  assert.equal(api.recordWhatsAppConsent('+447700900123', 'true'), null)
  assert.throws(() => api.recordWhatsAppConsent('invalid', true))
})

test('never calls Meta while disabled, without consent, or for sender self-send', async () => {
  const never = () => { throw new Error('Unexpected network call') }
  assert.equal((await api.sendWhatsAppTemplate(request(), {}, never)).reason, 'disabled')
  assert.equal((await api.sendWhatsAppTemplate({ ...request(), consent: null }, config, never)).reason, 'no_consent')
  assert.equal((await api.sendWhatsAppTemplate({ ...request(), phone: '+447728478115' }, config, never)).reason, 'sender_equals_recipient')
  assert.equal((await api.sendWhatsAppTemplate({ ...request(), event: 'admin_enquiry' }, config, never)).reason, 'admin_disabled')
  assert.equal((await api.sendWhatsAppTemplate(request(), { WHATSAPP_ENABLED: 'true' }, never)).reason, 'missing_configuration')
})

test('sends approved template payload and distinguishes acceptance from delivery', async () => {
  const result = await api.sendWhatsAppTemplate(request(), config, async (url, options) => {
    assert.equal(url, 'https://graph.facebook.com/v99.0/1234/messages')
    const body = JSON.parse(options.body)
    assert.equal(body.to, '447700900123')
    assert.equal(body.type, 'template')
    assert.equal(body.template.name, 'cricpro_enquiry_received')
    assert.equal(body.template.components[0].parameters.length, 2)
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] }), { status: 200 })
  })
  assert.deepEqual(result, { status: 'accepted', messageId: 'wamid.test' })
})

test('rate limits are retryable but ambiguous failures are not blindly retried', async () => {
  assert.equal((await api.sendWhatsAppTemplate(request(), config, async () => new Response('', { status: 429 }))).retryable, true)
  assert.equal((await api.sendWhatsAppTemplate(request(), config, async () => { throw new Error('timeout') })).retryable, false)
  assert.equal((await api.sendWhatsAppTemplate(request(), config, async () => new Response('{}', { status: 200 }))).reason, 'ambiguous_response')
})

test('webhook signature verifies raw bytes and rejects tampering', () => {
  const body = '{"test":true}', secret = 'test-secret'
  const signature = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  assert.equal(api.verifyWhatsAppSignature(body, signature, secret), true)
  assert.equal(api.verifyWhatsAppSignature(body + ' ', signature, secret), false)
  assert.equal(api.verifyWhatsAppSignature(body, 'sha256=invalid', secret), false)
  assert.equal(api.verifyWhatsAppSignature(body, null, secret), false)
})

test('API consent is explicit, server stamped and disabled by default', () => {
  assert.deepEqual(api.whatsappConsentFields(null, false, 'false'), {})
  assert.deepEqual(api.whatsappConsentFields(null, undefined, 'false'), {})
  assert.throws(() => api.whatsappConsentFields('+447700900123', 'yes', 'true'), /Invalid WhatsApp consent/)
  assert.throws(() => api.whatsappConsentFields('+447700900123', true, 'false'), /not available/)
  assert.throws(() => api.whatsappConsentFields('', true, 'true'), /valid WhatsApp/)
  const fields = api.whatsappConsentFields('+447700900123', true, 'true')
  assert.equal(fields.whatsapp_consent.phone, '447700900123')
  assert.equal(fields.whatsapp_consent.version, 'transactional-v1')
  assert.ok(Math.abs(Date.now() - Date.parse(fields.whatsapp_consent.grantedAt)) < 1000)
})

const jobsApi = load('whatsapp-jobs.ts', { './supabase': { supabaseAdmin: null }, './whatsapp': api })
const demoApi = load('whatsapp-demo.ts', { './whatsapp': api })
test('demo never uses the network and handles fictional delivery, failure, consent and STOP', async () => {
  const originalFetch = global.fetch
  global.fetch = () => { throw new Error('Real network forbidden in demo') }
  try {
    assert.equal((await demoApi.runWhatsAppDemo(true, 'delivered')).status, 'delivered')
    assert.equal((await demoApi.runWhatsAppDemo(true, 'failed')).status, 'failed')
    assert.equal((await demoApi.runWhatsAppDemo(false, 'delivered')).status, 'skipped')
    assert.equal((await demoApi.runWhatsAppDemo(true, 'stopped')).status, 'skipped')
    assert.equal((await demoApi.runWhatsAppDemo(true, 'unpaid')).status, 'skipped')
  } finally { global.fetch = originalFetch }
})
test('demo endpoint is inaccessible in production and requires local same-origin requests', async () => {
  const route = load('../../app/api/dev/whatsapp-demo/route.ts', { '@/lib/services/whatsapp-demo': demoApi })
  const previous = process.env.NODE_ENV
  const req = (origin = 'http://localhost:3000') => new Request('http://localhost:3000/api/dev/whatsapp-demo', { method: 'POST', headers: { origin }, body: JSON.stringify({ consented: true, scenario: 'delivered' }) })
  try {
    process.env.NODE_ENV = 'production'
    assert.equal((await route.POST(req())).status, 404)
    process.env.NODE_ENV = 'development'
    assert.equal((await route.POST(req('https://example.com'))).status, 403)
    assert.equal((await route.POST(req())).status, 200)
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous }
})
const webhookApi = load('whatsapp-webhook.ts', { './whatsapp': api })
function booking() {
  return { id: 'booking-1', booking_reference: 'TEST-1', status: 'confirmed', payment_status: 'paid',
    customer_phone: '+447700900123', customer_name: 'Test Customer', service_type: 'lane_hire',
    start_at: '2026-10-01T12:00:00Z', whatsapp_consent: request().consent }
}
test('payload is gated by paid status, unchanged phone and recorded consent', () => {
  const row = booking(), phone = '447700900123'
  assert.equal(jobsApi.whatsappJobPayload('bookings', { ...row, status: 'pending_payment' }, phone), null)
  assert.equal(jobsApi.whatsappJobPayload('bookings', { ...row, payment_status: 'pending' }, phone), null)
  assert.equal(jobsApi.whatsappJobPayload('bookings', { ...row, status: 'cancelled' }, phone), null)
  assert.equal(jobsApi.whatsappJobPayload('bookings', { ...row, customer_phone: '+447700900456' }, phone), null)
  assert.equal(jobsApi.whatsappJobPayload('bookings', { ...row, whatsapp_consent: null }, phone), null)
  const payload = jobsApi.whatsappJobPayload('bookings', row, phone)
  assert.equal(payload.event, 'booking_confirmed')
  assert.equal(payload.values[3], '1 Oct 2026, 13:00') // UK summer time, not server timezone
  const group = jobsApi.whatsappJobPayload('group_session_bookings', { ...row, booking_reference: 'CCOE-A2B3C4', parent_phone: row.customer_phone,
    parent_name: 'Parent', session: { title: 'Group Cricket', schedule: 'Saturday at 10am' } }, phone)
  assert.deepEqual(group.values, ['Parent', 'CCOE-A2B3C4', 'Group Cricket', 'Saturday at 10am'])
})

test('webhook scopes account/phone, records statuses and only recognizes exact opt-out commands', () => {
  const value = { metadata: { phone_number_id: '1234' },
    statuses: [{ id: 'wamid.test', status: 'delivered', timestamp: String(Math.floor(Date.now() / 1000)) }],
    messages: [{ type: 'text', from: '447700900123', text: { body: ' STOP ' } },
      { type: 'text', from: '447700900456', text: { body: 'Please book me a session' } }] }
  const payload = { object: 'whatsapp_business_account', entry: [{ id: 'account', changes: [{ field: 'messages', value }] }] }
  const parsed = webhookApi.parseWhatsAppWebhook(payload, 'account', '1234')
  assert.deepEqual(parsed.stops, ['447700900123'])
  assert.equal(parsed.deliveries.length, 1)
  assert.deepEqual(webhookApi.parseWhatsAppWebhook(payload, 'wrong', '1234'), { deliveries: [], stops: [] })
  assert.deepEqual(webhookApi.parseWhatsAppWebhook(payload, 'account', 'wrong'), { deliveries: [], stops: [] })
  assert.deepEqual(webhookApi.parseWhatsAppWebhook(payload, 'account', '1234').deliveries, parsed.deliveries)
})

// Small fluent mock: update predicates are evaluated atomically at execution.
function database(overrides = {}) {
  const tables = { bookings: [booking()], whatsapp_opt_outs: [], whatsapp_jobs: [{ id: 'job-1', source_table: 'bookings',
    source_id: 'booking-1', event: 'booking_confirmed', phone: '447700900123', status: 'pending', attempts: 0,
    created_at: new Date().toISOString(), next_attempt_at: new Date(0).toISOString() }], ...overrides }
  return { tables, from(table) {
    const predicates = []; let patch, single = false, limit = Infinity
    const q = { select() { return q }, update(value) { patch = value; return q },
      eq(key, value) { predicates.push(row => row[key] === value); return q },
      lt(key, value) { predicates.push(row => row[key] < value); return q },
      lte(key, value) { predicates.push(row => row[key] <= value); return q },
      order() { return q }, limit(value) { limit = value; return q }, maybeSingle() { single = true; return q },
      then(resolve, reject) {
        const rows = tables[table].filter(row => predicates.every(p => p(row))).slice(0, limit)
        if (patch) rows.forEach(row => Object.assign(row, patch))
        const data = rows.map(row => ({ ...row }))
        return Promise.resolve({ data: single ? data[0] || null : data, error: null }).then(resolve, reject)
      } }
    return q
  } }
}

test('worker is disabled without flag; overlapping workers claim a job only once', async () => {
  const previous = process.env.WHATSAPP_ENABLED
  try {
    delete process.env.WHATSAPP_ENABLED
    assert.deepEqual(await jobsApi.processWhatsAppJobs(null), { disabled: true, processed: 0 })
    process.env.WHATSAPP_ENABLED = 'true'
    const db = database(); let calls = 0
    const send = async () => { calls++; return { status: 'accepted', messageId: 'wamid.test' } }
    await Promise.all([jobsApi.processWhatsAppJobs(db, send), jobsApi.processWhatsAppJobs(db, send)])
    assert.equal(calls, 1)
    assert.equal(db.tables.whatsapp_jobs[0].status, 'accepted')
    await jobsApi.processWhatsAppJobs(db, send)
    assert.equal(calls, 1)
  } finally { if (previous === undefined) delete process.env.WHATSAPP_ENABLED; else process.env.WHATSAPP_ENABLED = previous }
})

test('worker suppresses STOP, cancelled and stale bookings without sending', async () => {
  const previous = process.env.WHATSAPP_ENABLED
  process.env.WHATSAPP_ENABLED = 'true'
  try {
    for (const scenario of ['stop', 'cancelled', 'expired']) {
      const db = database()
      if (scenario === 'stop') db.tables.whatsapp_opt_outs.push({ phone: '447700900123' })
      if (scenario === 'cancelled') db.tables.bookings[0].status = 'cancelled'
      if (scenario === 'expired') db.tables.whatsapp_jobs[0].created_at = new Date(0).toISOString()
      await jobsApi.processWhatsAppJobs(db, () => { assert.fail('Must not send') })
      assert.equal(db.tables.whatsapp_jobs[0].status, 'skipped')
    }
  } finally { if (previous === undefined) delete process.env.WHATSAPP_ENABLED; else process.env.WHATSAPP_ENABLED = previous }
})

test('immediate dispatch is disabled by default and isolates the committed source', async () => {
  const previous = process.env.WHATSAPP_ENABLED
  const callbacks = [], calls = []
  const dispatch = load('whatsapp-dispatch.ts', {
    'next/server': { after: callback => callbacks.push(callback) },
    './whatsapp-jobs': { processWhatsAppJobs: async (...args) => calls.push(args) },
  }).dispatchWhatsApp
  try {
    delete process.env.WHATSAPP_ENABLED
    dispatch('bookings', 'booking-1')
    assert.equal(callbacks.length, 0)
    process.env.WHATSAPP_ENABLED = 'true'
    dispatch('bookings', 'booking-1')
    assert.equal(calls.length, 0)
    await callbacks[0]()
    assert.deepEqual(calls[0], [undefined, undefined, { table: 'bookings', id: 'booking-1' }])
    const db = database()
    await jobsApi.processWhatsAppJobs(db, () => assert.fail('Wrong source must not send'), { table: 'inquiries', id: 'booking-1' })
    assert.equal(db.tables.whatsapp_jobs[0].status, 'pending')
    await jobsApi.processWhatsAppJobs(db, () => assert.fail('Wrong ID must not send'), { table: 'bookings', id: 'other' })
    assert.equal(db.tables.whatsapp_jobs[0].status, 'pending')
  } finally { if (previous === undefined) delete process.env.WHATSAPP_ENABLED; else process.env.WHATSAPP_ENABLED = previous }
})

test('cron GET fails closed without its separate secret', async () => {
  let calls = 0
  const route = load('../../app/api/whatsapp/process/route.ts', { '@/lib/services/whatsapp-jobs': { processWhatsAppJobs: async () => { calls++; return { processed: 0 } } } })
  const previous = process.env.CRON_SECRET
  try {
    delete process.env.CRON_SECRET
    assert.equal((await route.GET(new Request('http://localhost/process'))).status, 401)
    process.env.CRON_SECRET = 'c'.repeat(32)
    assert.equal((await route.GET(new Request('http://localhost/process', { headers: { authorization: 'Bearer wrong' } }))).status, 401)
    assert.equal(calls, 0)
    assert.equal((await route.GET(new Request('http://localhost/process', { headers: { authorization: `Bearer ${'c'.repeat(32)}` } }))).status, 200)
    assert.equal(calls, 1)
  } finally { if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous }
})

test('worker retries explicit throttling but quarantines uncertain sends and interrupted claims', async () => {
  const previous = process.env.WHATSAPP_ENABLED
  process.env.WHATSAPP_ENABLED = 'true'
  try {
    const throttled = database()
    await jobsApi.processWhatsAppJobs(throttled, async () => ({ status: 'failed', reason: 'provider_http_429', retryable: true }))
    assert.equal(throttled.tables.whatsapp_jobs[0].status, 'pending')
    assert.equal(throttled.tables.whatsapp_jobs[0].attempts, 1)
    assert.ok(Date.parse(throttled.tables.whatsapp_jobs[0].next_attempt_at) > Date.now())
    const ambiguous = database()
    await jobsApi.processWhatsAppJobs(ambiguous, async () => ({ status: 'failed', reason: 'ambiguous_network_failure', retryable: false }))
    assert.equal(ambiguous.tables.whatsapp_jobs[0].status, 'ambiguous')
    const interrupted = database()
    Object.assign(interrupted.tables.whatsapp_jobs[0], { status: 'processing', claimed_at: new Date(0).toISOString() })
    await jobsApi.processWhatsAppJobs(interrupted, () => { assert.fail('Must not resend an interrupted claim') })
    assert.equal(interrupted.tables.whatsapp_jobs[0].status, 'ambiguous')
  } finally { if (previous === undefined) delete process.env.WHATSAPP_ENABLED; else process.env.WHATSAPP_ENABLED = previous }
})

test('opt-in is hidden while disabled, accessible and unchecked when enabled', () => {
  const { renderToStaticMarkup } = require('react-dom/server')
  const { createElement } = require('react')
  const component = load('../../components/whatsapp-opt-in.tsx', { '@/lib/whatsapp-consent': load('../whatsapp-consent.ts') }).WhatsAppOptIn
  const previous = process.env.NEXT_PUBLIC_WHATSAPP_ENABLED
  try {
    delete process.env.NEXT_PUBLIC_WHATSAPP_ENABLED
    assert.equal(renderToStaticMarkup(createElement(component)), '')
    process.env.NEXT_PUBLIC_WHATSAPP_ENABLED = 'true'
    const html = renderToStaticMarkup(createElement(component))
    assert.match(html, /<label/)
    assert.match(html, /type="checkbox"/)
    assert.match(html, /replying STOP/)
    assert.doesNotMatch(html, / checked/)
  } finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_WHATSAPP_ENABLED; else process.env.NEXT_PUBLIC_WHATSAPP_ENABLED = previous }
})

test('worker endpoint rejects unauthenticated requests before processing', async () => {
  let calls = 0
  const route = load('../../app/api/whatsapp/process/route.ts', { '@/lib/services/whatsapp-jobs': { processWhatsAppJobs: async () => { calls++; return { processed: 0 } } } })
  const previous = process.env.WHATSAPP_WORKER_SECRET
  try {
    delete process.env.WHATSAPP_WORKER_SECRET
    assert.equal((await route.POST(new Request('http://localhost/process', { method: 'POST' }))).status, 401)
    process.env.WHATSAPP_WORKER_SECRET = 'a'.repeat(32)
    assert.equal((await route.POST(new Request('http://localhost/process', { method: 'POST', headers: { authorization: 'Bearer invalid' } }))).status, 401)
    assert.equal(calls, 0)
    assert.equal((await route.POST(new Request('http://localhost/process', { method: 'POST', headers: { authorization: `Bearer ${'a'.repeat(32)}` } }))).status, 200)
    assert.equal(calls, 1)
  } finally { if (previous === undefined) delete process.env.WHATSAPP_WORKER_SECRET; else process.env.WHATSAPP_WORKER_SECRET = previous }
})

test('webhook verifies handshake and rejects invalid signatures without database access', async () => {
  const route = load('../../app/api/webhooks/whatsapp/route.ts', { '@/lib/services/whatsapp': api,
    '@/lib/services/whatsapp-webhook': webhookApi, '@/lib/services/supabase': { isSupabaseConfigured: true, supabaseAdmin: null } })
  const keys = ['WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_BUSINESS_ACCOUNT_ID', 'WHATSAPP_PHONE_NUMBER_ID']
  const previous = keys.map(key => process.env[key])
  try {
    Object.assign(process.env, { WHATSAPP_VERIFY_TOKEN: 'test-token', WHATSAPP_APP_SECRET: 'test-secret', WHATSAPP_BUSINESS_ACCOUNT_ID: 'account', WHATSAPP_PHONE_NUMBER_ID: '1234' })
    assert.equal((await route.GET(new Request('http://localhost/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123'))).status, 403)
    assert.equal(await (await route.GET(new Request('http://localhost/webhook?hub.mode=subscribe&hub.verify_token=test-token&hub.challenge=123'))).text(), '123')
    assert.equal((await route.POST(new Request('http://localhost/webhook', { method: 'POST', body: '{}' }))).status, 401)
    const raw = '{}', signature = 'sha256=' + createHmac('sha256', 'test-secret').update(raw).digest('hex')
    assert.equal((await route.POST(new Request('http://localhost/webhook', { method: 'POST', body: raw, headers: { 'x-hub-signature-256': signature } }))).status, 200)
  } finally { keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i] }) }
})
