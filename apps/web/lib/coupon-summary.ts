export type CouponSnapshot = {
  code: string | null
  percent?: number
  fixedDiscountMinor?: number
  subtotalMinor: number
  discountMinor: number
  totalMinor: number
}
export function couponRows(
  snapshot?: CouponSnapshot | null
): Array<[string, string]> {
  if (!snapshot?.code) return []
  return [
    ["Subtotal", `£${(snapshot.subtotalMinor / 100).toFixed(2)}`],
    ["Coupon", snapshot.fixedDiscountMinor ? `${snapshot.code} (£${(snapshot.fixedDiscountMinor / 100).toFixed(2)} off)` : `${snapshot.code} (${snapshot.percent}% off)`],
    ["Discount", `-£${(snapshot.discountMinor / 100).toFixed(2)}`],
    ["Total", `£${(snapshot.totalMinor / 100).toFixed(2)}`],
  ]
}
