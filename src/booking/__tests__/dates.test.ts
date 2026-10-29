import { addDays, formatDayLong, formatDayShort, formatHour, formatRange, inWindow, lastBookable, nextWeek, toISODate } from "../dates";

const today = "2026-10-29";
test("toISODate uses local date", () => {
  expect(toISODate(new Date(2026, 9, 29, 23, 30))).toBe("2026-10-29");
});
test("addDays crosses months", () => expect(addDays("2026-10-31", 1)).toBe("2026-11-01"));
test("nextWeek is Mon–Sun of the following week", () =>
  expect(nextWeek(today)).toEqual({ from: "2026-11-02", to: "2026-11-08" }));
test("nextWeek from a Sunday is the following Mon–Sun", () =>
  expect(nextWeek("2026-11-01")).toEqual({ from: "2026-11-02", to: "2026-11-08" }));
test("window is today..today+60", () => {
  expect(lastBookable(today)).toBe("2026-12-28");
  expect(inWindow("2026-12-28", today)).toBe(true);
  expect(inWindow("2026-12-29", today)).toBe(false);
  expect(inWindow("2026-10-28", today)).toBe(false);
});
test("formatting", () => {
  expect(formatDayLong("2026-10-31")).toBe("Saturday, Oct 31");
  expect(formatDayShort("2026-10-31")).toEqual({ weekday: "Sat", day: "31", month: "Oct" });
  expect(formatHour(12)).toBe("12:00 PM");
  expect(formatHour(7)).toBe("7:00 AM");
  expect(formatRange(10, 1)).toBe("10:00 – 11:00 AM");
  expect(formatRange(11, 4)).toBe("11:00 AM – 3:00 PM");
});
