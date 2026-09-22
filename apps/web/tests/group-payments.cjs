const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
function load(file, dependencies) {
 const source = fs.readFileSync(path.join(root, file),'utf8');
 const mod = {exports:{}};
 new Function('require','module','exports',ts.transpile(source,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}))(name => {
  if (name in dependencies) return dependencies[name];
  throw new Error('Unexpected dependency '+name);
 },mod,mod.exports);
 return mod.exports;
}
(async()=>{
 let checkoutCalls=0, emails=0, reservationCalls=0, checkoutAmount;
 const session={id:'class-1',title:'Masterclass',price:40,age_group:'11-15 years',session_kind:'masterclass',schedule:'Sunday 1–3 pm',session_date:'2030-01-01',start_time:'15:00:00',end_time:'17:00:00',current_players:0,max_players:12};
 const query={select(){return this},eq(){return this},insert(values){reservationCalls++;assert.equal(values.status,'pending_payment');assert.equal(values.payment_status,'pending');assert.equal(values.amount,'40.00');return this},update(){return this},maybeSingle:async()=>({data:null}),single:async()=>({data:session}),then(resolve){return Promise.resolve({data:[]}).then(resolve)}};
 const db={from:()=>query};
 const route=load('apps/web/app/api/group-session-bookings/route.ts',{
  '@/lib/services/coupons': { couponsEnabled:()=>false, couponRequest:async()=>({}) },
  '@/lib/session-age':load('apps/web/lib/session-age.ts',{}),
  '@/lib/booking-quote':load('apps/web/lib/booking-quote.ts',{}),
  '@/lib/security/admin-auth':{isSameOriginRequest:()=>true},
  '@/lib/security/group-checkout-key':{readGroupCheckoutKey:()=> 'test-key',groupRequestIdentity:()=>({id:'test-booking',fingerprint:'test-fingerprint'})},
  'node:crypto':require('node:crypto'),
  'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status??200})}},
  '@/lib/services/supabase':{supabaseAdmin:db,isSupabaseConfigured:true},
  '@/lib/services/email':{sendGroupSessionConfirmation:async()=>{emails++}},
  '@/lib/services/stripe':{paymentsEnabled:true,createCheckoutSession:async(params)=>{checkoutCalls++;checkoutAmount=params.amount;return {sessionId:'cs_test',url:'https://checkout.stripe.com/test'}},getStripe:()=>({checkout:{sessions:{expire:async()=>({})}}})},
  '@/lib/services/session-checkout':{reconcileGroupCheckouts:async()=>{}},
  '@/lib/services/checkout-attempts':{startPersistedCheckout:async(params)=>{checkoutCalls++;checkoutAmount=params.amount;return {sessionId:'cs_test',url:'https://checkout.stripe.com/test'}}},
  '@/lib/security/guest-access':{provisionBookingAccess:async()=>null},
  '@/lib/security/rate-limit':{enforceRateLimit:async()=>null},
  '@/lib/security/request-body':{readJsonBody:request=>request.json(),RequestBodyError:class extends Error{}},
  '@/lib/utils/rate-limit':{rateLimit:()=>({success:true})},
 });
 const payload={session_id:'class-1',player_name:'Player',player_age:'11',parent_name:'Test',parent_email:'test@example.invalid',parent_phone:'0123456789',amount:1};
 for (const kind of ['group','masterclass']) {
  session.session_kind=kind;
  for (const player_age of [40,10,16,0,-1,11.5,'',null,undefined,true,[],{},'11x']) {
   const invalid=await route.POST({json:async()=>({...payload,player_age,age_group:'1-120'})});
   assert.equal(invalid.status,400,`${kind}: reject age ${JSON.stringify(player_age)}`);
  }
 }
 assert.equal(checkoutCalls,0,'Invalid ages must not create checkout');
 assert.equal(reservationCalls,0,'Invalid ages must not reserve places');
 const response=await route.POST({json:async()=>payload,headers:new Headers()});
 assert.equal(response.status,200);
 assert.equal(checkoutCalls,1,'Booking must create Stripe checkout');
 assert.equal(emails,0,'Unpaid booking must not send confirmation');
 assert.equal(reservationCalls,1,'Reserve a pending place before redirecting to payment');
 assert.equal(checkoutAmount,'40.00','Charge the stored class price, ignoring client-supplied amount');
 assert.equal(response.body.paymentUrl,'https://checkout.stripe.com/test');
 const upper=await route.POST({json:async()=>({...payload,player_age:15})});
 assert.equal(upper.status,200,'Upper age boundary is inclusive');
 session.age_group='invalid';
 const malformed=await route.POST({json:async()=>payload});
 assert.equal(malformed.status,400,'Unconfigured age ranges must fail closed');
 assert.equal(checkoutCalls,2);
 assert.equal(reservationCalls,2);
 session.session_date='2000-01-01';
 assert.equal((await route.POST({json:async()=>payload})).status,409,'Past session must not reserve capacity');
 session.session_date=null;
 assert.equal((await route.POST({json:async()=>payload})).status,409,'Undated session must fail closed');
 assert.equal(reservationCalls,2);
 console.log('PASS: booking starts checkout without confirming or emailing');
})().catch(error=>{console.error(error);process.exit(1)});
