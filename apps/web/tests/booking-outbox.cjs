const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'../../..');
function load(file,deps){const m={exports:{}};new Function('require','module','exports',ts.transpile(fs.readFileSync(path.join(root,file),'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}))(n=>{if(n in deps)return deps[n];throw Error(n)},m,m.exports);return m.exports;}
(async()=>{
 const job={id:'job1',request:null,first_send_at:null};let failAck=true,calls=[];
 const db={from(){let values,onlyNull=false;return{update(v){values=v;return this},eq(){return this},is(){onlyNull=true;return this},select(){return this},single:async()=>({data:job}),then(resolve){if(values?.provider_id&&failAck)return Promise.resolve({error:Error('Lost DB acknowledgement')}).then(resolve);if(!onlyNull||job.request===null)Object.assign(job,values);return Promise.resolve({error:null}).then(resolve)}}}};
 class Resend{emails={send:async(payload,options)=>{calls.push({payload:structuredClone(payload),options});return{data:{id:'provider1'}}}}}
 const old=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY='test-not-credential';
 try{
  const {sendDurableEmail}=load('apps/web/lib/services/outbox-delivery.ts',{'resend':{Resend},'@/lib/services/supabase':{supabaseAdmin:db}});
  const request={from:'sender@example.invalid',to:'test@example.invalid',subject:'Test',html:'Confirmed',attachments:[{filename:'receipt.pdf',content:Buffer.from('exact bytes')}]};
  await assert.rejects(()=>sendDurableEmail('job1',request));
  assert.equal(job.request.attachments[0].content,Buffer.from('exact bytes').toString('base64'));
  failAck=false;assert.equal(await sendDurableEmail('job1',{...request,html:'New render must not replace snapshot'}),true);
  assert.deepEqual(calls[0],calls[1],'Lost acknowledgement retries exact provider request/key');
  job.first_send_at='2020-01-01T00:00:00Z';await assert.rejects(()=>sendDurableEmail('job1',request),/manual/);assert.equal(calls.length,2);
 }finally{if(old===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=old;}
 const updates=[];let claimed=true;
 const worker=load('apps/web/lib/services/booking-outbox.ts',{
  '@/lib/services/supabase':{supabaseAdmin:{
   rpc:async()=>({data:claimed?[{id:'j',resource_booking_id:'b',recipient_role:'customer',payment:{amount:2500},attempts:1}]:[]}),
   from(){return {
    select(){return this},eq(){return this},single:async()=>({data:{payment_status:'paid',resource:{name:'Lane'}}}),
    update(v){updates.push(v);return this},then(r){return Promise.resolve({error:null}).then(r)}
   }}
  }},
  '@/lib/services/email':{sendBookingConfirmation:async()=>false,sendAdminBookingNotification:async()=>true,sendGroupSessionConfirmation:async()=>true},
 });
 const result=await worker.dispatchBookingNotifications();assert.equal(result.deferred,1);assert.equal(updates[0].state,'pending');assert.ok(new Date(updates[0].next_attempt_at)>new Date());claimed=false;assert.equal((await worker.dispatchBookingNotifications()).inspected,0);
 console.log('PASS: durable byte-identical notification retry, expiry safety and deferred backoff');
})().catch(e=>{console.error(e);process.exit(1)});
