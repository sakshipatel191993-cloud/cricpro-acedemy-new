const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'../../..');
function load(file,deps){const m={exports:{}};new Function('require','module','exports',ts.transpile(fs.readFileSync(path.join(root,file),'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}))(n=>{if(n in deps)return deps[n];throw Error(n)},m,m.exports);return m.exports;}
(async()=>{
 const keyModule=load('apps/web/lib/security/group-checkout-key.ts',{'node:crypto':require('node:crypto')});
 const key=keyModule.newGroupCheckoutKey(), key2=keyModule.newGroupCheckoutKey();
 const requestId='12345678-1234-4123-a123-123456789012';
 const payload={requestId,session_id:'s1',player_name:'Player',player_age:'12',parent_name:'Parent',parent_email:'synthetic@example.invalid',parent_phone:'000'};
 const rows=new Map(),checkouts=new Map();let inserts=0,stripeCreates=0, failCheckout=false, raceCapacity=false;
 const session={id:'s1',title:'Class',session_kind:'group',price:'40.00',age_group:'11-15 years',session_date:'2030-01-01',start_time:'15:00:00',end_time:'16:00:00',schedule:'Synthetic'};
 const db={from(table){let id,insertValue;return{
  select(){return this},eq(name,value){if(name==='id')id=value;return this},
  single:async()=>{
   if(table==='group_sessions')return {data:session};
   if(insertValue){
    if(rows.has(insertValue.id))return {data:null,error:{code:raceCapacity?'23514':'23505'}};
    const created={...insertValue,booking_reference:'CCOE-ABC234'};
    rows.set(insertValue.id,created);inserts++;
    return {data:created,error:null};
   }
   return {data:rows.get(id)};
  },
  maybeSingle:async()=>({data:rows.get(id)??null}),
  insert(v){insertValue=v;return this},
  then(resolve){return Promise.resolve({data:rows.get(id)??null,error:null}).then(resolve)},
 }}};
 const route=load('apps/web/app/api/group-session-bookings/route.ts',{
  '@/lib/services/whatsapp': { whatsappConsentFields:(phone,checked)=>checked===true?{whatsapp_consent:{phone,version:'transactional-v1',grantedAt:new Date().toISOString()}}:{} },
  '@/lib/services/coupons': { couponsEnabled:()=>false, couponRequest:async()=>({}) },
  'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status??200,cookies:{set(){}}})}},
  '@/lib/services/supabase':{supabaseAdmin:db},
  '@/lib/services/stripe':{paymentsEnabled:true},
  '@/lib/services/checkout-attempts':{checkoutAppUrl:()=> 'http://127.0.0.1:3001',startPersistedCheckout:async params=>{
   assert.equal(params.bookingReference,'CCOE-ABC234');
   if(!checkouts.has(params.bookingId)){checkouts.set(params.bookingId,{sessionId:'cs_'+params.bookingId,url:'https://checkout.stripe.com/'+params.bookingId});stripeCreates++;}
   if(failCheckout)throw Error('Unknown outcome');return checkouts.get(params.bookingId);
  }},
  '@/lib/security/guest-access':{provisionBookingAccess:async()=>null},
  '@/lib/security/rate-limit':{enforceRateLimit:async()=>null},
  '@/lib/security/request-body':{readJsonBody:req=>req.json(),RequestBodyError:class extends Error{}},
  '@/lib/services/session-checkout':{reconcileGroupCheckouts:async()=>{}},
  '@/lib/session-age':load('apps/web/lib/session-age.ts',{}),
  '@/lib/booking-quote':load('apps/web/lib/booking-quote.ts',{}),
  '@/lib/security/admin-auth':{isSameOriginRequest:req=>req.headers.get('origin')==='https://cricpro.example'},
  '@/lib/security/group-checkout-key':keyModule,
 });
 const request=(body=payload,cookieKey=key,origin='https://cricpro.example')=>({url:'https://cricpro.example/api/group-session-bookings',headers:new Headers({origin,...(cookieKey?{cookie:`${keyModule.groupCheckoutCookie}=${cookieKey}`}:{})}),json:async()=>body});
 assert.equal((await route.POST(request(payload,null))).status,428,'Missing private capability bootstraps only, no reservation');assert.equal(inserts,0);
 assert.equal((await route.POST(request(payload,key,'https://evil.example'))).status,403);
 const result=await Promise.all([route.POST(request()),route.POST(request())]);
 assert.deepEqual(result.map(r=>r.status),[200,200]);assert.equal(inserts,1);assert.equal(stripeCreates,1);assert.equal(result[0].body.paymentUrl,result[1].body.paymentUrl);
 assert.equal((await route.POST(request({...payload,player_name:'Changed'}))).status,409,'Immutable request fingerprint rejects changed details');
 assert.equal(inserts,1);assert.equal(stripeCreates,1);
 assert.equal((await route.POST(request({...payload,whatsappConsent:true}))).status,409,'Changing consent must not replay an existing reservation');
 const opted={...payload,requestId:'42345678-1234-4123-a123-123456789012',whatsappConsent:true};
 assert.equal((await route.POST(request(opted))).status,200);
 const optedRow=rows.get(keyModule.groupRequestIdentity(key,opted.requestId,{}).id);
 assert.equal(optedRow.whatsapp_consent.version,'transactional-v1');
 const consentTime=optedRow.whatsapp_consent.grantedAt;
 assert.equal((await route.POST(request(opted))).status,200,'Server-stamped consent does not break retry identity');
 assert.equal(rows.get(optedRow.id).whatsapp_consent.grantedAt,consentTime);
 rows.delete(optedRow.id);checkouts.delete(optedRow.id);inserts--;stripeCreates--;
 const other=await route.POST(request(payload,key2));assert.equal(other.status,200);assert.notEqual(other.body.paymentUrl,result[0].body.paymentUrl,'Public request UUID with another browser capability cannot access old checkout');
 assert.equal(inserts,2);
 const retryPayload={...payload,requestId:'22345678-1234-4123-a123-123456789012'};
 failCheckout=true;assert.equal((await route.POST(request(retryPayload))).status,503);
 failCheckout=false;assert.equal((await route.POST(request(retryPayload))).status,200);assert.equal(inserts,3,'Retry after unknown outcome reuses reservation');assert.equal(stripeCreates,3);
 raceCapacity=true;
 const racePayload={...payload,requestId:'32345678-1234-4123-a123-123456789012'};
 const capacityReplay=await Promise.all([route.POST(request(racePayload)),route.POST(request(racePayload))]);
 assert.deepEqual(capacityReplay.map(r=>r.status),[200,200]);assert.equal(inserts,4,'Capacity trigger conflict on racing same-ID retry resolves existing booking');
 console.log('PASS: concurrent group retries, immutable payload, browser binding, bootstrap/origin, unknown outcome reuse');
})().catch(e=>{console.error(e);process.exit(1)});
