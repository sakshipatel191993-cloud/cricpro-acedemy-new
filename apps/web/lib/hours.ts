/**
 * Operating hours for Cricpro Centre of Excellence.
 *
 * Weekdays (Mon–Fri): open 9 AM – 10 PM, peak 4 PM – 10 PM.
 * Weekends (Sat–Sun): off-peak 9 AM – 11 AM, peak 11 AM – 11 PM.
 */
export const OPERATING_HOURS = {
  weekday: {
    label: "Monday – Friday",
    hours: "9:00 AM – 10:00 PM",
    offPeak: "9 AM – 4 PM",
    peak: "4 PM – 10 PM",
  },
  weekend: {
    label: "Saturday – Sunday",
    hours: "9:00 AM – 11:00 PM",
    offPeak: "9 AM – 11 AM",
    peak: "11 AM – 11 PM",
  },
} as const;

/** Booking and slot APIs use their existing venue wall-clock hour convention. */
export function isPeakHour(dayOfWeek: number, hour: number) {
  return dayOfWeek === 0 || dayOfWeek === 6 ? hour >= 11 && hour < 23 : hour >= 16 && hour < 22;
}
