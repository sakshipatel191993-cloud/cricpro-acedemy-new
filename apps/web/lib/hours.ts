/**
 * Operating hours for Cricpro Centre of Excellence.
 *
 * Weekdays (Mon–Fri): open 3 PM – 11 PM, off-peak 3 PM – 5 PM only.
 * Weekends (Sat–Sun): 9 AM – 11 PM, peak all day.
 */
export const OPERATING_HOURS = {
  weekday: {
    label: "Monday – Friday",
    hours: "3:00 PM – 11:00 PM",
    offPeak: "3 PM – 5 PM",
    peak: "5 PM – 11 PM",
  },
  weekend: {
    label: "Saturday – Sunday",
    hours: "9:00 AM – 11:00 PM",
    peak: "9 AM – 11 PM",
  },
} as const;

/** Booking and slot APIs use their existing venue wall-clock hour convention. */
export function isPeakHour(dayOfWeek: number, hour: number) {
  return dayOfWeek === 0 || dayOfWeek === 6 ? hour >= 9 && hour < 23 : hour >= 17 && hour < 23;
}
