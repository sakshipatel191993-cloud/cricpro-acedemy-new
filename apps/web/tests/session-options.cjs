const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');

function load(file, deps = {}) {
  const module = { exports: {} };
  const code = ts.transpile(fs.readFileSync(path.join(root, file), 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
  new Function('require', 'module', 'exports', code)(name => {
    if (!(name in deps)) throw new Error(`Unexpected dependency ${name}`);
    return deps[name];
  }, module, module.exports);
  return module.exports;
}

const bookingQuote = load('apps/web/lib/booking-quote.ts');
const options = load('apps/web/lib/session-options.ts', { './booking-quote': bookingQuote });
const now = Date.parse('2030-01-02T12:00:00Z');
const sessions = [
  { id: 'group', session_kind: 'group', coach_name: 'Abbas', active: true, session_date: '2030-01-03', end_time: '10:30:00' },
  { id: 'a', session_kind: 'masterclass', coach_name: 'Abbas', active: true, session_date: '2030-01-03', end_time: '15:00:00' },
  { id: 'b', session_kind: 'masterclass', coach_name: 'Other', active: true, session_date: '2030-01-03', end_time: '15:00:00' },
  { id: 'past', session_kind: 'masterclass', coach_name: 'Abbas', active: true, session_date: '2030-01-01', end_time: '15:00:00' },
  { id: 'c', session_kind: 'masterclass', coach_name: 'Abbas', active: false, session_date: '2030-01-03', end_time: '15:00:00' },
];

assert.deepEqual(options.availableSessions(sessions, 'masterclass', 'Abbas', now).map(session => session.id), ['a']);
assert.deepEqual(options.availableSessions(sessions, 'group', '', now).map(session => session.id), ['group']);
assert.equal(options.isUpcomingSession(sessions.find(session => session.id === 'past'), now), false);
console.log('PASS: active, future UK sessions only');
