import { describe, expect, test } from "vitest";
import { AMENITIES } from "../amenities";
import { addDays } from "../dates";
import {
  hasOpenSlot,
  isFullyBookedByMock,
  isMockTaken,
  lengthFits,
  lengthReason,
  lengthsFrom,
  openSlotsInRange,
  slotsFor,
  startTimes,
} from "../availability";
import type { AmenityId, Booking, ISODate } from "../types";

const now = new Date(2026, 9, 29, 9, 0);
const window = Array.from({ length: 60 }, (_, i) => addDays("2026-10-30", i));
const free = (a: AmenityId, d: ISODate, ...ms: number[]) =>
  !isFullyBookedByMock(a, d) && ms.every((m) => !isMockTaken(a, d, m));

describe("availability", () => {
  test("start times", () => {
    const tennis = startTimes("tennis");
    expect(tennis).toHaveLength(28);
    expect(tennis.slice(0, 3)).toEqual([420, 450, 480]);
    expect(tennis.at(-1)).toBe(1230);
    expect(startTimes("clubhouse")[0]).toBe(540);
    expect(startTimes("clubhouse").at(-1)).toBe(1350);
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

  test("every amenity has an open start whose longer lengths are cut off by a booking", () => {
    for (const a of AMENITIES) {
      expect(
        window.some((d) =>
          slotsFor(a.id, d, [], now).some(
            (s) => s.open && lengthsFrom(a.id, d, s.time, []).some((o) => !o.ok && o.reason.kind === "booked"),
          ),
        ),
      ).toBe(true);
    }
  });

  test("past starts on today are omitted", () => {
    expect(slotsFor("tennis", "2026-10-29", [], now)[0].time).toBe(570);
    expect(slotsFor("tennis", "2026-10-29", [], new Date(2026, 9, 29, 9, 10))[0].time).toBe(570);
  });

  test("hasOpenSlot is false late in the day", () => {
    expect(hasOpenSlot("tennis", "2026-10-29", [], new Date(2026, 9, 29, 20, 30))).toBe(false);
    expect(slotsFor("tennis", "2026-10-29", [], new Date(2026, 9, 29, 20, 29)).map((s) => s.time)).toEqual([1230]);
  });

  test("a length may end exactly at closing", () => {
    const d = window.find((x) => free("tennis", x, 1200, 1230))!;
    expect(lengthsFrom("tennis", d, 1200, [])).toEqual([
      { minutes: 30, ok: true },
      { minutes: 60, ok: true },
      { minutes: 90, ok: false, reason: { kind: "closes", at: 1260 } },
      { minutes: 120, ok: false, reason: { kind: "closes", at: 1260 } },
    ]);
  });

  test("a taken block cuts lengths off", () => {
    let found: { d: ISODate; t: number } | undefined;
    for (const d of window) {
      const t = startTimes("tennis").find((t) => t + 90 <= 1260 && free("tennis", d, t, t + 30) && isMockTaken("tennis", d, t + 60));
      if (t !== undefined && !isFullyBookedByMock("tennis", d)) { found = { d, t }; break; }
    }
    const { d, t } = found!;
    expect(lengthsFrom("tennis", d, t, [])).toEqual([
      { minutes: 30, ok: true },
      { minutes: 60, ok: true },
      { minutes: 90, ok: false, reason: { kind: "booked", at: t + 60 } },
      { minutes: 120, ok: false, reason: { kind: "booked", at: t + 60 } },
    ]);
  });

  test("a booking blocks its whole span", () => {
    const d = window.find((x) => free("clubhouse", x, 540, 570, 600, 630, 660, 690, 720))!;
    const b: Booking = { confirmation: "RS1", amenity: "clubhouse", date: d, time: 600, minutes: 90, guests: 2 };
    const open = (t: number) => slotsFor("clubhouse", d, [b], now).find((s) => s.time === t)!.open;
    for (const t of [600, 630, 660]) expect(open(t)).toBe(false);
    expect(open(690)).toBe(true);
    const from540 = lengthsFrom("clubhouse", d, 540, [b]);
    // 9:00 for 1 hr ends as the booking starts, so it fits; 1½ hr runs into it.
    expect(from540[1]).toEqual({ minutes: 60, ok: true });
    expect(from540[2]).toEqual({ minutes: 90, ok: false, reason: { kind: "booked", at: 600 } });
  });

  test("lengthFits", () => {
    const d = window.find((x) => free("tennis", x, 600, 630))!;
    expect(lengthFits("tennis", d, 600, 60, [])).toBe(true);
    for (const m of [45, 0, 150]) expect(lengthFits("tennis", d, 600, m, [])).toBe(false);
  });

  test("lengthReason", () => {
    expect(lengthReason({ kind: "booked", at: 690 })).toBe("booked at 11:30");
    expect(lengthReason({ kind: "closes", at: 1260 })).toBe("closes at 9:00 PM");
  });

  test("timeOfDay filter", () => {
    const evening = slotsFor("tennis", "2026-11-03", [], now, "evening").map((s) => s.time);
    expect(evening[0]).toBe(1020);
    expect(evening.at(-1)).toBe(1230);
    expect(evening).toHaveLength(8);
  });

  test("openSlotsInRange skips full days and clips to window", () => {
    const r = openSlotsInRange("tennis", { from: "2026-12-20", to: "2027-01-10" }, [], now);
    expect(r.every((d) => d.date <= "2026-12-28" && d.times.length > 0)).toBe(true);
  });
});
