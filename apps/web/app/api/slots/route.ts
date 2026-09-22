import { NextRequest, NextResponse } from 'next/server';
import { authoritativeQuote, loadQuoteBookings, loadQuoteConfiguration } from '@/lib/services/booking-quotes';
import { dateValid, QuoteError, timeMinutes, type ResourceService } from '@/lib/booking-quote';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(request, { policy: 'publicRead' });
  if (limited) return limited;
  try {
    const params = request.nextUrl.searchParams;
    const type = params.get('resourceType');
    const date = params.get('date') ?? '';
    const resourceId = params.get('resourceId') || undefined;
    const durationMinutes = Number(params.get('durationMinutes') ?? '60');
    if (!['lane', 'bowling_machine', 'side_arm'].includes(type ?? '') || !dateValid(date) ||
        (params.has('days') && params.get('days') !== '1') || !Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 840) {
      throw new QuoteError('Choose one valid booking date and duration');
    }
    const serviceType: ResourceService = type === 'lane' ? 'lane_hire' : type as ResourceService;
    const configuration = await loadQuoteConfiguration();
    const reserved = await loadQuoteBookings(date);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const resources = configuration.resources.filter(r => r.active && r.type === 'lane' && (!resourceId || r.id === resourceId));
    if (resources.length > 20) throw new QuoteError('Availability configuration requires review', 503);
    const times = new Set<string>();
    for (const resource of resources) {
      for (const rule of configuration.resource_availability_rules.filter(r => r.active && r.resource_id === resource.id && r.day_of_week === weekday)) {
        if (!Number.isInteger(rule.slot_duration_mins) || rule.slot_duration_mins < 15) throw new QuoteError('Availability configuration requires review', 409);
        for (let minute = timeMinutes(rule.start_time); minute + durationMinutes <= timeMinutes(rule.end_time); minute += rule.slot_duration_mins) {
          times.add(`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);
        }
      }
    }
    const slots = [];
    for (const time of [...times].sort()) {
      const quotes = [];
      for (const resource of resources) {
        try { quotes.push(await authoritativeQuote({ serviceType, resourceId: resource.id, bookingDate: date, startTime: time, durationMinutes }, configuration, reserved)); }
        catch (error) { if (!(error instanceof QuoteError) || error.status === 503) throw error; }
      }
      slots.push({ time, availableLanes: quotes.length, price: quotes.length ? (Math.min(...quotes.map(q => q.amountPence)) / 100).toFixed(2) : '0.00', durationMinutes });
    }
    return NextResponse.json({ success: true, resourceType: type, dates: [{ date, slots }] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof QuoteError ? error.message : 'Availability is temporarily unavailable' }, { status: error instanceof QuoteError ? error.status : 503 });
  }
}
