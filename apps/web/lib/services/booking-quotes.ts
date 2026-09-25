import { createHash, randomBytes } from 'node:crypto';
import { supabaseAdmin } from './supabase';
import { quoteResource, QuoteError, type QuoteInput, type QuoteConfig, type Resource } from '../booking-quote';

export function requireQuoteRollout() {
  if (process.env.AUTHORITATIVE_QUOTES_ENABLED !== 'true' || process.env.BOOKING_TIMEZONE_VERIFIED !== 'true' || process.env.BOOKING_PRICE_UNITS !== 'hourly') {
    throw new QuoteError('Online booking is temporarily unavailable. Please contact the centre.', 503);
  }
}
export const quoteCookieName = 'cricpro_quote';
export const quoteTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function quoteCapability(request: Request, id: string, cookieName = quoteCookieName): string | null {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const match = (request.headers.get('cookie') ?? '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${cookieName}=`));
  if (match.length !== 1) return null;
  const value = match[0]!.slice(cookieName.length + 1);
  if (!value.startsWith(`${id}.`)) return null;
  const token = value.slice(id.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? quoteTokenHash(token) : null;
}
async function rows(query: any) {
  const { data, error, count } = await query;
  if (error) throw new QuoteError('Availability could not be verified. Please try again later.', 503);
  if (typeof count === 'number' && count > (data?.length ?? 0)) throw new QuoteError('Availability configuration exceeds the supported query size', 503);
  return data ?? [];
}
export async function loadQuoteConfiguration() {
  requireQuoteRollout();
  const tables = ['resources', 'resource_availability_rules', 'pricing_rules', 'slot_overrides', 'blocked_slots'] as const;
  const values = await Promise.all(tables.map(table => rows(supabaseAdmin.from(table).select('*', { count: 'exact' }).order('id').limit(5001))));
  if (values.some(value => value.length > 5000)) throw new QuoteError('Availability configuration requires review', 503);
  return Object.fromEntries(tables.map((table, i) => [table, values[i]])) as Record<typeof tables[number], any[]>;
}
export async function loadQuoteBookings(date: string, endDate = date) {
  const midnight = Date.parse(`${date}T00:00:00Z`);
  const endMidnight = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(midnight) || !Number.isFinite(endMidnight) || endMidnight < midnight) throw new QuoteError('Choose a valid date');
  const existing = await rows(supabaseAdmin.from('bookings').select('id,resource_id,pricing_resource_id,start_at,end_at,buffer_mins', { count: 'exact' }).in('status', ['confirmed', 'pending_payment'])
    .gte('end_at', new Date(midnight - 2 * 86400000).toISOString()).lte('start_at', new Date(endMidnight + 2 * 86400000).toISOString()).limit(5001));
  if (existing.length > 5000) throw new QuoteError('Availability could not be verified', 503);
  return existing;
}
export async function authoritativeQuote(input: QuoteInput, snapshot?: Awaited<ReturnType<typeof loadQuoteConfiguration>>, reserved?: any[]) {
  const configuration = snapshot ?? await loadQuoteConfiguration();
  const active = configuration.resources.filter((r: Resource) => r.active);
  const lanes = active.filter((r: Resource) => r.type === 'lane' && (!input.resourceId || r.id === input.resourceId));
  if (!lanes.length) throw new QuoteError('Choose an active lane', 409);
  const serviceResources = input.serviceType === 'lane_hire' ? null : active.filter((r: Resource) => r.type === input.serviceType);
  if (serviceResources && serviceResources.length !== 1) throw new QuoteError('Service configuration requires review', 409);
  const existing = reserved ?? await loadQuoteBookings(input.bookingDate);
  const config = (resource: Resource): QuoteConfig => ({
    resource,
    rules: configuration.resource_availability_rules.filter(r => r.resource_id === resource.id),
    prices: configuration.pricing_rules.filter(r => r.resource_id === resource.id),
    overrides: configuration.slot_overrides.filter(r => r.resource_id === resource.id),
    blocks: configuration.blocked_slots.filter(r => r.resource_id === resource.id),
    bookings: existing.filter((r: any) => r.resource_id === resource.id || r.pricing_resource_id === resource.id),
  });
  let unavailable: unknown;
  for (const lane of lanes.sort((a, b) => a.id.localeCompare(b.id))) {
    try {
      const laneConfig = config(lane);
      const laneQuote = quoteResource(input, laneConfig);
      const service = serviceResources?.[0] ?? lane;
      const serviceConfig = config(service);
      // Every bookable service occupies one of the four physical lanes. The
      // lane is therefore the sole source of opening hours and slot cadence;
      // a service resource contributes pricing and equipment constraints.
      const quote = service.id === lane.id ? laneQuote : quoteResource(input, {
        ...serviceConfig,
        rules: laneConfig.rules,
      });
      return { ...quote, resourceId: lane.id as string, resourceName: lane.name as string, pricingResourceId: service.id as string, bufferMinutes: Math.max(quote.bufferMinutes, laneQuote.bufferMinutes), configuration };
    } catch (error) { unavailable = error; }
  }
  throw unavailable ?? new QuoteError('Time is unavailable', 409);
}
export async function storeQuote(input: QuoteInput) {
  const quote = await authoritativeQuote(input);
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
  const { configuration, ...publicQuote } = quote;
  const { data, error } = await supabaseAdmin.from('booking_quotes').insert({
    capability_hash: quoteTokenHash(token), input: { ...input, resourceId: quote.resourceId }, snapshot: publicQuote,
    configuration, amount_pence: quote.amountPence, expires_at: expiresAt,
  }).select('id').single();
  if (error || !data) throw new QuoteError('Quote could not be saved. Please try again.', 503);
  return { quote: { ...publicQuote, id: data.id, expiresAt }, cookie: { name: quoteCookieName, value: `${data.id}.${token}`, options: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 1860 } } };
}
