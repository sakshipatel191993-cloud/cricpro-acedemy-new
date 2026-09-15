const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const path=require('node:path');const file=path.resolve(__dirname,'../lib/session-schedule.ts');
assert.ok(fs.existsSync(file),'Schedule validation helper must exist');
const mod={exports:{}};new Function('exports',ts.transpile(fs.readFileSync(file,'utf8'),{module:ts.ModuleKind.CommonJS}))(mod.exports);
const {createSessionSchedule}=mod.exports;
assert.equal(createSessionSchedule('2026-09-20','13:00','15:00'),'Sunday, 20 September 2026 · 1:00 pm–3:00 pm');
for(const args of [['2026-02-30','13:00','15:00'],['2026-09-20','15:00','13:00'],['2026-09-20','13:00','13:00'],['','13:00','15:00'],['2026-09-20','25:00','26:00']]) assert.throws(()=>createSessionSchedule(...args));
console.log('PASS: dated UK schedules, invalid dates, invalid times and reversed/equal times');
