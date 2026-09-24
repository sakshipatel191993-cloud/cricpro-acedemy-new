import { londonInstant } from "@/lib/booking-quote"

export type CouponSelection = {
  code: string
  version: number
  subtotalMinor: number
  discountMinor: number
  totalMinor: number
}
export function normalizeCoupon(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a coupon code")
  const code = value.trim().toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code))
    throw new Error("Use 3–32 letters, numbers, hyphens or underscores")
  return code
}
export function fixedDiscountTotal(subtotal: number, discountMinor: number) {
  if (
    !Number.isSafeInteger(subtotal) ||
    subtotal < 2500 ||
    subtotal > 99999999 ||
    !Number.isSafeInteger(discountMinor) ||
    discountMinor < 1 ||
    discountMinor >= subtotal
  )
    throw new Error("Invalid discount")
  return {
    subtotalMinor: subtotal,
    discountMinor,
    totalMinor: subtotal - discountMinor,
  }
}
export function couponInput(body: Record<string, unknown>) {
  const code = normalizeCoupon(body.code)
  const amount = Number(body.discount_pounds), maxUses = Number(body.max_uses)
  const fixed_discount_minor = Math.round(amount * 100)
  if (!Number.isFinite(amount) || fixed_discount_minor < 1 || fixed_discount_minor > 999999)
    throw new Error("Discount amount must be between £0.01 and £9,999.99")
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000)
    throw new Error("Usage cap must be between 1 and 100,000")
  if (!["draft", "active", "disabled"].includes(String(body.status)))
    throw new Error("Invalid coupon status")
  if (typeof body.start_date !== "string" || typeof body.end_date !== "string")
    throw new Error("Choose start and end dates")
  const starts_at = londonInstant(body.start_date, "00:00")
  const expires_at = londonInstant(body.end_date, "00:00")
  if (Date.parse(expires_at) <= Date.parse(starts_at))
    throw new Error("Expiry date must be after the start date")
  if (body.status === "active" && Date.parse(expires_at) <= Date.now())
    throw new Error("An active coupon must expire in the future")
  return {
    code,
    fixed_discount_minor,
    max_uses: maxUses,
    status: String(body.status),
    starts_at,
    expires_at,
  }
}
