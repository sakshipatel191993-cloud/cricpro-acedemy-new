const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const mod = { exports: {} };
new Function('exports', ts.transpile(fs.readFileSync('apps/web/lib/session-age.ts', 'utf8'), {module: ts.ModuleKind.CommonJS}))(mod.exports);
const { sessionAgeRange, sessionAgeOptions, isSessionAgeAllowed } = mod.exports;
for (const range of ['11-15', '11-15 years', 'Ages 11–15 years', '11 — 15', '11 to 15 yrs']) {
 assert.deepEqual(sessionAgeOptions(range), [11,12,13,14,15]);
 assert.equal(isSessionAgeAllowed(40, range), false);
 assert.equal(isSessionAgeAllowed('11', range), true);
 assert.equal(isSessionAgeAllowed(15, range), true);
}
assert.deepEqual(sessionAgeOptions('6-9 years'), [6,7,8,9]);
assert.deepEqual(sessionAgeOptions('11 years'), [11]);
assert.equal(isSessionAgeAllowed(40,'8-40 years'), true);
assert.equal(isSessionAgeAllowed(41,'8-40 years'), false);
assert.equal(sessionAgeOptions('13+')[0],13);
assert.equal(isSessionAgeAllowed(40,'13+'), true);
assert.equal(isSessionAgeAllowed(12,'13+'), false);
for (const group of [null,undefined,'','all','15-11','0-10','1-999','11-15 or 40']) assert.equal(sessionAgeRange(group),null);
for (const age of [true,[],{},null,undefined,'',11.1,'11x']) assert.equal(isSessionAgeAllowed(age,'11-15'),false);
console.log('PASS: session ages follow admin ranges, inclusive boundaries and minimum ages');
