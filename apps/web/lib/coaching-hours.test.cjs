const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(file, requireModule = require) {
  const exports = {}
  const source = fs.readFileSync(path.join(__dirname, file), 'utf8')
  new Function('exports', 'require', ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText)(exports, requireModule)
  return exports
}

test('coaching is live, displays database coaches and never requires coach selection', async () => {
  const names = ['Mohammad Abbas', 'New Admin Coach']
  const container = ({ children }) => React.createElement('div', null, children)
  const components = new Proxy({}, { get: () => container })
  const page = load('../app/coaching/page.tsx', name => {
    if (name === '@/lib/services/supabase') return { supabaseAdmin: { from(table) {
      assert.equal(table, 'coaches')
      return { select(columns) {
        assert.equal(columns, 'id, name')
        return { order: async () => ({ data: names.map((name, id) => ({ id: String(id), name })), error: null }) }
      } }
    } } }
    if (name.startsWith('@workspace/') || name === 'lucide-react') return components
    if (name === '@/components/contact-form') return { ContactForm: container }
    if (name === 'next/link') return { default: container }
    return require(name)
  })
  assert.equal(page.dynamic, 'force-dynamic')
  const html = renderToStaticMarkup(await page.default())
  for (const name of names) assert.ok(html.includes(name))
  assert.ok(html.includes('Coaching Now Available'))
  assert.ok(!html.includes('Coming Soon'))
  assert.ok(!/name="coach|id="coach/.test(html))
})

test('weekday and weekend hours agree with the final published rate boundaries', () => {
  const hours = load('hours.ts').OPERATING_HOURS
  const data = load('data.ts')
  assert.equal(hours.weekday.hours, '9:00 AM – 10:00 PM')
  assert.equal(hours.weekday.offPeak, '9 AM – 4 PM')
  assert.equal(hours.weekday.peak, '4 PM – 10 PM')
  assert.equal(hours.weekend.hours, '9:00 AM – 11:00 PM')
  assert.equal(hours.weekend.offPeak, '9 AM – 11 AM')
  assert.equal(hours.weekend.peak, '11 AM – 11 PM')
  assert.equal(data.services.coaching.price, 'Coaching Now Available')
  for (const service of ['laneHire', 'bowlingMachine']) {
    assert.equal(data.services[service].offPeakHours, 'Weekdays 9 AM – 4 PM · Weekends 9 AM – 11 AM')
    assert.equal(data.services[service].peakHours, 'Weekdays 4 PM – 10 PM · Weekends 11 AM – 11 PM')
  }
})

test('checkout and slot fallback rate boundaries include weekend mornings and late evenings', () => {
  const { isPeakHour } = load('hours.ts')
  for (const day of [1, 2, 3, 4, 5]) {
    for (const hour of [9, 10, 11, 12, 15]) assert.equal(isPeakHour(day, hour), false)
    for (const hour of [16, 21]) assert.equal(isPeakHour(day, hour), true)
  }
  for (const day of [0, 6]) {
    for (const hour of [9, 10]) assert.equal(isPeakHour(day, hour), false)
    for (const hour of [11, 12, 15, 16, 21, 22]) assert.equal(isPeakHour(day, hour), true)
  }
})
