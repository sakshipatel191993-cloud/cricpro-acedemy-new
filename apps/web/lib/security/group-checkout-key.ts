import { createHash, randomBytes } from 'node:crypto';

export const groupCheckoutCookie = process.env.NODE_ENV === 'production' ? '__Host-cricpro-group-checkout' : 'cricpro-group-checkout';
export const newGroupCheckoutKey = () => randomBytes(32).toString('base64url');
export const groupCheckoutCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 86400 };
export function readGroupCheckoutKey(request: Request) {
  const values = (request.headers.get('cookie') ?? '').split(';').map(v => v.trim())
    .filter(v => v.startsWith(`${groupCheckoutCookie}=`));
  if (values.length !== 1) return null;
  const key = values[0]!.slice(groupCheckoutCookie.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(key) ? key : null;
}
export function groupRequestIdentity(key: string, requestId: unknown, fields: Record<string, unknown>) {
  if (typeof requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId)) {
    throw new Error('A valid booking request ID is required');
  }
  // The public form UUID alone cannot address a booking: its private, HttpOnly
  // browser capability is needed as well. No email/IP is used as ownership proof.
  const hash = createHash('sha256').update(`group-booking:${key}:${requestId.toLowerCase()}`).digest('hex');
  const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
  const canonical = Object.keys(fields).sort().map(name => [name, fields[name] ?? null]);
  return { id, fingerprint: createHash('sha256').update(JSON.stringify(canonical)).digest('hex') };
}
