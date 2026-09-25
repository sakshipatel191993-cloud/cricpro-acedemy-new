import { NextRequest, NextResponse } from "next/server"
import { storeBlockQuote } from "@/lib/services/block-bookings"
import { QuoteError } from "@/lib/booking-quote"
import { isSameOriginRequest } from "@/lib/security/admin-auth"
import { enforceRateLimit } from "@/lib/security/rate-limit"
import { readJsonBody, RequestBodyError } from "@/lib/security/request-body"

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  const limited = await enforceRateLimit(request, { policy: "quote" })
  if (limited) return limited
  try {
    const body = await readJsonBody(request, 16_384)
    if (typeof body.resourceId !== "string" || !body.resourceId || typeof body.startTime !== "string" || typeof body.durationMinutes !== "number" || !Number.isInteger(body.durationMinutes) ||
      typeof body.startDate !== "string" || typeof body.endDate !== "string" || !Array.isArray(body.weekdays)) throw new QuoteError("Invalid block booking request")
    const result = await storeBlockQuote({ resourceId: body.resourceId, startTime: body.startTime, durationMinutes: body.durationMinutes, startDate: body.startDate, endDate: body.endDate, weekdays: body.weekdays })
    const response = NextResponse.json({ success: true, quote: result.quote }, { headers: { "Cache-Control": "no-store" } })
    response.cookies.set(result.cookie.name, result.cookie.value, result.cookie.options)
    return response
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof QuoteError ? error.message : "Block booking availability could not be checked" }, { status: error instanceof QuoteError || error instanceof RequestBodyError ? error.status : 503 })
  }
}
