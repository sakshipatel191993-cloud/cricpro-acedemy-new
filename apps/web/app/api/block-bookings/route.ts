import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { paymentsEnabled } from '@/lib/services/stripe';
import { isSameOriginRequest } from '@/lib/security/admin-auth';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readJsonBody, RequestBodyError } from '@/lib/security/request-body';
import { quoteCapability, requireQuoteRollout } from '@/lib/services/booking-quotes';
import { blockQuoteCookieName } from '@/lib/services/block-bookings';
import { QuoteError } from '@/lib/booking-quote';
import { checkoutAppUrl, startPersistedCheckout } from '@/lib/services/checkout-attempts';
import { provisionBookingAccess } from '@/lib/security/guest-access';
import { whatsappConsentFields } from '@/lib/services/whatsapp';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  const limited = await enforceRateLimit(request, { policy: 'booking' });
  if (limited) return limited;
  try {
    requireQuoteRollout();
    if (!paymentsEnabled) throw new QuoteError('Online payment booking is temporarily unavailable', 503);
    const body = await readJsonBody(request);
    const { quoteId, customerName, customerEmail, customerPhone, playerCount, notes } = body;
    if (['couponCode', 'couponVersion', 'discount', 'discountMinor'].some(key => body[key] !== undefined)) throw new QuoteError('Discounts are not available for block bookings');
    if (typeof quoteId !== 'string' || typeof customerName !== 'string' || !customerName.trim() || customerName.length > 120 ||
        typeof customerEmail !== 'string' || customerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) ||
        (customerPhone !== undefined && (typeof customerPhone !== 'string' || customerPhone.length > 40)) ||
        (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000)) ||
        (playerCount !== undefined && (typeof playerCount !== 'number' || !Number.isInteger(playerCount) || playerCount < 1 || playerCount > 6))) throw new QuoteError('Please check your booking details');
    const capability = quoteCapability(request, quoteId, blockQuoteCookieName);
    if (!capability) throw new QuoteError('Review a fresh block quote before booking', 403);
    let consent;
    try { consent = whatsappConsentFields(customerPhone, body.whatsappConsent); }
    catch { throw new QuoteError('Please check your phone number and WhatsApp consent'); }
    const { data: booking, error } = await supabaseAdmin.rpc('reserve_block_booking', {
      p_quote_id: quoteId, p_capability_hash: capability,
      p_customer: { name: customerName.trim(), email: customerEmail.trim().toLowerCase(), phone: customerPhone || null, playerCount: playerCount ?? null, notes: notes || null, ...consent },
      p_app_url: checkoutAppUrl(request),
    });
    if (error || !booking) throw new QuoteError('One or more dates or prices changed. Review a fresh block quote.', 409);
    const { data: children, error: childError } = await supabaseAdmin.from('bookings').select('id').eq('block_booking_id', booking.id).order('start_at');
    if (childError || !children?.length) throw new Error('Block sessions unavailable');
    // The first session provides a scoped capability for the block summary.
    const access = await provisionBookingAccess(request, 'resource', children[0]!.id);
    const checkout = await startPersistedCheckout({ bookingId: booking.id, bookingReference: booking.booking_reference,
      bookingKind: 'block', serviceType: 'lane_hire', amount: String(booking.amount), customerEmail: booking.customer_email,
      customerName: booking.customer_name, description: `Lane hire block - ${children.length} sessions`, expiresAt: Math.floor(Date.parse(booking.expires_at) / 1000),
      appUrl: checkoutAppUrl(request) });
    if (!checkout.url) throw new QuoteError('This checkout has completed or expired. Please check your booking status.', 409);
    const response = NextResponse.json({ success: true, booking: { id: booking.id, booking_reference: booking.booking_reference }, paymentUrl: checkout.url, expiresAt: booking.expires_at }, { headers: { 'Cache-Control': 'no-store' } });
    if (access) response.cookies.set(access.cookie.name, access.cookie.value, access.cookie.options);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof QuoteError ? error.message : 'Checkout could not be started. Retry this booking or contact the centre.' }, { status: error instanceof QuoteError || error instanceof RequestBodyError ? error.status : 503 });
  }
}
