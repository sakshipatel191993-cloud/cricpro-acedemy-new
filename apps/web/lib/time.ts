/** Format a `Date` as `YYYY-MM-DD` in local time. */
export function dateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Today's date in local time, formatted as `YYYY-MM-DD` (for `min` on date inputs). */
export function todayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Whether a slot (given its `HH:MM` start time and booking date) is in the past.
 * Only applies to today's date — future dates are never past.
 */
export function isPastSlot(time: string, date: string): boolean {
  if (date !== todayISO()) return false;

  const now = new Date();
  const [hours, minutes] = time.split(":").map((n) => parseInt(n, 10));
  const slotStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
  );
  return slotStart.getTime() < now.getTime();
}
