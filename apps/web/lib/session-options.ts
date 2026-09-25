import type { DbGroupSession } from './db/schema';
import { londonInstant } from './booking-quote';

export function isUpcomingSession(session: DbGroupSession, now = Date.now()) {
  if (!session.session_date || !session.end_time) return false;
  try {
    return Date.parse(londonInstant(session.session_date, session.end_time)) > now;
  } catch {
    return false;
  }
}

export function availableSessions(sessions: DbGroupSession[], kind: 'group' | 'masterclass', coach: string, now = Date.now()) {
  return sessions.filter(session => session.active && isUpcomingSession(session, now) && (session.session_kind ?? 'group') === kind && (!coach || session.coach_name === coach));
}
