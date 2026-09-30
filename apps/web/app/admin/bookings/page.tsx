'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Booking {
  id: string;
  booking_reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  start_at: string;
  end_at: string;
  status: string;
  payment_status: string;
  refund_status?: string | null;
  block_booking_id?: string | null;
  amount: string;
  coupon_snapshot?: { code: string; discountMinor: number; subtotalMinor: number } | null;
  resource: { name: string; type: string };
  service_type: string;
  created_at: string;
  notes: string | null;
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const totalPages = Math.ceil(total / 20);

  useEffect(() => {
    fetchBookings();
  }, [statusFilter, page]);

  async function fetchBookings() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', page.toString());

      const res = await fetch(`/api/admin/bookings?${params}`);
      const data = await res.json();
      if (data.success) {
        setBookings(data.bookings);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking(booking: Booking, refund: boolean) {
    const message = refund
      ? `Cancel ${booking.booking_reference} and request a full £${booking.amount} refund to the original payment method?`
      : `Cancel ${booking.booking_reference}${booking.payment_status === 'paid' ? ' without refunding the payment' : ''}?`;
    if (!window.confirm(message)) return;
    setBusyId(booking.id);
    try {
      const res = await fetch('/api/admin/cancel-booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'resource', id: booking.id, refund }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Unable to cancel booking');
      if (refund && ['failed', 'canceled'].includes(data.booking.refund_status)) toast.error(`Booking cancelled, but the refund ${data.booking.refund_status}. Review it in Stripe.`);
      else toast.success(refund ? data.booking.refund_status === 'succeeded' ? 'Booking cancelled and refund succeeded' : 'Booking cancelled; refund is processing' : 'Booking cancelled');
      await fetchBookings();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to cancel booking'); }
    finally { setBusyId(null); }
  }

  const statusColors: Record<string, string> = {
    pending_payment: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400',
    confirmed: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400',
    expired: 'bg-muted text-muted-foreground',
    refunded: 'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400'
  };

  const paymentColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400',
    paid: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
    refunded: 'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-400'
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Bookings</h1>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="min-h-11 w-full rounded-lg border bg-background px-4 py-2 text-foreground sm:w-auto"
        >
          <option value="">All Statuses</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-card rounded-lg shadow p-8 text-center text-muted-foreground">
          No bookings found
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {bookings.map(booking => <article key={booking.id} className="min-w-0 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{booking.customer_name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{booking.booking_reference}</p></div><span className="shrink-0 font-semibold tabular-nums">£{booking.amount}</span></div>
              <p className="mt-3 text-sm text-muted-foreground">{booking.resource?.name} · {new Date(booking.start_at).toLocaleDateString('en-GB', { timeZone: 'Europe/London' })}</p>
              <p className="mt-1 text-sm text-muted-foreground">{new Date(booking.start_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}–{new Date(booking.end_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}</p>
              {booking.coupon_snapshot?.code && <p className="mt-2 text-xs text-muted-foreground">{booking.coupon_snapshot.code} · saved £{(booking.coupon_snapshot.discountMinor / 100).toFixed(2)}</p>}
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4"><div><p className="text-xs text-muted-foreground">Booking</p><p className="mt-3 text-sm font-medium capitalize">{booking.status.replaceAll('_', ' ')}</p></div><div><p className="text-xs text-muted-foreground">Payment</p><p className="mt-3 text-sm font-medium capitalize">{booking.refund_status ? `Refund ${booking.refund_status}` : booking.payment_status}</p></div></div>
              {!booking.block_booking_id && (booking.status === 'confirmed' || booking.status === 'completed' || (booking.status === 'cancelled' && (booking.payment_status === 'paid' || booking.refund_status))) && <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold"><button disabled={busyId === booking.id || booking.status === 'cancelled'} onClick={() => cancelBooking(booking, false)} className="min-h-11 text-destructive disabled:opacity-50">Cancel</button>{(booking.payment_status === 'paid' || booking.refund_status) && <button disabled={busyId === booking.id} onClick={() => cancelBooking(booking, true)} className="min-h-11 text-primary disabled:opacity-50">{booking.refund_status ? 'Refresh refund' : 'Cancel & refund'}</button>}</div>}
              {booking.block_booking_id && <p className="mt-3 text-xs text-muted-foreground">Part of a block booking. Contact support to change the whole block.</p>}
              <button onClick={() => { const notes = prompt('Add notes:', booking.notes || ''); if (notes !== null) fetch('/api/admin/bookings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: booking.id, notes }) }); }} className="mt-3 min-h-11 text-sm font-semibold text-primary">Edit notes</button>
            </article>)}
          </div>
          <div className="hidden overflow-hidden rounded-lg bg-card shadow md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Ref</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Resource</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Payment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-muted">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{booking.booking_reference}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="text-foreground">{booking.customer_name}</div>
                        <div className="text-muted-foreground text-xs">{booking.customer_email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{booking.resource?.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(booking.start_at).toLocaleDateString([], { timeZone: 'UTC' })}
                        <div className="text-xs">
                          {new Date(booking.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} -
                          {new Date(booking.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">£{booking.amount}{booking.coupon_snapshot?.code && <p className="text-xs text-muted-foreground">{booking.coupon_snapshot.code} · saved £{(booking.coupon_snapshot.discountMinor / 100).toFixed(2)} from £{(booking.coupon_snapshot.subtotalMinor / 100).toFixed(2)}</p>}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded border ${statusColors[booking.status] || 'bg-muted text-muted-foreground'}`}>{booking.status.replaceAll('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${paymentColors[booking.payment_status] || 'bg-muted text-muted-foreground'}`}>
                          {booking.refund_status ? `Refund ${booking.refund_status}` : booking.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {!booking.block_booking_id && (booking.status === 'confirmed' || booking.status === 'completed') && <><button disabled={busyId === booking.id} onClick={() => cancelBooking(booking, false)} className="mr-3 text-destructive hover:underline disabled:opacity-50">Cancel</button>{booking.payment_status === 'paid' && <button disabled={busyId === booking.id} onClick={() => cancelBooking(booking, true)} className="mr-3 text-primary hover:underline disabled:opacity-50">Cancel & refund</button>}</>}
                        {!booking.block_booking_id && booking.status === 'cancelled' && (booking.payment_status === 'paid' || booking.refund_status) && <button disabled={busyId === booking.id} onClick={() => cancelBooking(booking, true)} className="mr-3 text-primary hover:underline disabled:opacity-50">{booking.refund_status ? 'Refresh refund' : 'Refund payment'}</button>}
                        {booking.block_booking_id && <span className="mr-3 text-xs text-muted-foreground">Block booking</span>}
                        <button
                          onClick={() => {
                            const notes = prompt('Add notes:', booking.notes || '');
                            if (notes !== null) {
                              fetch('/api/admin/bookings', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: booking.id, notes })
                              });
                            }
                          }}
                          className="text-primary hover:underline"
                        >
                          Notes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border rounded disabled:opacity-50 bg-background text-foreground"
              >
                Previous
              </button>
              <span className="text-muted-foreground">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border rounded disabled:opacity-50 bg-background text-foreground"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
