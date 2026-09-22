import { supabaseAdmin } from "@/lib/services/supabase"
import { couponsEnabled } from "@/lib/services/coupons"
import { quoteCapability } from "@/lib/services/booking-quotes"
import { isSameOriginRequest } from "@/lib/security/admin-auth"
import { enforceRateLimit } from "@/lib/security/rate-limit"
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body"
import { normalizeCoupon, discountTotal } from "@/lib/coupons"
import { moneyPence } from "@/lib/booking-quote"

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
        .select("amount_pence,expires_at")
        .eq("id", body.quoteId)
        .eq("capability_hash", hash)
        .single()
      if (error || !data || Date.parse(data.expires_at) <= Date.now())
        return json({ error: "Refresh your booking quote" }, 409)
      subtotal = Number(data.amount_pence)
    } else if (typeof body.sessionId === "string") {
      const { data, error } = await supabaseAdmin
        .from("group_sessions")
        .select("price")
        .eq("id", body.sessionId)
        .eq("active", true)
        .single()
      if (error || !data) return json({ error: "Session unavailable" }, 409)
      subtotal = moneyPence(data.price)
    } else return json({ error: "Choose a booking first" }, 400)
    const { data: coupon, error } = await supabaseAdmin
      .from("coupons")
      .select("code,version,percent_off,starts_at,expires_at,status")
      .eq("code", code)
      .single()
    if (
      error ||
      !coupon ||
      coupon.status !== "active" ||
      Date.parse(coupon.starts_at) > Date.now() ||
      Date.parse(coupon.expires_at) <= Date.now()
    )
      return json({ error: "This coupon is not available" }, 400)
    return json({
      coupon: {
        code,
        version: coupon.version,
        percent: coupon.percent_off,
        ...discountTotal(subtotal, coupon.percent_off),
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
