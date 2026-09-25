import { NextRequest, NextResponse } from 'next/server';
import { previewBlockSlots } from '@/lib/services/block-bookings';
import { QuoteError } from '@/lib/booking-quote';
import { isSameOriginRequest } from '@/lib/security/admin-auth';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readJsonBody, RequestBodyError } from '@/lib/security/request-body';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  const limited = await enforceRateLimit(request, { policy: 'publicRead' });
  if (limited) return limited;
  try {
    const body = await readJsonBody(request, 16_384);
    if (typeof body.resourceId !== 'string' || !body.resourceId || typeof body.startDate !== 'string' || typeof body.endDate !== 'string' ||
      !Array.isArray(body.weekdays) || typeof body.durationMinutes !== 'number' || !Number.isInteger(body.durationMinutes)) throw new QuoteError('Invalid block availability request');
    const result = await previewBlockSlots({ resourceId: body.resourceId, startDate: body.startDate, endDate: body.endDate, weekdays: body.weekdays, durationMinutes: body.durationMinutes });
    return NextResponse.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof QuoteError ? error.message : 'Availability could not be checked' }, { status: error instanceof QuoteError || error instanceof RequestBodyError ? error.status : 503 });
  }
}
