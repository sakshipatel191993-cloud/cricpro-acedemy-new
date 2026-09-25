export const MAX_SESSION_AGE = 40;
export const AGE_GROUP_HELP = 'Use an age range up to 40 such as 11-15 years, a minimum such as 13+ (through age 40), or a single age.';

// Interpret the existing admin text field strictly and consistently.
export function sessionAgeRange(value: unknown): { min: number; max: number } | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/^ages?\s+/i, '').replace(/\s*(?:years?(?:\s+old)?|yrs?)$/i, '').trim();
  const range = text.match(/^(\d{1,3})\s*(?:[-–—]|to)\s*(\d{1,3})$/i);
  const minimum = text.match(/^(\d{1,3})\s*\+$/);
  const single = text.match(/^(\d{1,3})$/);
  if (!range && !minimum && !single) return null;
  const min = Number((range ?? minimum ?? single)![1]);
  const max = range ? Number(range[2]) : minimum ? MAX_SESSION_AGE : min;
  return min >= 1 && max <= MAX_SESSION_AGE && min <= max ? { min, max } : null;
}

export function sessionAgeOptions(group: unknown): number[] {
  const range = sessionAgeRange(group);
  return range ? Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i) : [];
}

export function isSessionAgeAllowed(age: unknown, group: unknown): boolean {
  if (typeof age !== 'number' && (typeof age !== 'string' || !/^\d+$/.test(age))) return false;
  const range = sessionAgeRange(group);
  const number = Number(age);
  return !!range && Number.isInteger(number) && number >= range.min && number <= range.max;
}
