/**
 * Operating hours for Cricpro Centre of Excellence.
 *
 * Weekdays (Mon–Fri): open 9 AM – 10 PM, off-peak noon – 4 PM only.
 * Weekends (Sat–Sun): 9 AM – 11 PM, peak all day.
 */
export const OPERATING_HOURS = {
  weekday: {
    label: "Monday – Friday",
    hours: "9:00 AM – 10:00 PM",
    offPeak: "12 PM – 4 PM",
    peak: "9 AM – 12 PM & 4 PM – 10 PM",
  },
  weekend: {
    label: "Saturday – Sunday",
    hours: "9:00 AM – 11:00 PM",
    peak: "9 AM – 11 PM",
  },
} as const;

/** Booking and slot APIs use their existing venue wall-clock hour convention. */
export function isPeakHour(dayOfWeek: number, hour: number) {
  return dayOfWeek === 0 || dayOfWeek === 6 ? hour >= 9 && hour < 23 : (hour >= 9 && hour < 12) || (hour >= 16 && hour < 22);
}
