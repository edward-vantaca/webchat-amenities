import { getAmenity } from "./amenities";
import { addDays, formatClock, formatTime, inWindow, toISODate } from "./dates";
import type { AmenityId, Booking, DateRange, ISODate, TimeOfDay } from "./types";

// FNV-1a: stable across runs, so the mock calendar never changes between reloads.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Final avalanche so the low bits (used by `% n`) are well mixed.
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return h >>> 0;
}

// Times are minutes since midnight. The calendar is kept in half-hour blocks.
export const LENGTH_STEP = 30;

export function startTimes(amenity: AmenityId): number[] {
  const a = getAmenity(amenity);
  const out: number[] = [];
  for (let m = a.open * 60; m <= a.close * 60 - LENGTH_STEP; m += LENGTH_STEP) out.push(m);
  return out;
}

// One half-hour block, starting at `minute`.
export function isMockTaken(amenity: AmenityId, date: ISODate, minute: number): boolean {
  return hash(`${amenity}|${date}|${minute}`) % 6 === 0;
}

export function isFullyBookedByMock(amenity: AmenityId, date: ISODate): boolean {
  return hash(`full|${amenity}|${date}`) % 8 === 0;
}

function inTimeOfDay(m: number, tod: TimeOfDay): boolean {
  if (tod === "morning") return m < 720;
  if (tod === "afternoon") return m >= 720 && m < 1020;
  return m >= 1020;
}

// Free means: not on a fully booked day, not taken by the mock, and not inside one of the resident's bookings.
function blockFree(amenity: AmenityId, date: ISODate, minute: number, bookings: Booking[]): boolean {
  return (
    !isFullyBookedByMock(amenity, date) &&
    !isMockTaken(amenity, date, minute) &&
    !bookings.some((b) => b.amenity === amenity && b.date === date && minute >= b.time && minute < b.time + b.minutes)
  );
}

export function slotsFor(
  amenity: AmenityId,
  date: ISODate,
  bookings: Booking[],
  now: Date,
  timeOfDay?: TimeOfDay,
): { time: number; open: boolean }[] {
  const isToday = date === toISODate(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return startTimes(amenity)
    .filter((t) => !(isToday && t <= nowMinutes))
    .filter((t) => !timeOfDay || inTimeOfDay(t, timeOfDay))
    .map((t) => ({ time: t, open: blockFree(amenity, date, t, bookings) }));
}

export type LengthReason = { kind: "booked"; at: number } | { kind: "closes"; at: number };
export type LengthOption = { minutes: number; ok: true } | { minutes: number; ok: false; reason: LengthReason };

// Every length from 30 minutes up to the limit. A length that doesn't fit says why: the first
// taken block or closing time, whichever comes first.
export function lengthsFrom(amenity: AmenityId, date: ISODate, time: number, bookings: Booking[]): LengthOption[] {
  const a = getAmenity(amenity);
  const close = a.close * 60;
  let stop: LengthReason = { kind: "closes", at: close };
  for (let m = time; m < close; m += LENGTH_STEP) {
    if (!blockFree(amenity, date, m, bookings)) {
      stop = { kind: "booked", at: m };
      break;
    }
  }
  const out: LengthOption[] = [];
  for (let minutes = LENGTH_STEP; minutes <= a.maxMinutes; minutes += LENGTH_STEP) {
    out.push(time + minutes <= stop.at ? { minutes, ok: true } : { minutes, ok: false, reason: stop });
  }
  return out;
}

export function lengthFits(amenity: AmenityId, date: ISODate, time: number, minutes: number, bookings: Booking[]): boolean {
  return lengthsFrom(amenity, date, time, bookings).some((o) => o.minutes === minutes && o.ok);
}

export function lengthReason(r: LengthReason): string {
  return r.kind === "booked" ? `booked at ${formatClock(r.at)}` : `closes at ${formatTime(r.at)}`;
}

export function hasOpenSlot(amenity: AmenityId, date: ISODate, bookings: Booking[], now: Date): boolean {
  return slotsFor(amenity, date, bookings, now).some((s) => s.open);
}

export function openSlotsInRange(
  amenity: AmenityId,
  range: DateRange,
  bookings: Booking[],
  now: Date,
): { date: ISODate; times: number[] }[] {
  const today = toISODate(now);
  const out: { date: ISODate; times: number[] }[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    if (!inWindow(d, today)) continue;
    const times = slotsFor(amenity, d, bookings, now).filter((s) => s.open).map((s) => s.time);
    if (times.length > 0) out.push({ date: d, times });
  }
  return out;
}
