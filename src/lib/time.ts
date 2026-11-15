// Time-zone helpers built on Intl (no extra dependency).

/** Offset of `timeZone` from UTC at `date`, in minutes (Toronto in winter: -300). */
export function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** The UTC instant of a wall-clock time in `timeZone` (handles DST changes). */
export function zonedTimeToUtc(
  parts: { year: number; month: number; day: number; hour: number; minute?: number; second?: number },
  timeZone: string,
): Date {
  const guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute ?? 0, parts.second ?? 0);
  const first = timeZoneOffsetMinutes(new Date(guess), timeZone);
  let utc = guess - first * 60000;
  const second = timeZoneOffsetMinutes(new Date(utc), timeZone);
  if (second !== first) utc = guess - second * 60000;
  return new Date(utc);
}

/** Calendar date (year, month, day) of `date` as seen in `timeZone`. */
export function zonedCalendarDate(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** ISO instant for `hour:00` on the day `daysAhead` from today, in `timeZone` (form defaults). */
export function wallClockIso(daysAhead: number, hour: number, timeZone: string, now = new Date()): string {
  const day = addCalendarDays(zonedCalendarDate(now, timeZone), daysAhead);
  return zonedTimeToUtc({ ...day, hour }, timeZone).toISOString();
}

/** Adds days to a calendar date without time-zone surprises. */
export function addCalendarDays(d: { year: number; month: number; day: number }, days: number) {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + days));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}
