import type { DbGroupSession } from './db/schema';

export function availableSessions(sessions: DbGroupSession[], kind: 'group' | 'masterclass', coach: string) {
  return sessions.filter(session => session.active && (session.session_kind ?? 'group') === kind && (!coach || session.coach_name === coach));
}
