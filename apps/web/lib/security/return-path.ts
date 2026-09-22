/** Accept local page paths only, never executable URLs, external hosts or API routes. */
export function safeReturnPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || value.length > 2048 || !value.startsWith('/') || value.startsWith('//')) return fallback;
  try {
    let decoded = value;
    for (let depth = 0; depth < 4; depth++) {
      if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(decoded)) return fallback;
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
      if (depth === 3) return fallback;
    }
    const url = new URL(value, 'https://local.invalid');
    if (url.origin !== 'https://local.invalid' || /^\/(api|login|signup)(\/|$)/.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
