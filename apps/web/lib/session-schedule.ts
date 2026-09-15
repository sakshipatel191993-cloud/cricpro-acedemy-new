/** Date/time inputs are UK wall-clock values; UTC formatting prevents browser timezone shifts. */
export function createSessionSchedule(date: string, start: string, end: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a session date');
  const day = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) throw new Error('Choose a valid session date');
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(start) || !timePattern.test(end)) throw new Error('Choose valid start and end times');
  if (end <= start) throw new Error('End time must be after start time');
  const formatTime = (value: string) => {
    const [hours, minutes] = value.split(':');
    const hour = Number(hours);
    return `${hour % 12 || 12}:${minutes} ${hour < 12 ? 'am' : 'pm'}`;
  };
  const weekday = day.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const label = `${weekday}, ${day.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}`;
  return `${label} · ${formatTime(start)}–${formatTime(end)}`;
}
