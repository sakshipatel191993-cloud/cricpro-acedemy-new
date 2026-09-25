const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
function load(file, deps) {
 const module = {exports:{}};
 const code = ts.transpile(fs.readFileSync(path.join(root,file),'utf8'), {module:ts.ModuleKind.CommonJS});
 new Function('require','module','exports',code)(name=>{if(name in deps)return deps[name];throw Error(name)},module,module.exports);
 return module.exports;
}
(async()=>{
 let emails=0, writes=0;
 const stripe={id:'cs_test_valid',mode:'payment',payment_status:'unpaid',currency:'gbp',amount_total:4000,metadata:{booking_id:'b',booking_kind:'group_session'}};
 const row={id:'b',status:'pending_payment',payment_status:'pending',amount:40,stripe_session_id:'cs_test_valid',parent_email:'test@example.invalid',session:{title:'Masterclass',price:40}};
 const db = { rpc: async(name, args) => {
   assert.equal(name,'confirm_booking_with_outbox'); assert.equal(args.p_session_id,stripe.id);
   writes++; emails++; Object.assign(row,{status:'confirmed',payment_status:'paid'}); return {data:true};
 }, from() { return {
   select() { return this; }, eq() { return this; }, single: async () => ({data:row}),
   update(values) { writes++; return {
     eq() { return this; },
     select: async () => { if (row.status !== 'pending_payment') return {data:[]}; Object.assign(row, values); return {data:[row]}; }
   }; }
 }; } };
 const file='apps/web/lib/services/confirm-group-booking.ts';
 assert.ok(fs.existsSync(path.join(root,file)), 'Payment confirmation must verify Stripe before confirming a group booking');
 let whatsappDispatches=0;
 const {confirmGroupBooking}=load(file,{'@/lib/services/whatsapp-dispatch':{dispatchWhatsApp:()=>{assert.equal(row.payment_status,'paid');whatsappDispatches++;}},'@/lib/services/supabase':{supabaseAdmin:db},'@/lib/services/email':{sendGroupSessionConfirmation:async()=>{emails++}},'@/lib/services/booking-documents':{verifiedPayment:session=>({amount:session.amount_total,currency:session.currency})}});
 await assert.rejects(()=>confirmGroupBooking(stripe)); assert.equal(writes,0);assert.equal(emails,0);
 stripe.payment_status='paid';stripe.amount_total=1;
 await assert.rejects(()=>confirmGroupBooking(stripe));assert.equal(writes,0);
 stripe.amount_total=4000;stripe.id='cs_wrong';
 await assert.rejects(()=>confirmGroupBooking(stripe));assert.equal(writes,0);
 stripe.id='cs_test_valid';
 assert.equal(whatsappDispatches,0,'No WhatsApp dispatch before verified payment');
 await confirmGroupBooking(stripe);await confirmGroupBooking(stripe);
 assert.equal(whatsappDispatches,2,'Dispatch the durable deduplicated WhatsApp queue on paid confirmation/recovery');
 assert.equal(row.status,'confirmed');assert.equal(row.payment_status,'paid');assert.equal(emails,1);
 console.log('PASS: unpaid, wrong amount and wrong checkout rejected; paid confirmation is idempotent');
 let fulfilled=0;
 let fail=false;
 const event={type:'checkout.session.completed',data:{object:{...stripe,payment_status:'unpaid'}}};
 const {POST}=load('apps/web/app/api/webhooks/stripe/route.ts', {
   'next/server':{NextResponse:{json:(body, options)=>({body,status:options?.status ?? 200})}},
   '@/lib/services/supabase':{supabaseAdmin:db},
   '@/lib/services/booking-outbox':{dispatchBookingNotifications:async()=>({}),dispatchBlockBookingNotifications:async()=>({})},
   '@/lib/services/stripe':{verifyWebhookSignature:()=>event},
   '@/lib/services/confirm-booking':{confirmBooking:async()=>{throw Error('Wrong booking handler');}},
   '@/lib/services/block-bookings':{confirmBlockBooking:async()=>{throw Error('Wrong booking handler');},expireBlockBooking:async()=>{}},
   '@/lib/services/confirm-group-booking':{confirmGroupBooking:async()=>{if(fail)throw Error('Database unavailable');fulfilled++;}},
   '@/lib/services/session-checkout':{expireGroupCheckout:async()=>{}},
 });
 const request={text:async()=>'',headers:{get:()=> 'verified-test-signature'}};
 assert.equal((await POST(request)).status,200);assert.equal(fulfilled,0);
 event.data.object.payment_status='paid';
 assert.equal((await POST(request)).status,200);assert.equal(fulfilled,1);
 fail=true;
 const originalError=console.error;
 try {console.error=()=>{};assert.equal((await POST(request)).status,500);} finally {console.error=originalError;}
 console.log('PASS: webhook ignores unpaid completion and returns retryable failure when fulfillment fails');

})().catch(e=>{console.error(e);process.exit(1)});
