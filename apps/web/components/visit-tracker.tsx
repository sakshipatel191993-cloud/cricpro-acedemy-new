'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SESSION_KEY = 'cricpro_visit_session';
const IDLE_LIMIT_MS = 30 * 60 * 1000;

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith('/admin') || pathname === '/booking-access') return;

    const now = Date.now();
    let session: { id: string; lastSeen: number; lastSentDay?: string } | null = null;
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) session = JSON.parse(saved);
    } catch { /* Browser storage can be unavailable; this visit can still be counted. */ }

    if (!session || typeof session.id !== 'string' || !Number.isFinite(session.lastSeen) || now - session.lastSeen > IDLE_LIMIT_MS) {
      session = { id: crypto.randomUUID(), lastSeen: now };
    }

    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
    const part = (type: string) => parts.find(item => item.type === type)!.value;
    const day = `${part('year')}-${part('month')}-${part('day')}`;
    session.lastSeen = now;
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* No persistent storage. */ }
    if (session.lastSentDay === day) return;

    const id = session.id;
    fetch('/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id }),
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive: true,
    }).then(response => {
      if (!response.ok) return;
      try {
        const current = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
        if (current?.id === id) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, lastSentDay: day }));
      } catch { /* Another navigation can safely retry; the database deduplicates. */ }
    }).catch(() => { /* Analytics must never interrupt browsing. */ });
  }, [pathname]);

  return null;
}
