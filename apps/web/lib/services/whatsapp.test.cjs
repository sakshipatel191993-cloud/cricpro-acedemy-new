const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { createHmac } = require('node:crypto')
const api = {}
new Function('exports', 'require', ts.transpileModule(fs.readFileSync(path.join(__dirname, 'whatsapp.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(api, require)
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
