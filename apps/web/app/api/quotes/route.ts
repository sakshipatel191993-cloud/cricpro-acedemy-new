import { NextRequest, NextResponse } from 'next/server';
import { storeQuote } from '@/lib/services/booking-quotes';
import { QuoteError, type QuoteInput } from '@/lib/booking-quote';
import { isSameOriginRequest } from '@/lib/security/admin-auth';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readJsonBody, RequestBodyError } from '@/lib/security/request-body';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  const limited = await enforceRateLimit(request, { policy: 'quote' });
  if (limited) return limited;
  try {
    const body = await readJsonBody(request);
    if (typeof body.serviceType !== 'string' || typeof body.bookingDate !== 'string' || typeof body.startTime !== 'string' || typeof body.durationMinutes !== 'number' || (body.resourceId !== undefined && typeof body.resourceId !== 'string')) throw new QuoteError('Invalid quote request');
    const result = await storeQuote(body as QuoteInput);
    const response = NextResponse.json({ success: true, quote: result.quote }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(result.cookie.name, result.cookie.value, result.cookie.options);
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof QuoteError ? error.message : 'Quote unavailable' }, { status: error instanceof QuoteError || error instanceof RequestBodyError ? error.status : 503 });
  }
}
