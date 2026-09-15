const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require(process.cwd() + '/node_modules/typescript');
const file = 'apps/web/lib/session-options.ts';
assert.ok(fs.existsSync(file), 'Session selection helper must exist');
const code = ts.transpile(fs.readFileSync(file, 'utf8'), {module: ts.ModuleKind.CommonJS});
const mod = {};
new Function('exports', code)(mod);
const sessions = [
 {id:'group',session_kind:'group',coach_name:'Abbas',active:true,max_players:12,current_players:0},
 {id:'a',session_kind:'masterclass',coach_name:'Abbas',active:true,max_players:12,current_players:1},
 {id:'b',session_kind:'masterclass',coach_name:'Other',active:true,max_players:12,current_players:0},
 {id:'c',session_kind:'masterclass',coach_name:'Abbas',active:false,max_players:12,current_players:0},
];
assert.deepEqual(mod.availableSessions(sessions,'masterclass','Abbas').map(s=>s.id), ['a']);
assert.deepEqual(mod.availableSessions(sessions,'group','').map(s=>s.id), ['group']);
console.log('Session selection tests passed');
