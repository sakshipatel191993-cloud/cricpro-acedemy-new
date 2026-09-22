const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
// Hardcoded isolated cluster, never accepts a production connection string.
const args = ['-h','127.0.0.1','-p','55439','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At','-c'];
const sql = async query => (await run('C:/Program Files/PostgreSQL/15/bin/psql.exe',[...args,query])).stdout.trim();
(async()=> {
 if(process.env.ALLOW_ISOLATED_PG_TEST!=='true'){ console.log('SKIP: set ALLOW_ISOLATED_PG_TEST=true with the isolated PostgreSQL fixture running'); return; }
 try {
  await sql(`insert into group_sessions(id,title,age_group,max_players,schedule,price) values('guest-race-session','Synthetic','11-15',2,'Synthetic test',25);
  insert into group_session_bookings(id,session_id,player_name,parent_name,parent_email,parent_phone) values('guest-race-booking','guest-race-session','Synthetic','Synthetic','synthetic@example.invalid','000');
  insert into booking_access_scopes(id,group_booking_id) values('00000000-0000-4000-8000-000000000009','guest-race-booking');
  select issue_booking_access_link('00000000-0000-4000-8000-000000000009','race-hash');`);
  const results = await Promise.all(Array.from({length:8},(_,i)=>sql(`select exchange_booking_access_link('race-hash','race-session-${i}')`)));
  assert.equal(results.filter(Boolean).length,1,'Exactly one concurrent exchange must succeed');
  assert.equal(await sql(`select count(*) from booking_access_sessions where scope_id='00000000-0000-4000-8000-000000000009'`),'1');
  console.log('PASS: eight separate Postgres connections race; exactly one group-booking token exchange/session');
 } finally {
  await sql(`delete from booking_access_scopes where id='00000000-0000-4000-8000-000000000009'; delete from group_session_bookings where id='guest-race-booking'; delete from group_sessions where id='guest-race-session';`);
 }
})().catch(error=>{console.error(error);process.exitCode=1});
