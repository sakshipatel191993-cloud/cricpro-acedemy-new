import { createHmac, randomUUID, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';

type Rule = { limit: number; windowMs: number };
const minute = 60_000;
export const RATE_POLICIES = {
  adminLogin: { ip: { limit: 5, windowMs: 15 * minute } },
  booking: { ip: { limit: 10, windowMs: minute }, subject: { limit: 5, windowMs: minute } },
  inquiry: { ip: { limit: 5, windowMs: 10 * minute }, subject: { limit: 3, windowMs: 60 * minute } },
  guestRequest: { ip: { limit: 5, windowMs: 15 * minute }, subject: { limit: 3, windowMs: 60 * minute }, spacing: true },
  guestExchange: { ip: { limit: 10, windowMs: 15 * minute } },
  privateRead: { ip: { limit: 180, windowMs: minute }, subject: { limit: 60, windowMs: minute }, readOnly: true },
  publicRead: { ip: { limit: 60, windowMs: minute }, readOnly: true },
  quote: { ip: { limit: 60, windowMs: minute }, readOnly: true },
} satisfies Record<string, { ip: Rule; subject?: Rule; spacing?: boolean; readOnly?: boolean }>;
export type RatePolicy = keyof typeof RATE_POLICIES;
type Bucket = Rule & { key: string };

// Redis server time and one atomic script cover all limits, including resend spacing.
// Keys share a hash tag so clustered stores can execute the script atomically.
export const RATE_LIMIT_SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local retry = 0
for i, key in ipairs(KEYS) do
  local limit = tonumber(ARGV[2 * i])
  local window = tonumber(ARGV[2 * i + 1])
  redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
  if redis.call('ZCARD', key) >= limit then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    retry = math.max(retry, tonumber(oldest[2]) + window - now)
  end
end
if retry > 0 then return {0, retry} end
for i, key in ipairs(KEYS) do
  redis.call('ZADD', key, now, ARGV[1])
  redis.call('PEXPIRE', key, tonumber(ARGV[2 * i + 1]))
end
return {1, 0}
`;

const localKeySecret = randomBytes(32).toString('hex');
const localBuckets = new Map<string, { times: number[]; expiresAt: number }>();
let lastHealthWarning = 0;

export function trustedClientIp(request: Request): string {
  // Vercel overwrites this header. No arbitrary forwarded header is trusted on
  // standalone deployments; their traffic conservatively shares an unknown bucket.
  const raw = process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for') : null;
  if (!raw || raw.length > 64 || !isIP(raw.trim())) return 'unknown';
  const value = raw.trim().toLowerCase();
  // Canonicalise equivalent IPv6 spellings to prevent rotating textual identities.
  return isIP(value) === 6 ? new URL(`http://[${value}]/`).hostname : value;
}

function bucketsFor(request: Request, policy: RatePolicy, subject?: string): Bucket[] {
  const settings: { ip: Rule; subject?: Rule; spacing?: boolean } = RATE_POLICIES[policy];
  const secret = process.env.RATE_LIMIT_KEY_SECRET;
  if ((!secret || secret.length < 32) && process.env.NODE_ENV === 'production') throw new Error('Limiter key unavailable');
  const namespace = process.env.RATE_LIMIT_NAMESPACE ?? (process.env.NODE_ENV === 'production' ? '' : 'local');
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(namespace)) throw new Error('Limiter namespace unavailable');
  const key = (kind: string, value: string) => `cricpro:{${namespace}}:${policy}:${kind}:${createHmac('sha256', secret || localKeySecret).update(value).digest('hex')}`;
  const buckets: Bucket[] = [{ ...settings.ip, key: key('ip', trustedClientIp(request)) }];
  if (subject !== undefined) {
    if (!subject || subject.length > 512) throw new Error('Invalid limiter subject');
    if (settings.subject) buckets.push({ ...settings.subject, key: key('subject', subject) });
    if (settings.spacing) buckets.push({ limit: 1, windowMs: minute, key: key('spacing', subject) });
  }
  return buckets;
}

function localLimit(buckets: Bucket[]): number {
  const now = Date.now();
  for (const [key, value] of localBuckets) if (value.expiresAt <= now) localBuckets.delete(key);
  // Never evict live entries to make room: that would let an attacker reset limits.
  if (localBuckets.size + buckets.filter(b => !localBuckets.has(b.key)).length > 10_000) return minute;
  let retry = 0;
  for (const bucket of buckets) {
    const entry = localBuckets.get(bucket.key);
    if (entry) {
      entry.times = entry.times.filter(t => t > now - bucket.windowMs);
      if (entry.times.length >= bucket.limit) retry = Math.max(retry, entry.times[0]! + bucket.windowMs - now);
    }
  }
  if (retry) return retry;
  for (const bucket of buckets) {
    const entry = localBuckets.get(bucket.key) ?? { times: [], expiresAt: now + bucket.windowMs };
    entry.times.push(now);
    entry.expiresAt = now + bucket.windowMs;
    localBuckets.set(bucket.key, entry);
  }
  return 0;
}

function rejection(status: 429 | 503, retryMs: number): Response {
  return Response.json({ success: false, error: status === 429 ? 'Too many requests. Please try again shortly.' : 'This service is temporarily unavailable. Please try again shortly.' }, {
    status, headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryMs / 1000))), 'Cache-Control': 'no-store' },
  });
}

export async function enforceRateLimit(request: Request, options: { policy: RatePolicy; subject?: string }): Promise<Response | null> {
  let buckets: Bucket[];
  try { buckets = bucketsFor(request, options.policy, options.subject); }
  catch { return rejection(503, minute); }
  try {
    // Vercel's managed Upstash integration exposes KV_REST_*; direct Upstash
    // projects use UPSTASH_REDIS_REST_*. Support either without exposing either
    // credential to the browser.
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
    if (!url || !token) throw new Error('Limiter store unavailable');
    const endpoint = new URL(url);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Invalid limiter endpoint');
    const result = await fetch(endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['EVAL', RATE_LIMIT_SCRIPT, buckets.length, ...buckets.map(b => b.key), randomUUID(), ...buckets.flatMap(b => [b.limit, b.windowMs])]),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(2000),
    });
    if (!result.ok) throw new Error('Limiter request failed');
    const data = await result.json();
    if (data.error || !Array.isArray(data.result) || data.result.length !== 2 || ![0, 1].includes(data.result[0]) || !Number.isFinite(data.result[1]) || data.result[1] < 0) throw new Error('Invalid limiter response');
    return data.result[0] === 1 ? null : rejection(429, data.result[1]);
  } catch {
    if (Date.now() - lastHealthWarning > minute) {
      console.warn('security.rate_limit_store_unavailable');
      lastHealthWarning = Date.now();
    }
    const readOnly = 'readOnly' in RATE_POLICIES[options.policy];
    const localDevelopment = process.env.NODE_ENV !== 'production' && process.env.RATE_LIMIT_LOCAL_FALLBACK === 'true';
    if (!readOnly && !localDevelopment) return rejection(503, minute);
    const retry = localLimit(buckets);
    return retry ? rejection(429, retry) : null;
  }
}
