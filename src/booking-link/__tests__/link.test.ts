import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { isBookingLinkPath, noteText, parseLink, stepBack, stepOf, toSearch } from "../link";
import { AMENITIES } from "@/booking/amenities";
import { hasOpenSlot, isFullyBookedByMock, isMockTaken, startTimes } from "@/booking/availability";
import { addDays } from "@/booking/dates";
import type { Booking } from "@/booking/types";

const TODAY = "2026-11-12";
const NOW = new Date(2026, 10, 12, 9, 0);

// A tennis day the mock leaves bookable, with both an open and a taken start.
const days = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i + 1));
const OPEN_DAY = days.find(
  (d) =>
    !isFullyBookedByMock("tennis", d) &&
    startTimes("tennis").some((h) => isMockTaken("tennis", d, h)) &&
    startTimes("tennis").some((h) => !isMockTaken("tennis", d, h)),
)!;
const OPEN_HOUR = startTimes("tennis").find((h) => !isMockTaken("tennis", OPEN_DAY, h))!;
const TAKEN_HOUR = startTimes("tennis").find((h) => isMockTaken("tennis", OPEN_DAY, h))!;
const FULL_DAY = Array.from({ length: 60 }, (_, i) => addDays(TODAY, i + 1)).find((d) => isFullyBookedByMock("tennis", d))!;
// An amenity open before 9 AM that still has a slot later today.
const EARLY = AMENITIES.find((a) => a.open < 9 && hasOpenSlot(a.id, TODAY, [], NOW))!;

const parse = (search: string, bookings: Booking[] = []) => parseLink(search, bookings, new Date());

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("parseLink", () => {
  test("empty link opens on amenities", () => {
    const r = parse("");
    expect(r).toEqual({ draft: {} });
    expect(stepOf(r.draft)).toBe("amenity");
  });

  test("amenity only opens on date and keeps the token", () => {
    const r = parse("?token=abc&amenity=tennis");
    expect(r).toEqual({ token: "abc", draft: { amenity: "tennis" } });
    expect(stepOf(r.draft)).toBe("date");
  });

  test("amenity and date open on time", () => {
    expect(stepOf(parse(`?amenity=tennis&date=${OPEN_DAY}`).draft)).toBe("time");
  });

  test("a full link opens on review with no note", () => {
    const r = parse(`?amenity=tennis&date=${OPEN_DAY}&time=${OPEN_HOUR}`);
    expect(stepOf(r.draft)).toBe("review");
    expect(r.note).toBeUndefined();
  });

  test("unknown amenity drops it and everything after", () => {
    expect(parse(`?amenity=squash&date=${OPEN_DAY}`)).toEqual({ draft: {}, note: { reason: "amenity" } });
  });

  test("dates outside the window are dropped", () => {
    for (const d of ["2027-03-01", "2026-11-11"]) {
      expect(parse(`?amenity=tennis&date=${d}&time=10`)).toEqual({ draft: { amenity: "tennis" }, note: { reason: "date" } });
    }
  });

  test("a fully booked day is dropped", () => {
    expect(parse(`?amenity=tennis&date=${FULL_DAY}`).note).toEqual({ reason: "date" });
  });

  test("a taken hour is dropped as taken", () => {
    expect(parse(`?amenity=tennis&date=${OPEN_DAY}&time=${TAKEN_HOUR}`)).toEqual({
      draft: { amenity: "tennis", date: OPEN_DAY },
      note: { reason: "timeTaken", time: TAKEN_HOUR },
    });
  });

  test("an hour the resident already booked is taken", () => {
    const mine: Booking = { confirmation: "RS10000", amenity: "tennis", date: OPEN_DAY, time: OPEN_HOUR, guests: 1 };
    expect(parse(`?amenity=tennis&date=${OPEN_DAY}&time=${OPEN_HOUR}`, [mine]).note).toEqual({ reason: "timeTaken", time: OPEN_HOUR });
  });

  test("an hour that isn't a start time is unavailable", () => {
    expect(parse(`?amenity=tennis&date=${OPEN_DAY}&time=22`).note).toEqual({ reason: "timeUnavailable", time: 22 });
  });

  test("past hour today is unavailable", () => {
    const hour = EARLY.open;
    expect(parse(`?amenity=${EARLY.id}&date=${TODAY}&time=${hour}`)).toEqual({
      draft: { amenity: EARLY.id, date: TODAY },
      note: { reason: "timeUnavailable", time: hour },
    });
  });

  test("orphan date and time are ignored without a note", () => {
    expect(parse(`?date=${OPEN_DAY}&time=10`)).toEqual({ draft: {} });
    expect(parse("?amenity=tennis&time=10")).toEqual({ draft: { amenity: "tennis" } });
  });

  test("malformed values", () => {
    for (const d of ["2026-02-30", "11/14"]) {
      expect(parse(`?amenity=tennis&date=${d}`).note).toEqual({ reason: "date" });
    }
    expect(parse(`?amenity=tennis&date=${OPEN_DAY}&time=`)).toEqual({ draft: { amenity: "tennis", date: OPEN_DAY } });
    expect(parse("?amenity=Tennis").draft).toEqual({ amenity: "tennis" });
  });
});

test("an unreadable or out-of-range time gets a note", () => {
  for (const t of ["10am", "10.5", "24", "25"]) {
    expect(parse(`?amenity=tennis&date=${OPEN_DAY}&time=${t}`)).toEqual({
      draft: { amenity: "tennis", date: OPEN_DAY },
      note: { reason: "timeInvalid" },
    });
  }
  expect(noteText({ reason: "timeInvalid" })).toBe("That time isn't available. Pick another time.");
});

describe("toSearch", () => {
  test("serializes in order and omits absent keys", () => {
    expect(toSearch("abc", { amenity: "tennis", date: "2026-11-14", time: 10 })).toBe("?token=abc&amenity=tennis&date=2026-11-14&time=10");
    expect(toSearch(undefined, {})).toBe("");
    expect(toSearch("t", {})).toBe("?token=t");
  });

  test("round trips through parseLink", () => {
    const drafts = [{}, { amenity: "tennis" as const }, { amenity: "tennis" as const, date: OPEN_DAY }, { amenity: "tennis" as const, date: OPEN_DAY, time: OPEN_HOUR }];
    for (const d of drafts) expect(parse(toSearch("t", d)).draft).toEqual(d);
  });
});

test("stepBack clears the last value", () => {
  expect(stepBack({ amenity: "tennis", date: OPEN_DAY, time: 10 })).toEqual({ amenity: "tennis", date: OPEN_DAY });
  expect(stepBack({ amenity: "tennis", date: OPEN_DAY })).toEqual({ amenity: "tennis" });
  expect(stepBack({ amenity: "tennis" })).toEqual({});
  expect(stepBack({})).toEqual({});
});

test("noteText copy", () => {
  expect(noteText({ reason: "amenity" })).toBe("We couldn't find that amenity. Pick one below.");
  expect(noteText({ reason: "date" })).toBe("That date isn't available. Pick another day.");
  expect(noteText({ reason: "timeTaken", time: 10 })).toBe("10:00 AM is taken that day. Pick another time.");
  expect(noteText({ reason: "timeUnavailable", time: 22 })).toBe("10:00 PM isn't available that day. Pick another time.");
});

test("route match", () => {
  expect(isBookingLinkPath("/booking-link")).toBe(true);
  expect(isBookingLinkPath("/booking-link/")).toBe(true);
  for (const p of ["/", "/booking-links", "/booking-link/x"]) expect(isBookingLinkPath(p)).toBe(false);
});
