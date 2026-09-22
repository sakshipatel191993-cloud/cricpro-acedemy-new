// Only the disposable localhost test fixture; no production URL accepted.
const { execFile, execFileSync } = require("node:child_process"),
  assert = require("node:assert/strict")
const cli = "C:/Program Files/PostgreSQL/15/bin/psql.exe"
const args = [
  "-h",
  "127.0.0.1",
  "-p",
  "55439",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-At",
]
const run = (sql) =>
  execFileSync(cli, [...args, "-c", sql], { encoding: "utf8" }).trim()
const concurrent = (sql) =>
  new Promise((resolve, reject) =>
    execFile(cli, [...args, "-c", sql], { encoding: "utf8" }, (e, out) =>
      e ? reject(e) : resolve(out)
    )
  )
;(async () => {
  if (process.env.ALLOW_ISOLATED_PG_TEST !== "true") {
    console.log("SKIP: isolated PostgreSQL opt-in required")
    return
  }
  const prefix = "coupon-race-synthetic"
  try {
    run(`insert into coupons(code,percent_off,max_uses,starts_at,expires_at,status) values('RACETEST15',15,1,now()-interval '1 day',now()+interval '1 day','active'),('RACETEST20',20,50,now()-interval '1 day',now()+interval '1 day','active');
  insert into group_sessions(id,title,age_group,max_players,schedule,price) values('${prefix}','Synthetic','11-15',20,'Synthetic',40);`)
    const reserve = (id, code, email) =>
      `select reserve_group_with_coupon('${JSON.stringify({ id: prefix + id, session_id: prefix, player_name: "Synthetic", parent_name: "Synthetic", parent_email: "synthetic@example.invalid", parent_phone: "000", amount: 40, status: "pending_payment", payment_status: "pending", request_hash: "a".repeat(64), checkout_description: "Synthetic", checkout_service_type: "group_session" })}'::jsonb,'${code}',1,'${email.repeat(64)}',null);`
    const results = await Promise.allSettled([
      concurrent(
        `begin;${reserve("1", "RACETEST15", "1")}select pg_sleep(1);commit;`
      ),
      concurrent(reserve("2", "RACETEST15", "2")),
    ])
    assert.equal(
      results.filter((r) => r.status === "fulfilled").length,
      1,
      "Only one final-cap redemption"
    )
    assert.equal(
      run(
        `select count(*) from coupon_redemptions r join coupons c on c.id=r.coupon_id where c.code='RACETEST15' and r.state='reserved'`
      ),
      "1"
    )
    // Separate codes still share the same customer cap.
    run(`update coupons set max_uses=50 where code='RACETEST15'`)
    const sameCustomer = await Promise.allSettled([
      concurrent(
        `begin;${reserve("3", "RACETEST15", "3")}select pg_sleep(1);commit;`
      ),
      concurrent(reserve("4", "RACETEST20", "3")),
    ])
    assert.equal(
      sameCustomer.filter((r) => r.status === "fulfilled").length,
      1,
      "One customer cannot reserve both codes concurrently"
    )
    const duplicate = await Promise.all([
      concurrent(reserve("5", "RACETEST20", "5")),
      concurrent(reserve("5", "RACETEST20", "5")),
    ])
    assert.equal(duplicate.length, 2)
    assert.equal(
      run(
        `select count(*) from coupon_redemptions where group_booking_id='${prefix}5'`
      ),
      "1"
    )
    console.log(
      "PASS: final coupon use, cross-code customer cap, duplicate checkout and atomic capacity rollback under concurrent connections"
    )
  } finally {
    run(
      `delete from coupon_redemptions where group_booking_id like '${prefix}%';delete from group_session_bookings where session_id='${prefix}';delete from group_sessions where id='${prefix}';delete from coupon_audit where coupon_id in(select id from coupons where code in('RACETEST15','RACETEST20'));delete from coupons where code in('RACETEST15','RACETEST20');`
    )
  }
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
