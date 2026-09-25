import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readJsonBody, RequestBodyError } from '@/lib/security/request-body';
import { getVerifiedCustomerId } from '@/lib/security/customer-auth';
import { ensureBookingScope, guestAccessEnabled, guestCookie, guestSameOrigin, hashAccessToken, newAccessToken, readGuestToken, validAccessToken, verifiedGuestSession } from '@/lib/security/guest-access';
import { sendGuestBookingAccess } from '@/lib/services/email';

const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
const generic = () => reply({ success: true, message: 'If these details match a booking, an access link will arrive at its registered email address. Check spam or contact info@cricprocoe.com.' });
export async function POST(request: NextRequest) {
  if (!guestAccessEnabled()) return reply({ error: 'Booking access is not available yet. Please contact support.' }, 503);
  if (!guestSameOrigin(request)) return reply({ error: 'Invalid request origin' }, 403);
  try {
    const body = await readJsonBody(request, 2048);
    if (body.action === 'request') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const reference = typeof body.reference === 'string' ? body.reference.trim() : '';
      const kind = body.kind === 'group' ? 'group' : 'resource';
      const limited = await enforceRateLimit(request, { policy: 'guestRequest', subject: `${kind}:${reference}:${email}` });
      if (limited) return limited;
      if (email.length > 254 || reference.length > 80 || !email.includes('@') || !reference) return generic();
      // Only use the database recipient. Invalid references never produce data.
      if (kind === 'group' && !/^[A-Za-z0-9_-]{1,80}$/.test(reference)) return generic();
      const result = kind === 'resource'
        ? await supabaseAdmin.from('bookings').select('id,customer_email').eq('booking_reference',reference).maybeSingle()
        : await supabaseAdmin.from('group_session_bookings').select('id,parent_email').or(`booking_reference.eq.${reference},id.eq.${reference}`).maybeSingle();
      if (result.error) throw new Error('Access lookup unavailable');
      const booking = result.data as { id: string; customer_email?: string; parent_email?: string } | null;
      const recipient = booking?.customer_email ?? booking?.parent_email;
      if (!booking || recipient?.trim().toLowerCase() !== email) return generic();
      const scope = await ensureBookingScope(kind,booking.id);
      const token = newAccessToken();
      const issued = await supabaseAdmin.rpc('issue_booking_access_link', { p_scope: scope.id, p_hash: hashAccessToken(token) });
      if (issued.error) throw new Error('Access issuance unavailable');
      if (issued.data) {
        const base = new URL(process.env.NEXT_PUBLIC_APP_URL ?? '');
        if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:') throw new Error('Secure app URL required');
        const url = new URL('/booking-access',base); url.hash = token;
        // Mail failure is intentionally indistinguishable from a non-match.
        await sendGuestBookingAccess(recipient!,url.toString());
      }
      return generic();
    }
    const limited = await enforceRateLimit(request, { policy: 'guestExchange' });
    if (limited) return limited;
    if (body.action === 'exchange') {
      if (!validAccessToken(body.token)) return reply({ error: 'Link invalid or expired. Request a new link.' },400);
      const token = newAccessToken();
      const { data, error } = await supabaseAdmin.rpc('exchange_booking_access_link', { p_hash: hashAccessToken(body.token), p_session_hash: hashAccessToken(token) });
      if (error) throw new Error('Access exchange unavailable');
      if (!data) return reply({ error: 'Link invalid or expired. Request a new link.' },400);
      const response = reply({ success: true }); const cookie = guestCookie(token);
      response.cookies.set(cookie.name,cookie.value,cookie.options);
      return response;
    }
    if (body.action === 'claim') {
      const owner = await getVerifiedCustomerId(request);
      const token = readGuestToken(request);
      if (!owner || !token || body.confirm !== true) return reply({ error: 'Sign in and explicitly confirm linking after opening a fresh emailed link.' },403);
      const authToken = request.headers.get('authorization')!.slice(7);
      const { data: auth } = await supabaseAdmin.auth.getUser(authToken);
      if (!auth.user?.email_confirmed_at) return reply({ error: 'Verify your account email before linking.' },403);
      const { data, error } = await supabaseAdmin.rpc('claim_booking_access', { p_hash: hashAccessToken(token), p_owner: owner });
      if (error) throw new Error('Linking unavailable');
      return data ? reply({ success: true }) : reply({ error: 'Fresh email verification required, or this booking is already linked to another account.' },409);
    }
    if (body.action === 'logout') {
      const token = readGuestToken(request);
      if (token) {
        const { error } = await supabaseAdmin.from('booking_access_sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash',hashAccessToken(token));
        if (error) throw new Error('Session revocation unavailable');
      }
      const response = reply({ success: true }); const cookie = guestCookie('');
      response.cookies.set(cookie.name,'',{ ...cookie.options, maxAge: 0 }); return response;
    }
    return reply({ error: 'Invalid action' },400);
  } catch (error) {
    return reply({ error: 'Access temporarily unavailable. Please try again or contact support.' }, error instanceof RequestBodyError ? error.status : 503);
  }
}

// GET never consumes a link. It only resolves an already authorised browser session.
export async function GET(request: NextRequest) {
  if (!guestAccessEnabled()) return reply({ error: 'Unavailable' },503);
  const limited = await enforceRateLimit(request,{ policy: 'privateRead', subject: readGuestToken(request) ?? 'no-session' });
  if (limited) return limited;
  try {
    const session = await verifiedGuestSession(request);
    if (!session) return reply({ error: 'Request a fresh access link to view your booking.' },401);
    const { data, error } = await supabaseAdmin.from('booking_access_scopes').select('booking_id,group_booking_id').eq('id',session.scope_id).single();
    if (error) throw error;
    return reply({ kind: data.booking_id ? 'resource' : 'group', id: data.booking_id ?? data.group_booking_id });
  } catch { return reply({ error: 'Access temporarily unavailable' },503); }
}
