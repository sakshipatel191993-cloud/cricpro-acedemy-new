import { dateValid, QuoteError } from "@/lib/booking-quote"

export const MAX_BLOCK_BOOKING_MONTHS = 4

export type BlockBookingSchedule = {
  startDate: string
  endDate: string
  weekdays: number[]
}

function addMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number)
  const lastDay = new Date(Date.UTC(year!, month! + months, 0)).getUTCDate()
  const result = new Date(Date.UTC(year!, month! - 1 + months, Math.min(day!, lastDay)))
  return result.toISOString().slice(0, 10)
}

/** Last selectable end date for a block beginning on `startDate`. */
export function blockBookingMaxEndDate(startDate: string): string | null {
  return dateValid(startDate) ? addMonths(startDate, MAX_BLOCK_BOOKING_MONTHS) : null
}

/** Returns weekly occurrences inclusively, constrained to a four-month window. */
export function blockBookingDates(schedule: BlockBookingSchedule): string[] {
  if (!dateValid(schedule.startDate) || !dateValid(schedule.endDate)) {
    throw new QuoteError("Choose valid start and end dates")
  }
  if (!Array.isArray(schedule.weekdays) || schedule.weekdays.length === 0 ||
    schedule.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new QuoteError("Choose at least one day of the week")
  }
  if (schedule.endDate < schedule.startDate) throw new QuoteError("End date must be after the start date")
  if (schedule.endDate > blockBookingMaxEndDate(schedule.startDate)!) {
    throw new QuoteError("Block bookings can be up to four months")
  }
  const allowed = new Set(schedule.weekdays)
  const dates: string[] = []
  for (let cursor = new Date(`${schedule.startDate}T12:00:00Z`), end = new Date(`${schedule.endDate}T12:00:00Z`); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (allowed.has(cursor.getUTCDay())) dates.push(cursor.toISOString().slice(0, 10))
  }
  if (!dates.length) throw new QuoteError("No selected weekdays fall in this date range")
  return dates
}
