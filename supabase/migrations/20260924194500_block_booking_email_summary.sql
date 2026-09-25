-- Block payments send one complete summary to the customer and one to admins.
-- Keep legacy duplicate jobs for audit, but prevent automatic duplicate delivery.
with ranked as (
  select o.id,o.state,b.block_booking_id,o.recipient_role,
    bool_or(o.state='sent') over(partition by b.block_booking_id,o.recipient_role) as has_sent,
    row_number() over(partition by b.block_booking_id,o.recipient_role order by o.created_at,o.id) as position
  from public.booking_notification_outbox o
  join public.bookings b on b.id=o.resource_booking_id
  where b.block_booking_id is not null
)
update public.booking_notification_outbox o
set state='attention',lease_until=null
from ranked r
where o.id=r.id and o.state='pending' and (r.has_sent or r.position>1);

-- A block receipt represents the single Stripe charge, so retained jobs carry
-- the complete paid amount rather than one child's allocated amount.
update public.booking_notification_outbox o
set payment=jsonb_set(o.payment,'{amount}',to_jsonb(round(block.amount*100)::bigint),true)
from public.bookings child
join public.block_bookings block on block.id=child.block_booking_id
where o.resource_booking_id=child.id and child.block_booking_id is not null and o.state<>'sent';

create or replace function public.confirm_block_booking(p_booking_id uuid,p_session_id text,p_payment jsonb)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare b public.block_bookings; child public.bookings; notification_booking_id uuid;
begin
 perform 1 from public.checkout_attempts where block_booking_id=p_booking_id for update;
 select * into strict b from public.block_bookings where id=p_booking_id for update;
 if b.stripe_session_id is distinct from p_session_id or p_payment->>'currency' is distinct from 'gbp' or (p_payment->>'amount')::numeric is distinct from round(b.amount*100) then raise exception 'Block payment mismatch'; end if;
 if b.status='confirmed' and b.payment_status='paid' then return false; end if;
 if b.status<>'pending_payment' then raise exception 'Block not pending'; end if;
 if exists(select 1 from public.bookings where block_booking_id=b.id and status<>'pending_payment') or
  (select sum(amount) from public.bookings where block_booking_id=b.id) is distinct from b.amount then raise exception 'Block inventory mismatch'; end if;
 for child in select * from public.bookings where block_booking_id=b.id order by start_at for update loop
  update public.bookings set status='confirmed',payment_status='paid' where id=child.id;
  notification_booking_id:=coalesce(notification_booking_id,child.id);
 end loop;
 if notification_booking_id is null then raise exception 'Block inventory missing'; end if;
 insert into public.booking_notification_outbox(resource_booking_id,recipient_role,payment)
 values(notification_booking_id,'customer',p_payment),(notification_booking_id,'admin',p_payment);
 update public.block_bookings set status='confirmed',payment_status='paid' where id=b.id;
 update public.checkout_attempts set resolved=true where block_booking_id=b.id;
 return true;
end $$;

create function public.claim_block_booking_notifications(p_block_booking_id uuid,p_limit integer default 2)
returns setof public.booking_notification_outbox language plpgsql security invoker set search_path='' as $$
begin
 return query update public.booking_notification_outbox o
 set state='sending',lease_until=now()+interval '5 minutes',attempts=attempts+1
 where o.id in (
  select q.id from public.booking_notification_outbox q
  join public.bookings child on child.id=q.resource_booking_id
  where child.block_booking_id=p_block_booking_id and q.state in ('pending','sending')
    and q.next_attempt_at<=now() and (q.lease_until is null or q.lease_until<now())
  order by q.next_attempt_at for update of q skip locked limit greatest(1,least(p_limit,2))
 ) returning o.*;
end $$;

revoke all on function public.claim_block_booking_notifications(uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_block_booking_notifications(uuid,integer) to service_role;
