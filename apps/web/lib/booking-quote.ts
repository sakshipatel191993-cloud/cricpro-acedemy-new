/** Pure authoritative quote engine. All date/time inputs are Europe/London wall time. */
export type ResourceService = 'lane_hire' | 'bowling_machine' | 'side_arm';
export type QuoteInput = { serviceType: ResourceService; resourceId?: string; bookingDate: string; startTime: string; durationMinutes: number };
export type Availability = { id: string; day_of_week: number; start_time: string; end_time: string; slot_duration_mins: number; buffer_mins: number; active: boolean };
export type Pricing = { id: string; start_time: string; end_time: string; days: number[]; price: string; priority: number; active: boolean };
export type Interval = { start_at: string; end_at: string; buffer_mins?: number };
export type Override = Interval & { id: string; custom_price: string | null; blocked: boolean };
export type Resource = { id: string; name: string; type: string; active: boolean; capacity?: number; peak_price?: string; offpeak_price?: string };
export type QuoteConfig = { resource: Resource; rules: Availability[]; prices: Pricing[]; overrides: Override[]; blocks: Interval[]; bookings: Interval[] };
export class QuoteError extends Error { constructor(message: string, public status = 400) { super(message); } }

const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function wallParts(ms: number) {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(ms)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function dateValid(date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
export function timeMinutes(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(time)) throw new QuoteError('Invalid configured time');
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}
export function londonInstant(date: string, time: string): string {
  if (!dateValid(date)) throw new QuoteError('Choose a valid date');
  timeMinutes(time);
  const wall = `${date}T${time.slice(0, 5)}`;
  const guess = Date.parse(`${wall}:00Z`);
  // London has only GMT/BST offsets for the supported modern booking horizon.
  const matches = [guess, guess - 3600000].filter(ms => wallParts(ms) === wall);
  if (matches.length !== 1) throw new QuoteError('This local time is ambiguous or does not exist');
  return new Date(matches[0]!).toISOString();
}
export function moneyPence(value: string | number | undefined): number {
  const text = String(value ?? '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new QuoteError('A valid configured price is required', 409);
  const [whole, fraction = ''] = text.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new QuoteError('A valid configured price is required', 409);
  return amount;
}
function overlaps(start: number, end: number, interval: Interval, buffer = 0) {
  const a = Date.parse(interval.start_at), b = Date.parse(interval.end_at);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) throw new QuoteError('Invalid configured interval', 409);
  const gap = Math.max(buffer, interval.buffer_mins ?? 0) * 60000;
  return start < b + gap && end + gap > a;
}
export function quoteResource(input: QuoteInput, config: QuoteConfig, now = Date.now()) {
  if (!['lane_hire', 'bowling_machine', 'side_arm'].includes(input.serviceType)) throw new QuoteError('Unsupported service');
  if (!config.resource.active) throw new QuoteError('Resource unavailable', 409);
  if (config.resource.type !== 'lane' && config.resource.type !== input.serviceType) throw new QuoteError('Resource does not support this service', 409);
  if (!dateValid(input.bookingDate)) throw new QuoteError('Choose a valid date');
  const startMinute = timeMinutes(input.startTime);
  const duration = input.durationMinutes;
  if (!Number.isInteger(duration) || duration <= 0 || duration > 14 * 60) throw new QuoteError('Invalid duration');
  const endMinute = startMinute + duration;
  if (endMinute >= 1440) throw new QuoteError('Booking must finish on the selected day');
  const startAt = londonInstant(input.bookingDate, input.startTime);
  const endTime = `${String(Math.floor(endMinute / 60)).padStart(2, '0')}:${String(endMinute % 60).padStart(2, '0')}`;
  const endAt = londonInstant(input.bookingDate, endTime);
  const start = Date.parse(startAt), end = Date.parse(endAt);
  if (start <= now || start > now + 366 * 86400000) throw new QuoteError('Choose a future date within one year');
  const weekday = new Date(`${input.bookingDate}T12:00:00Z`).getUTCDay();
  const opening = weekday === 0 || weekday === 6 ? 9 * 60 : 15 * 60;
  if (startMinute < opening || endMinute > 23 * 60) throw new QuoteError('Booking is outside venue opening hours', 409);
  const rules = config.rules.filter(r => r.active && r.day_of_week === weekday && timeMinutes(r.start_time) <= startMinute && timeMinutes(r.end_time) >= endMinute);
  if (rules.length !== 1) throw new QuoteError('Availability configuration is missing or ambiguous', 409);
  const rule = rules[0]!;
  if (!Number.isInteger(rule.slot_duration_mins) || rule.slot_duration_mins <= 0 || !Number.isInteger(rule.buffer_mins) || rule.buffer_mins < 0 || rule.buffer_mins > 1440) throw new QuoteError('Invalid availability configuration', 409);
  if ((startMinute - timeMinutes(rule.start_time)) % rule.slot_duration_mins || duration % rule.slot_duration_mins) throw new QuoteError('Choose a supported start time and duration');
  if (config.blocks.some(b => overlaps(start, end, b)) || config.overrides.some(o => o.blocked && overlaps(start, end, o)) || config.bookings.some(b => overlaps(start, end, b, rule.buffer_mins))) throw new QuoteError('Time is unavailable', 409);
  const breakdown: { startTime: string; endTime: string; hourlyPence: number; minutes: number; source: string }[] = [];
  let numerator = 0;
  for (let minute = startMinute; minute < endMinute; minute++) {
    const instant = start + (minute - startMinute) * 60000;
    const overrides = config.overrides.filter(o => !o.blocked && o.custom_price !== null && overlaps(instant, instant + 60000, o));
    if (overrides.length > 1) throw new QuoteError('Overlapping price overrides require review', 409);
    let hourlyPence: number, source: string;
    if (overrides[0]) { hourlyPence = moneyPence(overrides[0].custom_price!); source = `override:${overrides[0].id}`; }
    else {
      const prices = config.prices.filter(p => p.active && p.days.includes(weekday) && timeMinutes(p.start_time) <= minute && timeMinutes(p.end_time) > minute).sort((a, b) => a.priority - b.priority);
      if (prices.length > 1 && prices[0]!.priority === prices[1]!.priority) throw new QuoteError('Conflicting pricing rules require review', 409);
      if (prices[0]) { hourlyPence = moneyPence(prices[0].price); source = `rule:${prices[0].id}`; }
      else {
        const offPeak = weekday >= 1 && weekday <= 5 && minute >= 15 * 60 && minute < 17 * 60;
        hourlyPence = moneyPence(offPeak ? config.resource.offpeak_price : config.resource.peak_price);
        source = `resource:${config.resource.id}:${offPeak ? 'offpeak' : 'peak'}`;
      }
    }
    numerator += hourlyPence;
    if (!Number.isSafeInteger(numerator)) throw new QuoteError('Configured price exceeds supported payment limits', 409);
    const label = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const last = breakdown.at(-1);
    if (last && last.hourlyPence === hourlyPence && last.source === source) { last.minutes++; last.endTime = label(minute + 1); }
    else breakdown.push({ startTime: label(minute), endTime: label(minute + 1), hourlyPence, minutes: 1, source });
  }
  // Hourly rates are prorated by minute; round once, to the nearest penny.
  const amountPence = Math.round(numerator / 60);
  if (amountPence < 30 || amountPence > 99_999_999) throw new QuoteError('Configured price exceeds supported payment limits', 409);
  return { version: 1, ...input, startAt, endAt, bufferMinutes: rule.buffer_mins, amountPence, currency: 'gbp', breakdown };
}
