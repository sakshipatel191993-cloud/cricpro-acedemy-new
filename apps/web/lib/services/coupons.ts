import { createHmac } from "node:crypto"
import { normalizeCoupon } from "@/lib/coupons"
import { QuoteError } from "@/lib/booking-quote"
import { getVerifiedCustomerId } from "@/lib/security/customer-auth"

export const couponsEnabled = () =>
  process.env.CHECKOUT_PROMOTIONS_ENABLED === "true"

export function couponEmailKey(email: string) {
  const secret = process.env.COUPON_IDENTITY_SECRET
  if (!secret || secret.length < 32)
    throw new QuoteError("Coupons are currently unavailable", 503)
  return createHmac("sha256", secret)
    .update(email.trim().toLowerCase())
    .digest("hex")
}

export async function couponRequest(
  request: Request,
  body: Record<string, unknown>,
  email: string
) {
  if (!body.couponCode)
    return { p_code: null, p_version: null, p_email_key: null, p_owner: null }
  if (!couponsEnabled())
    throw new QuoteError("Coupons are currently unavailable", 503)
  let code: string
  try {
    code = normalizeCoupon(body.couponCode)
  } catch {
    throw new QuoteError("Check your coupon code")
  }
  if (
    !Number.isSafeInteger(body.couponVersion) ||
    Number(body.couponVersion) < 1
  )
    throw new QuoteError("Apply the coupon again before paying")
  return {
    p_code: code,
    p_version: body.couponVersion,
    p_email_key: couponEmailKey(email),
    p_owner: await getVerifiedCustomerId(request),
  }
}
