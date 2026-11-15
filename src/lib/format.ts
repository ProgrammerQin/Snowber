// Display formatting. Every date is formatted in the app's time zone so server
// and browser render identical text (no hydration mismatches).

import { APP_TIMEZONE } from "./config";

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export function formatMoney(cents: number): string {
  return money.format(cents / 100);
}

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, weekday: "short", month: "short", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, hour: "numeric", minute: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const asDate = (d: Date | string) => (typeof d === "string" ? new Date(d) : d);

export function formatDay(d: Date | string): string {
  return dayFmt.format(asDate(d));
}

export function formatTime(d: Date | string): string {
  return timeFmt.format(asDate(d));
}

export function formatDateTime(d: Date | string): string {
  return dateTimeFmt.format(asDate(d));
}

/** "Sat, Nov 7 · 6:00 a.m.–8:00 a.m." */
export function formatWindow(start: Date | string, end: Date | string): string {
  return `${formatDay(start)} · ${formatTime(start)}–${formatTime(end)}`;
}

export function formatMultiplier(bps: number): string {
  return `${(bps / 10000).toFixed(2).replace(/\.?0+$/, "")}×`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Value for <input type="datetime-local"> in the browser's own time zone. */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
