const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

test('transactional templates are branded, escaped, and have correct reply routing', async () => {
  const messages = []
  class Resend { emails = { send: async (payload) => { messages.push(payload); return { data: { id: 'mock' } } } } }
  const exports = {}
  const documentExports = {}
  const location = { LOCATION: { name: 'Cricpro Centre of Excellence', address: 'Marsh Hill, B23 7EY', googleMapsUrl: 'https://maps.google.com', appleMapsUrl: 'https://maps.apple.com' } }
  const documentCode = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'booking-documents.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  new Function('exports', 'require', 'Buffer', documentCode)(documentExports, name => name === '@/lib/location' ? location : require(name), Buffer)
  const source = fs.readFileSync(path.join(__dirname, 'email.ts'), 'utf8')
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, console: { log() {}, warn() {}, error() {} },
    process: { env: { RESEND_API_KEY: 'test', EMAIL_FROM: 'noreply@cricprocoe.com', ADMIN_EMAIL: 'info@cricprocoe.com' } },
    require: (name) => name === 'resend' ? { Resend } : name.includes('booking-documents') ? documentExports : location,
  })
  const inquiry = { name: '<script>Test</script>', email: 'customer@example.com', type: 'birthday_party', message: 'First line\nSecond <img src=x onerror=alert(1)>', phone: '' }
  await exports.sendInquiryConfirmation(inquiry)
  await exports.sendAdminInquiryNotification(inquiry)
  const booking = { booking_reference: 'TEST-123', service_type: 'lane_hire', booking_date: '2026-09-20', start_at: '2026-09-20T10:00:00Z', amount: '22', customer_name: inquiry.name, customer_email: inquiry.email }
  await exports.sendAdminBookingNotification(booking)
  await exports.sendGroupSessionConfirmation({ player_name: '<script>Player</script>', parent_name: inquiry.name, parent_email: inquiry.email }, { title: 'Junior <Coaching>', price: '15' })
  await exports.sendGroupSessionConfirmation({ player_name: 'Player', parent_name: 'Parent', parent_email: inquiry.email }, { title: 'Masterclass', price: '20', session_kind: 'masterclass' })
  await exports.sendBookingConfirmation(booking)
  assert.equal(messages.length, 6)
  for (const message of messages) {
    assert.equal(message.from, 'noreply@cricprocoe.com')
    assert.match(message.html, /<h1/)
    assert.match(message.html, /#1d2544/)
    assert.match(message.html, /max-width:600px/)
    assert.doesNotMatch(message.html, /<script>|<img src=x|<pre>/)
  }
  assert.equal(messages[0].replyTo, 'info@cricprocoe.com')
  assert.equal(messages[1].replyTo, inquiry.email)
  assert.equal(messages[2].replyTo, inquiry.email)
  assert.match(messages[1].html, /First line<br>Second &lt;img/)
  assert.match(messages[1].html, /Not provided/)
  assert.match(messages[2].html, /£22.00/)
  assert.match(messages[3].html, /Junior &lt;Coaching&gt;/)
  assert.match(messages[4].html, /Masterclass Booking Confirmed!/)
  assert.match(messages[5].html, /Booking Confirmed!/)
  assert.equal(messages[5].attachments.length, 1, 'Unpaid bookings must not receive a payment receipt')
  assert.throws(() => documentExports.verifiedPayment({ payment_status: 'unpaid' }), /verified paid/)
  const payment = documentExports.verifiedPayment({ payment_status: 'paid', currency: 'gbp', amount_total: 2200, payment_intent: 'pi_test_preview', livemode: false })
  await exports.sendBookingConfirmation({ ...booking, customer_name: 'Example Customer', payment })
  assert.equal(messages[6].attachments.length, 2)
  const { PDFDocument } = require('pdf-lib')
  for (const attachment of messages[6].attachments) {
    assert.equal(attachment.contentType, 'application/pdf')
    assert.ok((await PDFDocument.load(attachment.content)).getPageCount() >= 1)
    if (process.env.PDF_PREVIEW_DIR) {
      fs.mkdirSync(process.env.PDF_PREVIEW_DIR, { recursive: true })
      fs.writeFileSync(path.join(process.env.PDF_PREVIEW_DIR, attachment.filename), attachment.content)
    }
  }
  await exports.sendGroupSessionConfirmation({ id: 'GROUP-TEST', player_name: 'Player', parent_name: 'Parent', parent_email: inquiry.email }, { title: 'Junior session', price: '22', schedule: 'Saturday, 10:00 - 11:00' }, payment)
  assert.equal(messages[7].attachments.length, 2)
})
