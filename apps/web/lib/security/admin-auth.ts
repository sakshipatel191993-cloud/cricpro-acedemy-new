// Server/middleware only. Never import this module into client components.
export const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function adminAuthConfigured(): boolean {
  const password = process.env.ADMIN_PASSWORD ?? '';
  const secret = process.env.ADMIN_SECRET ?? '';
  // Honor existing configured credentials. Policy changes must not silently
  // lock out the owner; credential rotation requires their explicit permission.
  return password.length > 0 && secret.length > 0;
}

async function signingKey(usage: KeyUsage[]) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(process.env.ADMIN_SECRET!),
    { name: 'HMAC', hash: 'SHA-256' }, false, usage);
}

export async function verifyAdminPassword(password: unknown): Promise<boolean> {
  if (!adminAuthConfigured() || typeof password !== 'string' || password.length > 1024) return false;
  const key = await signingKey(['sign', 'verify']);
  const encoder = new TextEncoder();
  const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(process.env.ADMIN_PASSWORD!));
  return crypto.subtle.verify('HMAC', key, expected, encoder.encode(password));
}

export async function createAdminSession(now = Date.now()): Promise<string> {
  if (!adminAuthConfigured()) throw new Error('Admin authentication is not configured');
  const timestamp = String(now);
  const signature = await crypto.subtle.sign('HMAC', await signingKey(['sign']), new TextEncoder().encode(timestamp));
  return `${timestamp}.${Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('')}`;
}

export async function verifyAdminSession(token: string, now = Date.now()): Promise<boolean> {
  if (!adminAuthConfigured() || !/^\d{13}\.[a-f0-9]{64}$/.test(token)) return false;
  const [timestamp, signature] = token.split('.') as [string, string];
  const issuedAt = Number(timestamp);
  if (issuedAt > now || now - issuedAt >= ADMIN_SESSION_TTL_MS) return false;
  try {
    const bytes = new Uint8Array(signature.match(/../g)!.map(hex => parseInt(hex, 16)));
    return await crypto.subtle.verify('HMAC', await signingKey(['verify']), bytes, new TextEncoder().encode(timestamp));
  } catch { return false; }
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  const cookies = (request.headers.get('cookie') ?? '').split(';').map(cookie => cookie.trim());
  const sessions = cookies.filter(cookie => cookie.startsWith('admin_session='));
  if (sessions.length !== 1) return false;
  return verifyAdminSession(sessions[0]!.slice('admin_session='.length));
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

export async function isAdminMutationRequest(request: Request): Promise<boolean> {
  return isSameOriginRequest(request) && await isAdminRequest(request);
}
