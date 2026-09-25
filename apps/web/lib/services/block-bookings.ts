import { randomBytes, randomUUID } from 'node:crypto';
import { authoritativeQuote, loadQuoteConfiguration, loadQuoteBookings, quoteTokenHash } from './booking-quotes';
import { supabaseAdmin } from './supabase';
import { getStripe } from './stripe';
import { verifiedPayment } from './booking-documents';
import { blockBookingDates, type BlockBookingSchedule } from '../block-booking';
import { QuoteError, timeMinutes } from '../booking-quote';

export const blockQuoteCookieName = 'cricpro_block_quote';

type BlockQuoteInput = BlockBookingSchedule & { resourceId: string; startTime: string; durationMinutes: number };

const weekendHourlyPence = 2_500;
const sixWeekWeekendHourlyPence = 2_250;

function isAtLeastSixWeeks(schedule: BlockBookingSchedule) {
  const start = new Date(`${schedule.startDate}T12:00:00Z`);
  const end = new Date(`${schedule.endDate}T12:00:00Z`);
  return end.getTime() - start.getTime() >= 42 * 24 * 60 * 60 * 1000;
}

function isWeekend(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/** Applies the published six-week weekend rate without trusting client prices. */
function applySixWeekWeekendRate<T extends { bookingDate: string; amountPence: number; breakdown?: Array<{ hourlyPence: number; minutes: number }> }>(schedule: BlockBookingSchedule, quote: T) {
  if (!isAtLeastSixWeeks(schedule) || !isWeekend(quote.bookingDate) || !quote.breakdown?.length) return quote;
  const standardAmountPence = quote.amountPence;
  const breakdown = quote.breakdown.map(part => part.hourlyPence === weekendHourlyPence ? { ...part, hourlyPence: sixWeekWeekendHourlyPence } : part);
  const amountPence = Math.round(breakdown.reduce((total, part) => total + part.hourlyPence * part.minutes, 0) / 60);
  const discountPence = standardAmountPence - amountPence;
  return discountPence > 0 ? { ...quote, amountPence, breakdown, standardAmountPence, discountPence } : quote;
}

async function quoteBlockOccurrences(input: BlockQuoteInput) {
  const dates = blockBookingDates(input);
  const [configuration, reserved] = await Promise.all([loadQuoteConfiguration(), loadQuoteBookings(dates[0]!, dates[dates.length - 1]!)]);
  const occurrences: Array<{ bookingDate: string; amountPence: number; resourceName: string; standardAmountPence?: number; [key: string]: unknown }> = [];
  for (const bookingDate of dates) {
    const { configuration: _, ...quote } = await authoritativeQuote({ serviceType: 'lane_hire', resourceId: input.resourceId, bookingDate, startTime: input.startTime, durationMinutes: input.durationMinutes }, configuration, reserved);
    void _; // Keep the large server-only configuration out of the public snapshot.
    occurrences.push(applySixWeekWeekendRate(input, quote));
  }
  return { dates, configuration, occurrences };
}

/** Available start times common to every date in a block, with exact block totals. */
export async function previewBlockSlots(input: Omit<BlockQuoteInput, 'startTime'>) {
  const dates = blockBookingDates(input);
  const [configuration, reserved] = await Promise.all([loadQuoteConfiguration(), loadQuoteBookings(dates[0]!, dates[dates.length - 1]!)]);
  const resource = configuration.resources.find(r => r.id === input.resourceId && r.active && r.type === 'lane');
  if (!resource) throw new QuoteError('Choose an active lane', 409);
  const weekday = new Date(`${dates[0]}T12:00:00Z`).getUTCDay();
  const candidates = new Set<string>();
  for (const rule of configuration.resource_availability_rules.filter(r => r.resource_id === resource.id && r.active && r.day_of_week === weekday)) {
    const start = timeMinutes(rule.start_time), end = timeMinutes(rule.end_time);
    if (!Number.isInteger(rule.slot_duration_mins) || rule.slot_duration_mins < 15) throw new QuoteError('Availability configuration requires review', 409);
    for (let minute = start; minute + input.durationMinutes <= end; minute += rule.slot_duration_mins) {
      candidates.add(`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);
    }
  }
  const slots = [];
  for (const startTime of [...candidates].sort()) {
    try {
      const occurrences: Array<{ bookingDate: string; amountPence: number; standardAmountPence?: number; [key: string]: unknown }> = [];
      for (const bookingDate of dates) {
        const { configuration: _, ...quote } = await authoritativeQuote({ serviceType: 'lane_hire', resourceId: input.resourceId, bookingDate, startTime, durationMinutes: input.durationMinutes }, configuration, reserved);
        void _;
        occurrences.push(applySixWeekWeekendRate(input, quote));
      }
      const amountPence = occurrences.reduce((sum, quote) => sum + quote.amountPence, 0);
      const standardAmountPence = occurrences.reduce((sum, quote) => sum + (quote.standardAmountPence ?? quote.amountPence), 0);
      const sessionAmounts = occurrences.map(quote => quote.amountPence);
      slots.push({
        time: startTime,
        amountPence,
        standardAmountPence,
        discountPence: standardAmountPence - amountPence,
        occurrences: occurrences.length,
        minSessionAmountPence: Math.min(...sessionAmounts),
        maxSessionAmountPence: Math.max(...sessionAmounts),
      });
    } catch (error) {
      if (!(error instanceof QuoteError) || error.status === 503) throw error;
      // Omit a time that is unavailable on any repeated date.
    }
  }
  return { dates, slots };
}

/** Validates every occurrence and calculates the total without creating a quote. */
export async function previewBlockQuote(input: BlockQuoteInput) {
  const { dates, occurrences } = await quoteBlockOccurrences(input);
  const amountPence = occurrences.reduce((sum, occurrence) => sum + occurrence.amountPence, 0);
  const standardAmountPence = occurrences.reduce((sum, occurrence) => sum + (occurrence.standardAmountPence ?? occurrence.amountPence), 0);
  return { dates, occurrences, amountPence, standardAmountPence, discountPence: standardAmountPence - amountPence };
}

export async function storeBlockQuote(input: BlockBookingSchedule & { resourceId: string; startTime: string; durationMinutes: number }) {
  const { dates, configuration, occurrences } = await quoteBlockOccurrences(input);
  const amountPence = occurrences.reduce((sum, quote) => sum + quote.amountPence, 0);
  if (!Number.isSafeInteger(amountPence) || amountPence < 30 || amountPence > 99999999) throw new QuoteError('Block total is outside the supported payment range');
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
  const standardAmountPence = occurrences.reduce((sum, occurrence) => sum + (occurrence.standardAmountPence ?? occurrence.amountPence), 0);
  const quote = { id: randomUUID(), expiresAt, amountPence, standardAmountPence, discountPence: standardAmountPence - amountPence, dates, occurrences, resourceName: occurrences[0]!.resourceName };
  const { error } = await supabaseAdmin.from('block_booking_quotes').insert({ id: quote.id, capability_hash: quoteTokenHash(token), input, snapshot: quote, configuration, amount_pence: amountPence, expires_at: expiresAt });
  if (error) throw new QuoteError('Block quote could not be saved', 503);
  return { quote, cookie: { name: blockQuoteCookieName, value: `${quote.id}.${token}`, options: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 1860 } } };
}

export async function confirmBlockBooking(bookingId: string, sessionId: string) {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  const payment = verifiedPayment(session);
  if (session.mode !== 'payment' || session.metadata?.booking_kind !== 'block' || session.metadata?.booking_id !== bookingId) throw new Error('Block payment mismatch');
  const { data, error } = await supabaseAdmin.rpc('confirm_block_booking', { p_booking_id: bookingId, p_session_id: sessionId, p_payment: payment });
  if (error) throw error;
  return data === true;
}

export async function expireBlockBooking(bookingId: string, sessionId: string) {
  const { error } = await supabaseAdmin.rpc('expire_block_booking', { p_booking_id: bookingId, p_session_id: sessionId });
  if (error) throw error;
}
