"""Exercise the migration and seat lifecycle inside a rolled-back transaction."""
from pathlib import Path
from uuid import uuid4
import psycopg
root = Path(__file__).resolve().parents[3]
dsn = next(line.split('=', 1)[1].strip().strip('\"\'') for line in (root/'apps/web/.env.local').read_text().splitlines() if line.startswith('DATABASE_URL='))
with psycopg.connect(dsn, connect_timeout=10) as conn:
    try:
        conn.execute("SET lock_timeout = '5s'")
        conn.execute("SET statement_timeout = '15s'")
        migration=(root/'apps/web/lib/db/migrations/20260916-session-payments.sql').read_text().replace('BEGIN;', '').replace('COMMIT;', '')
        conn.execute(migration)
        sid='payment-test-'+str(uuid4())
        bid=str(uuid4())
        conn.execute("INSERT INTO group_sessions(id,title,age_group,max_players,schedule,price) VALUES (%s,'Payment test','6-18',1,'Sunday',40)",(sid,))
        def count(): return conn.execute('SELECT current_players FROM group_sessions WHERE id=%s',(sid,)).fetchone()[0]
        def insert(id): conn.execute("INSERT INTO group_session_bookings(id,session_id,player_name,parent_name,parent_email,parent_phone,status,payment_status,amount) VALUES (%s,%s,'Test','Test','test@example.invalid','000','pending_payment','pending',40)",(id,sid))
        insert(bid)
        assert count()==1, 'Pending checkout must hold a place'
        try:
            with conn.transaction(): insert(str(uuid4()))
        except psycopg.errors.CheckViolation: pass
        else: raise AssertionError('Full session accepted another booking')
        conn.execute("UPDATE group_session_bookings SET status='confirmed',payment_status='paid' WHERE id=%s AND status='pending_payment'",(bid,))
        conn.execute("UPDATE group_session_bookings SET status='confirmed',payment_status='paid' WHERE id=%s AND status='pending_payment'",(bid,))
        assert count()==1, 'Confirming/replaying payment must not count twice'
        conn.execute("UPDATE group_session_bookings SET status='expired' WHERE id=%s AND status='pending_payment'",(bid,))
        assert count()==1, 'Late expiry must not release a paid place'
        conn.execute("UPDATE group_session_bookings SET status='cancelled' WHERE id=%s",(bid,))
        assert count()==0
        bid2=str(uuid4());insert(bid2)
        conn.execute("UPDATE group_session_bookings SET status='expired',payment_status='failed' WHERE id=%s",(bid2,))
        assert count()==0, 'Expired checkout must release capacity'
        conn.execute('DELETE FROM group_session_bookings WHERE id=%s',(bid2,))
        assert count()==0, 'Deleting expired booking must not decrement twice'
        print('PASS: capacity hold, last-place rejection, idempotent confirmation, late expiry, cancellation and expiry release (rolled back)')
    finally: conn.rollback()
