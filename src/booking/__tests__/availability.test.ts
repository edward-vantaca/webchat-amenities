import { describe, expect, test } from "vitest";
import { AMENITIES } from "../amenities";
import { addDays } from "../dates";
import {
  hasOpenSlot,
  isFullyBookedByMock,
  isMockTaken,
  openSlotsInRange,
  slotsFor,
  startTimes,
} from "../availability";
import type { Booking } from "../types";

const now = new Date(2026, 9, 29, 9, 0);

describe("availability", () => {
  test("start times", () => {
    expect(startTimes("tennis")).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(startTimes("clubhouse")).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  test("deterministic", () =>
    expect(slotsFor("tennis", "2026-10-31", [], now)).toEqual(slotsFor("tennis", "2026-10-31", [], now)));

  test("every amenity has a fully booked day and a partly booked day in the window", () => {
    for (const a of AMENITIES) {
      const days = Array.from({ length: 61 }, (_, i) => addDays("2026-10-29", i));
      expect(days.some((d) => isFullyBookedByMock(a.id, d))).toBe(true);
      expect(
        days.some((d) => {
          const s = slotsFor(a.id, d, [], now);
          return s.some((x) => x.open) && s.some((x) => !x.open);
        }),
      ).toBe(true);
    }
  });

  test("past starts on today are omitted", () =>
    expect(slotsFor("tennis", "2026-10-29", [], now).map((s) => s.hour)[0]).toBe(10));

  test("hasOpenSlot is false late in the day", () =>
    expect(hasOpenSlot("tennis", "2026-10-29", [], new Date(2026, 9, 29, 20, 30))).toBe(false));

  test("a 4-hour booking blocks overlapping starts only", () => {
    // 2026-11-03 is mock-fully-booked for the clubhouse, so use 2026-11-07, where the mock
    // takes none of hours 9–14. The assertions then test the booking, not the mock.
    const day = "2026-11-07";
    expect(isFullyBookedByMock("clubhouse", day)).toBe(false);
    for (const h of [9, 10, 11, 12, 13, 14]) expect(isMockTaken("clubhouse", day, h)).toBe(false);
    const b: Booking = { confirmation: "RS1", amenity: "clubhouse", date: day, time: 10, guests: 2 };
    const open = (h: number) => slotsFor("clubhouse", day, [b], now).find((s) => s.hour === h)!.open;
    for (const h of [10, 11, 12, 13]) expect(open(h)).toBe(false);
    // 9 overlaps (9–13 vs 10–14); 14 does not
    expect(open(9)).toBe(false);
    expect(open(14)).toBe(true);
  });

  test("timeOfDay filter", () =>
    expect(slotsFor("tennis", "2026-11-03", [], now, "evening").map((s) => s.hour)).toEqual([17, 18, 19, 20]));

  test("openSlotsInRange skips full days and clips to window", () => {
    const r = openSlotsInRange("tennis", { from: "2026-12-20", to: "2027-01-10" }, [], now);
    expect(r.every((d) => d.date <= "2026-12-28" && d.hours.length > 0)).toBe(true);
  });
});
