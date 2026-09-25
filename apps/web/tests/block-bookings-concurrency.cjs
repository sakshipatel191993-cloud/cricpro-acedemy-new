// Disposable local fixture ONLY, bootstrapped with phase-two-db-bootstrap.sql.
const { execFile, execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const psql = 'C:/Program Files/PostgreSQL/15/bin/psql.exe';
const args = ['-h', '127.0.0.1', '-p', '55449', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'];
const run = sql => execFileSync(psql, [...args, '-c', sql], { encoding: 'utf8' }).trim();
const parallel = sql => new Promise((resolve, reject) => execFile(psql, [...args, '-c', sql], { encoding: 'utf8' }, (error, stdout) => error ? reject(error) : resolve(stdout.trim())));
(async () => {
  if (process.env.ALLOW_ISOLATED_PG_TEST !== 'true') return console.log('SKIP: requires ALLOW_ISOLATED_PG_TEST=true and disposable cluster on port 55449');
  const lane = randomUUID(), quote = randomUUID(), competing = randomUUID();
  run(`insert into resources(id,name,type) values('${lane}','SYNTHETIC CONCURRENCY','lane');
    insert into block_booking_quotes(id,capability_hash,input,snapshot,configuration,amount_pence,expires_at)
    select '${quote}',repeat('a',64),jsonb_build_object('resourceId','${lane}'),jsonb_build_object('occurrences',jsonb_build_array(
      jsonb_build_object('resourceId','${lane}','pricingResourceId','${lane}','bookingDate','2035-03-01','startAt','2035-03-01T15:00:00Z','endAt','2035-03-01T16:00:00Z','bufferMinutes',0,'amountPence',2500),
      jsonb_build_object('resourceId','${lane}','pricingResourceId','${lane}','bookingDate','2035-03-08','startAt','2035-03-08T15:00:00Z','endAt','2035-03-08T16:00:00Z','bufferMinutes',0,'amountPence',3000))),
      jsonb_build_object('resources',(select jsonb_agg(r) from resources r),'resource_availability_rules',(select coalesce(jsonb_agg(r),'[]') from resource_availability_rules r),
      'pricing_rules',(select coalesce(jsonb_agg(r),'[]') from pricing_rules r),'slot_overrides',(select coalesce(jsonb_agg(r),'[]') from slot_overrides r),'blocked_slots',(select coalesce(jsonb_agg(r),'[]') from blocked_slots r)),5500,now()+interval '10 minutes';
    insert into block_booking_quotes select '${competing}',capability_hash,input,snapshot,configuration,amount_pence,expires_at,created_at from block_booking_quotes where id='${quote}';`);
  const reserve = id => `select reserve_block_booking('${id}',repeat('a',64),'{"name":"Synthetic","email":"test@example.invalid"}','https://example.invalid')->>'id';`;
  const same = await Promise.all([parallel(reserve(quote)), parallel(reserve(quote))]);
  assert.equal(same[0], same[1]);
  const block = same[0];
  assert.equal(run(`select count(*) from bookings where block_booking_id='${block}'`), '2');
  await assert.rejects(() => parallel(reserve(competing)));
  run(`select attach_block_checkout('block:${block}','cs_${block}');`);
  const paid = `select confirm_block_booking('${block}','cs_${block}','{"currency":"gbp","amount":5500}');`;
  assert.deepEqual((await Promise.all([parallel(paid), parallel(paid)])).sort(), ['f', 't']);
  assert.equal(run(`select count(*) from booking_notification_outbox o join bookings b on b.id=o.resource_booking_id where b.block_booking_id='${block}'`), '2');
  console.log('PASS: concurrent retries reserve once; conflicting block rejected; concurrent confirmations queue receipts once');
})().catch(error => { console.error(error); process.exitCode = 1; });
