import { createHash, randomBytes } from 'node:crypto';
import { supabaseAdmin } from '@/lib/services/supabase';
import { getVerifiedCustomerId } from '@/lib/security/customer-auth';

export type BookingKind = 'resource' | 'group';
export const guestAccessEnabled = () => process.env.GUEST_BOOKING_ACCESS_ENABLED === 'true';
export const guestCookieName = process.env.NODE_ENV === 'production' ? '__Host-cricpro-booking' : 'cricpro-booking';
export const hashAccessToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newAccessToken = () => randomBytes(32).toString('base64url');
export const validAccessToken = (token: unknown): token is string => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
export function guestCookie(value: string) {
  return { name: guestCookieName, value, options: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 86400 } };
}
export function readGuestToken(request: Request) {
  const token = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${guestCookieName}=`))?.slice(guestCookieName.length + 1);
  return validAccessToken(token) ? token : null;
}
export function guestSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !!origin && origin === new URL(request.url).origin;
}
export async function ensureBookingScope(kind: BookingKind, id: string) {
  const key = kind === 'resource' ? 'booking_id' : 'group_booking_id';
  let result = await supabaseAdmin.from('booking_access_scopes').select('*').eq(key,id).maybeSingle();
  if (result.error) throw new Error('Booking access unavailable');
  if (result.data) return result.data;
  result = await supabaseAdmin.from('booking_access_scopes').insert(kind === 'resource' ? { booking_id: id } : { group_booking_id: id }).select().single();
  if (result.error?.code === '23505') result = await supabaseAdmin.from('booking_access_scopes').select('*').eq(key,id).single();
  if (result.error || !result.data) throw new Error('Booking access unavailable');
  return result.data;
}
export async function provisionBookingAccess(request: Request, kind: BookingKind, bookingId: string) {
  if (!guestAccessEnabled()) return null;
  const scope = await ensureBookingScope(kind, bookingId);
  const owner = await getVerifiedCustomerId(request);
  if (owner) {
    const { error } = await supabaseAdmin.from('booking_access_scopes').update({ owner_id: owner }).eq('id',scope.id).is('owner_id',null);
    if (error) throw new Error('Booking access unavailable');
  }
  const token = newAccessToken();
  const { error } = await supabaseAdmin.from('booking_access_sessions').insert({ token_hash: hashAccessToken(token), scope_id: scope.id, access_version: scope.access_version });
  if (error) throw new Error('Booking access unavailable');
  return { cookie: guestCookie(token) };
}
export async function verifiedGuestSession(request: Request) {
  const token = readGuestToken(request);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.rpc('touch_booking_access_session', { p_hash: hashAccessToken(token) });
  if (error) throw new Error('Booking access unavailable');
  return data?.[0] ?? null;
}
export async function accessibleScope(request: Request, kind: BookingKind, id: string) {
  const key = kind === 'resource' ? 'booking_id' : 'group_booking_id';
  const owner = await getVerifiedCustomerId(request);
  const session = await verifiedGuestSession(request);
  if (!owner && !session) return null;
  const { data, error } = await supabaseAdmin.from('booking_access_scopes').select('*').eq(key,id).maybeSingle();
  if (error) throw new Error('Booking access unavailable');
  if (!data || !((owner && owner === data.owner_id) || (session?.scope_id === data.id && session.access_version === data.access_version))) return null;
  return data;
}
