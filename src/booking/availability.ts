import { getAmenity } from "./amenities";
import { addDays, inWindow, toISODate } from "./dates";
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

export function startTimes(amenity: AmenityId): number[] {
  const a = getAmenity(amenity);
  const out: number[] = [];
  for (let h = a.open; h <= a.close - a.hours; h++) out.push(h);
  return out;
}

export function isMockTaken(amenity: AmenityId, date: ISODate, hour: number): boolean {
  return hash(`${amenity}|${date}|${hour}`) % 4 === 0;
}

export function isFullyBookedByMock(amenity: AmenityId, date: ISODate): boolean {
  return hash(`full|${amenity}|${date}`) % 8 === 0;
}

function inTimeOfDay(hour: number, tod: TimeOfDay): boolean {
  if (tod === "morning") return hour < 12;
  if (tod === "afternoon") return hour >= 12 && hour < 17;
  return hour >= 17;
}

export function slotsFor(
  amenity: AmenityId,
  date: ISODate,
  bookings: Booking[],
  now: Date,
  timeOfDay?: TimeOfDay,
): { hour: number; open: boolean }[] {
  const { hours } = getAmenity(amenity);
  const isToday = date === toISODate(now);
  const fullDay = isFullyBookedByMock(amenity, date);
  const mine = bookings.filter((b) => b.amenity === amenity && b.date === date);
  return startTimes(amenity)
    .filter((h) => !(isToday && h <= now.getHours()))
    .filter((h) => !timeOfDay || inTimeOfDay(h, timeOfDay))
    .map((h) => ({
      hour: h,
      open:
        !fullDay &&
        !isMockTaken(amenity, date, h) &&
        !mine.some((b) => h < b.time + hours && b.time < h + hours),
    }));
}

export function hasOpenSlot(amenity: AmenityId, date: ISODate, bookings: Booking[], now: Date): boolean {
  return slotsFor(amenity, date, bookings, now).some((s) => s.open);
}

export function openSlotsInRange(
  amenity: AmenityId,
  range: DateRange,
  bookings: Booking[],
  now: Date,
): { date: ISODate; hours: number[] }[] {
  const today = toISODate(now);
  const out: { date: ISODate; hours: number[] }[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    if (!inWindow(d, today)) continue;
    const hours = slotsFor(amenity, d, bookings, now).filter((s) => s.open).map((s) => s.hour);
    if (hours.length > 0) out.push({ date: d, hours });
  }
  return out;
}
