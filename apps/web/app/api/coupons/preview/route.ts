import { supabaseAdmin } from "@/lib/services/supabase"
import { couponsEnabled } from "@/lib/services/coupons"
import { quoteCapability } from "@/lib/services/booking-quotes"
import { isSameOriginRequest } from "@/lib/security/admin-auth"
import { enforceRateLimit } from "@/lib/security/rate-limit"
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body"
import { normalizeCoupon, fixedDiscountTotal } from "@/lib/coupons"

export async function GET() {
  return Response.json(
    { enabled: couponsEnabled() },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export async function POST(request: Request) {
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
  if (!isSameOriginRequest(request)) return json({ error: "Forbidden" }, 403)
  const limited = await enforceRateLimit(request, { policy: "quote" })
  if (limited) return limited
  if (!couponsEnabled())
    return json({ error: "Coupons are currently unavailable" }, 503)
  try {
    const body = await readJsonBody(request, 4096)
    const code = normalizeCoupon(body.code)
    let subtotal: number
    if (typeof body.quoteId === "string") {
      const hash = quoteCapability(request, body.quoteId)
      if (!hash) return json({ error: "Refresh your booking quote" }, 403)
      const { data, error } = await supabaseAdmin
        .from("booking_quotes")
        .select("amount_pence,expires_at,input")
        .eq("id", body.quoteId)
        .eq("capability_hash", hash)
        .single()
      if (error || !data || Date.parse(data.expires_at) <= Date.now())
        return json({ error: "Refresh your booking quote" }, 409)
      if (data.input?.serviceType !== "lane_hire")
        return json({ error: "Coupons are available for lane hire only" }, 400)
      subtotal = Number(data.amount_pence)
    } else if (typeof body.sessionId === "string") {
      return json({ error: "Coupons are available for lane hire only" }, 400)
    } else return json({ error: "Choose a booking first" }, 400)
    const { data: coupon, error } = await supabaseAdmin
      .from("coupons")
      .select("code,version,fixed_discount_minor,minimum_subtotal_minor,applies_to_service_type,starts_at,expires_at,status")
      .eq("code", code)
      .single()
    if (
      error ||
      !coupon ||
      coupon.status !== "active" ||
      coupon.applies_to_service_type !== "lane_hire" ||
      Date.parse(coupon.starts_at) > Date.now() ||
      Date.parse(coupon.expires_at) <= Date.now()
    )
      return json({ error: "This coupon is not available" }, 400)
    if (subtotal < coupon.minimum_subtotal_minor)
      return json({ error: "Coupons apply to lane hire totals of £25 or more" }, 400)
    return json({
      coupon: {
        code,
        version: coupon.version,
        ...fixedDiscountTotal(subtotal, coupon.fixed_discount_minor),
      },
    })
  } catch (error) {
    return json(
      {
        error:
          error instanceof RequestBodyError
            ? error.message
            : "Unable to apply this coupon. Check the code and payment amount.",
      },
      error instanceof RequestBodyError ? error.status : 400
    )
  }
}
