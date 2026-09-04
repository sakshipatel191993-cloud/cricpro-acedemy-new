/**
 * Operating hours for Cricpro Centre of Excellence.
 *
 * Weekdays (Mon–Fri): off-peak 12 PM – 4 PM, peak 4 PM – 11 PM.
 * Weekends (Sat–Sun): 9 AM – 9 PM, all peak.
 */
export const OPERATING_HOURS = {
  weekday: {
    label: "Monday – Friday",
    hours: "12:00 PM – 11:00 PM",
    offPeak: "12 PM – 4 PM",
    peak: "4 PM – 11 PM",
  },
  weekend: {
    label: "Saturday – Sunday",
    hours: "9:00 AM – 9:00 PM",
    peak: "9 AM – 9 PM",
  },
} as const;
