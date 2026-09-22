import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { couponRows } from '@/lib/coupon-summary';
import { accessibleScope, guestAccessEnabled, readGuestToken } from '@/lib/security/guest-access';
import { getVerifiedCustomerId } from '@/lib/security/customer-auth';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { bookingAttachments, verifiedPayment, type VerifiedPayment } from '@/lib/services/booking-documents';
import { getStripe } from '@/lib/services/stripe';

const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
const reply = (data: unknown,status=200) => NextResponse.json(data,{ status,headers });
export async function GET(request: NextRequest) {
  if (!guestAccessEnabled()) return reply({ error: 'Unavailable' },503);
  const owner = await getVerifiedCustomerId(request);
  const limited = await enforceRateLimit(request,{ policy: 'privateRead', subject: owner ?? readGuestToken(request) ?? 'no-session' });
  if (limited) return limited;
  const kind = request.nextUrl.searchParams.get('kind') === 'group' ? 'group' : 'resource';
  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return reply({ error: 'Booking unavailable' },404);
  try {
    const scope = await accessibleScope(request,kind,id);
    if (!scope) return reply({ error: 'Booking unavailable' },404);
    const { data: row,error } = kind === 'resource'
      ? await supabaseAdmin.from('bookings').select('id,booking_reference,customer_name,customer_email,service_type,start_at,end_at,status,payment_status,amount,stripe_session_id,coupon_snapshot').eq('id',id).single()
      : await supabaseAdmin.from('group_session_bookings').select('id,parent_name,parent_email,status,payment_status,amount,stripe_session_id,coupon_snapshot,session:group_sessions(title,schedule,session_kind)').eq('id',id).single();
    if (error || !row) throw new Error('Unavailable');
    // Explicit DTO: no medical notes, other players, internal notes or secrets.
    const booking = row as Record<string, any>;
    const session = Array.isArray(booking.session) ? booking.session[0] : booking.session;
    const details = {
      reference: booking.booking_reference ?? booking.id,
      service: booking.service_type ?? session?.title ?? 'Group session',
      schedule: booking.start_at ? `${booking.start_at} – ${booking.end_at}` : session?.schedule ?? '',
      status: booking.status, paymentStatus: booking.payment_status, amount: booking.amount, discount: couponRows(booking.coupon_snapshot),
    };
    const document = request.nextUrl.searchParams.get('document');
    if (!document) return reply(details);
    if (!['confirmation','receipt'].includes(document) || !['confirmed','completed'].includes(booking.status)) return reply({ error: 'Document unavailable for this booking status' },409);
    let payment: VerifiedPayment | undefined;
    if (booking.payment_status === 'paid' && booking.stripe_session_id) {
      const paid = await getStripe().checkout.sessions.retrieve(booking.stripe_session_id);
      if (paid.id !== booking.stripe_session_id || paid.metadata?.booking_id !== id ||
          (kind === 'group') !== (paid.metadata?.booking_kind === 'group_session') ||
          paid.amount_total !== Math.round(Number(booking.amount) * 100)) throw new Error('Payment verification unavailable');
      payment = verifiedPayment(paid);
    }
    if (document === 'receipt' && !payment) return reply({ error: 'No verified payment receipt available' },409);
    const files = await bookingAttachments({ reference: details.reference, customer: booking.customer_name ?? booking.parent_name,
      email: booking.customer_email ?? booking.parent_email, service: details.service,
      details: [...details.discount,['Schedule',details.schedule],['Status',details.status]], payment });
    const file = files[document === 'receipt' ? 1 : 0]!;
    return new NextResponse(new Uint8Array(file.content), { headers: { ...headers, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${file.filename}"` } });
  } catch { return reply({ error: 'Booking temporarily unavailable. Please contact support.' },503); }
}
