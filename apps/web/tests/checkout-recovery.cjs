const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
function load(file,deps) { const m={exports:{}}; new Function('require','module','exports',ts.transpile(fs.readFileSync(path.join(root,file),'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}))(n=>{if(n in deps)return deps[n];throw Error(n)},m,m.exports);return m.exports; }
(async()=>{
 let attempt, failStripe=false, failSave=false, failInsert=false, creates=0, expires=0, confirmed=0;
 const events=[];
 const params={bookingId:'b1',bookingReference:'REF',serviceType:'lane_hire',amount:'25',customerEmail:'test@example.invalid',customerName:'Test',description:'Lane',expiresAt:1900000000};
 const session={id:'cs1',mode:'payment',status:'open',url:'https://checkout.stripe.com/test',currency:'gbp',amount_total:2500,payment_status:'unpaid',metadata:{booking_id:'b1'}};
 const db={from(table){return {
   upsert:async value=>{events.push('persist-attempt');if(!attempt)attempt={...value,created_at:new Date().toISOString(),stripe_session_id:null};return {error:failInsert?Error('db'):null}},
   select(){return this},eq(){return this},single:async()=>({data:attempt}),
   update(){expires++;return this},then(resolve){return Promise.resolve({error:null}).then(resolve)},
 };},rpc:async(name,args)=>{assert.equal(name,'attach_checkout_attempt');events.push('persist-session');if(failSave)return {error:Error('db')};attempt.stripe_session_id=args.p_session_id;return {error:null}}};
 const helper=load('apps/web/lib/services/checkout-attempts.ts',{
   '@/lib/services/supabase':{supabaseAdmin:db},
   '@/lib/services/stripe':{createCheckoutSession:async p=>{events.push('stripe');creates++;assert.equal(p.expiresAt,params.expiresAt);if(failStripe)throw Error('timeout unknown outcome');return {sessionId:'cs1',url:session.url}},getStripe:()=>({checkout:{sessions:{retrieve:async()=>session}}})},
   '@/lib/services/confirm-booking':{confirmBooking:async()=>{confirmed++}},
   '@/lib/services/confirm-group-booking':{confirmGroupBooking:async()=>{confirmed++}},
 });
 failInsert=true;await assert.rejects(()=>helper.startPersistedCheckout(params));assert.equal(creates,0);
 failInsert=false;failStripe=true;await assert.rejects(()=>helper.startPersistedCheckout(params));assert.equal(expires,0,'Unknown outcome must preserve inventory');
 failStripe=false;failSave=true;await assert.rejects(()=>helper.startPersistedCheckout(params));assert.equal(expires,0,'Failed persistence must not release inventory or return a URL');
 failSave=false;const result=await helper.startPersistedCheckout(params);assert.equal(result.url,session.url);assert.equal(attempt.stripe_session_id,'cs1');
 assert.ok(events.indexOf('persist-attempt')<events.indexOf('stripe'));
 const before=creates;await helper.resumeCheckoutAttempt(attempt);assert.equal(creates,before,'Known session is retrieved rather than recreated');
 session.status='complete';session.payment_status='paid';assert.equal((await helper.resumeCheckoutAttempt(attempt)).url,null);assert.equal(confirmed,1);
 session.status='expired';session.payment_status='unpaid';await helper.resumeCheckoutAttempt(attempt);assert.equal(expires,1);
 session.amount_total=1;await assert.rejects(()=>helper.resumeCheckoutAttempt(attempt),/match/);assert.equal(expires,1);
 await assert.rejects(()=>helper.resumeCheckoutAttempt({...attempt,stripe_session_id:null,created_at:'2020-01-01T00:00:00Z'}),/manual/);
 assert.equal(creates,before,'Never recreate after Stripe idempotency retention window');

 let releases=0;
 const recovery=load('apps/web/lib/services/session-checkout.ts',{
   '@/lib/services/supabase':{supabaseAdmin:{from(){return{select(){return this},eq(){return this},lt(){return this},limit:async()=>({data:[{id:'legacy',stripe_session_id:null}]}),update(){releases++;return this}}}}},
   '@/lib/services/stripe':{getStripe(){throw Error('No known session')}},
   '@/lib/services/confirm-group-booking':{confirmGroupBooking:async()=>{}},
 });
 await recovery.reconcileGroupCheckouts('group1');assert.equal(releases,0,'Legacy null-session holds require review, never automatic release');
 console.log('PASS: crash/timeout persistence, verified recovery, terminal release, old attempts and legacy holds');
})().catch(e=>{console.error(e);process.exit(1)});
