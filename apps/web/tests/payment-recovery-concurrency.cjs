// Isolated synthetic PostgreSQL cluster ONLY. Never point this test at a live DB.
const {execFile,execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const psql='C:/Program Files/PostgreSQL/15/bin/psql.exe';
const args=['-h','127.0.0.1','-p','55439','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'];
const run=sql=>execFileSync(psql,[...args,'-c',sql],{encoding:'utf8'});
const asyncRun=sql=>new Promise((resolve,reject)=>execFile(psql,[...args,'-c',sql],{encoding:'utf8'},(err,out)=>err?reject(err):resolve(out)));
(async()=>{
 if(process.env.ALLOW_ISOLATED_PG_TEST!=='true'){ console.log('SKIP: set ALLOW_ISOLATED_PG_TEST=true with the isolated PostgreSQL fixture running'); return; }
 const id='recovery-concurrency-synthetic';
 try{
  run(`insert into resources(id,name,type) values('${id}','Synthetic','lane');
   insert into bookings(id,booking_reference,resource_id,service_type,booking_date,start_at,end_at,amount,customer_name,customer_email)
   values('${id}','${id}','${id}','lane_hire','2035-02-01','2035-02-01T15:00:00Z','2035-02-01T16:00:00Z',25,'Synthetic','synthetic@example.invalid');
   insert into booking_notification_outbox(resource_booking_id,recipient_role,payment) values('${id}','customer','{}'),('${id}','admin','{}');`);
  const sql='begin; select id from claim_booking_notifications(1); select pg_sleep(2); rollback;';
  const results=await Promise.all([asyncRun(sql),asyncRun(sql)]);
  const ids=results.map(out=>out.match(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/)?.[0]);
  assert.ok(ids[0]&&ids[1]);assert.notEqual(ids[0],ids[1],'Concurrent workers must claim distinct rows while first lease is uncommitted');
  console.log('PASS: two concurrent PostgreSQL workers skip locked outbox jobs');
  run(`insert into group_sessions(id,title,age_group,max_players,schedule,price) values('${id}','Synthetic','11-15 years',1,'Synthetic',40);`);
  const groupInsert=`insert into group_session_bookings(id,session_id,player_name,parent_name,parent_email,parent_phone,status,payment_status,amount,request_hash,checkout_description,checkout_service_type)
   values('${id}','${id}','Synthetic','Synthetic','synthetic@example.invalid','000','pending_payment','pending',40,'${'a'.repeat(64)}','Synthetic','group_session');`;
  const reservations=await Promise.allSettled([asyncRun(groupInsert),asyncRun(groupInsert)]);
  assert.equal(reservations.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(run(`select count(*) from group_session_bookings where id='${id}';`).trim(),'1');
  assert.equal(run(`select current_players from group_sessions where id='${id}';`).trim(),'1');
  console.log('PASS: concurrent same-ID group reservations consume exactly one capacity place');
 }finally{
  run(`delete from group_session_bookings where id='${id}';delete from group_sessions where id='${id}';delete from booking_notification_outbox where resource_booking_id='${id}';delete from bookings where id='${id}';delete from resources where id='${id}';`);
 }
})().catch(e=>{console.error(e);process.exit(1)});
