import type { DateRange, ISODate } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISODate(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function weekday(s: ISODate): number {
  return fromISODate(s).getDay();
}

export function nextWeek(today: ISODate): DateRange {
  const daysToMonday = ((8 - weekday(today)) % 7) || 7;
  const from = addDays(today, daysToMonday);
  return { from, to: addDays(from, 6) };
}

export function lastBookable(today: ISODate): ISODate {
  return addDays(today, 60);
}

export function inWindow(s: ISODate, today: ISODate): boolean {
  return s >= today && s <= lastBookable(today);
}

export function formatDayLong(s: ISODate): string {
  const d = fromISODate(s);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatDayShort(s: ISODate): { weekday: string; day: string; month: string } {
  const d = fromISODate(s);
  return { weekday: WEEKDAYS[d.getDay()].slice(0, 3), day: String(d.getDate()), month: MONTHS[d.getMonth()] };
}

const meridiem = (h: number) => (h % 24 >= 12 ? "PM" : "AM");
const clock = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00`;

export function formatHour(h: number): string {
  return `${clock(h)} ${meridiem(h)}`;
}

export function formatRange(h: number, hours: number): string {
  const end = h + hours;
  if (meridiem(h) === meridiem(end)) return `${clock(h)} – ${clock(end)} ${meridiem(end)}`;
  return `${formatHour(h)} – ${formatHour(end)}`;
}
