import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/services/supabase"
import { paymentsEnabled } from "@/lib/services/stripe"
import { enforceRateLimit } from "@/lib/security/rate-limit"
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body"
import { requireQuoteRollout, quoteCapability } from "@/lib/services/booking-quotes"
import { QuoteError } from "@/lib/booking-quote"
import { checkoutAppUrl, startPersistedCheckout } from "@/lib/services/checkout-attempts"
import { provisionBookingAccess, guestAccessEnabled } from "@/lib/security/guest-access"
import { isSameOriginRequest, isAdminRequest } from "@/lib/security/admin-auth"
import { getVerifiedCustomerId } from "@/lib/security/customer-auth"
import { couponsEnabled, couponRequest } from "@/lib/services/coupons"
import { whatsappConsentFields } from "@/lib/services/whatsapp"

const notConfigured = () =>
  NextResponse.json(
    {
      success: false,
      error: "Database not configured. Add Supabase credentials to .env.local.",
    },
    { status: 503 }
  )

export async function GET(request: NextRequest) {
  const admin = await isAdminRequest(request)
  const customerId = admin ? null : await getVerifiedCustomerId(request)
  if (!admin && !customerId) {
    return NextResponse.json({ success: false, error: "Sign in to view your bookings" }, { status: 401 })
  }
  const limitedRead = await enforceRateLimit(request,{ policy:'privateRead',subject:customerId ?? 'admin-bookings' })
  if (limitedRead) return limitedRead
  if (!isSupabaseConfigured) return notConfigured()
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status")
    const email = searchParams.get("email")
    const date = searchParams.get("date")

    let query = supabaseAdmin
      .from("bookings")
      .select(admin ? "*" : "id,booking_reference,service_type,booking_date,start_at,end_at,status,payment_status,amount,created_at,resource:resources!bookings_resource_id_fkey(name,type)")
      .order("created_at", { ascending: false })
      .limit(100)

    // Email, query parameters and profile metadata are never ownership proof.
    if (!admin) {
      if (guestAccessEnabled()) {
        const { data: scopes, error: scopeError } = await supabaseAdmin.from('booking_access_scopes').select('booking_id').eq('owner_id',customerId!).not('booking_id','is',null).limit(100);
        if (scopeError) throw scopeError;
        query = query.in('id',(scopes ?? []).map(scope => scope.booking_id));
      } else query = query.eq("user_id", customerId!)
    }

    if (status) query = query.eq("status", status)
    if (admin && email) query = query.eq("customer_email", email)
    if (date) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)
      query = query
        .gte("booking_date", startOfDay.toISOString())
        .lte("booking_date", endOfDay.toISOString())
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ success: true, bookings: data }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Bookings list error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch bookings" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  if (!isSupabaseConfigured) return notConfigured();
  try {
    requireQuoteRollout();
    if (!paymentsEnabled) throw new QuoteError('Online payment booking is temporarily unavailable', 503);
    const body = await readJsonBody(request);
    const { quoteId, customerName, customerEmail, customerPhone, playerCount, notes } = body;
    if (typeof quoteId !== 'string' || typeof customerName !== 'string' || !customerName.trim() || customerName.length > 120 ||
        typeof customerEmail !== 'string' || customerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) ||
        (customerPhone !== undefined && (typeof customerPhone !== 'string' || customerPhone.length > 40)) ||
        (notes !== undefined && (typeof notes !== 'string' || notes.length > 2000)) ||
        (playerCount !== undefined && (!Number.isInteger(playerCount) || Number(playerCount) < 1 || Number(playerCount) > 6))) {
      throw new QuoteError('Please check your booking details');
    }
    const capabilityHash = quoteCapability(request, quoteId);
    const limited = await enforceRateLimit(request, { policy: 'booking', ...(capabilityHash ? { subject: `quote:${capabilityHash}` } : {}) });
    if (limited) return limited;
    if (!capabilityHash) throw new QuoteError('Review a fresh quote before booking', 403);
    let whatsappFields;
    try { whatsappFields = whatsappConsentFields(customerPhone, body.whatsappConsent); }
    catch (error) { throw new QuoteError((error as Error).message); }
    // The service-only transaction rechecks exact configuration and inventory,
    // serialises overlapping requests and permits only one booking per quote.
    const promotion = await couponRequest(request, body, customerEmail);
    const { data: booking, error } = await supabaseAdmin.rpc(couponsEnabled() ? 'reserve_quote_with_coupon' : 'reserve_booking_quote', {
      p_quote_id: quoteId, p_capability_hash: capabilityHash, p_payments: true,
      p_customer: { name: customerName.trim(), email: customerEmail.trim().toLowerCase(), phone: customerPhone || null, playerCount: playerCount ?? null, notes: notes || null, ...whatsappFields },
      ...(couponsEnabled() ? promotion : {}),
    });
    if (error || !booking) throw new QuoteError('The quote or coupon is no longer available. Refresh the quote and reapply or remove the coupon.', 409);
    const access = await provisionBookingAccess(request, 'resource', booking.id);
    const result = await startPersistedCheckout({
      bookingId: booking.id, bookingReference: booking.booking_reference,
      serviceType: booking.service_type, amount: String(booking.amount),
      customerEmail: booking.customer_email, customerName: booking.customer_name,
      description: `${booking.service_type.replace(/_/g, ' ')} – ${String(booking.booking_date).slice(0, 10)}`,
      expiresAt: Math.floor(new Date(booking.expires_at).getTime() / 1000),
      appUrl: checkoutAppUrl(request),
      ...(booking.coupon_snapshot?.code ? { coupon: booking.coupon_snapshot } : {}),
    });
    if (!result.url) throw new QuoteError('This checkout is already completed or expired. Please check your booking status.', 409);
    const response = NextResponse.json({
      success: true, booking: { id: booking.id, booking_reference: booking.booking_reference },
      paymentUrl: result.url, expiresAt: booking.expires_at,
    }, { headers: { 'Cache-Control': 'no-store' } });
    if (access) response.cookies.set(access.cookie.name, access.cookie.value, access.cookie.options);
    return response;
  } catch (error) {
    // Never release the reservation after a provider timeout: its payment outcome
    // may be unknown. Durable checkout reconciliation owns recovery.
    return NextResponse.json({ success: false, error: error instanceof QuoteError ? error.message : 'Checkout could not be started. Retry this booking or contact the centre.' },
      { status: error instanceof QuoteError || error instanceof RequestBodyError ? error.status : 503 });
  }
}

export async function DELETE() {
  // Retire the ID/email-only endpoint. A future self-service cancellation flow
  // needs ownership/capability checks and an actual verified payment refund.
  return NextResponse.json(
    { success: false, error: "Online cancellation is unavailable. Please contact info@cricprocoe.com for cancellation and refund assistance." },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  )
}
