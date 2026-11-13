import { addDays, fromISODate, weekday, formatDayLong, formatDayShort, formatClock, formatLength, formatLimit, formatRange, formatTime, inWindow, lastBookable, nextWeek, toISODate } from "../dates";

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
  expect(formatTime(720)).toBe("12:00 PM");
  expect(formatTime(420)).toBe("7:00 AM");
  expect(formatTime(630)).toBe("10:30 AM");
  expect(formatClock(690)).toBe("11:30");
  expect(formatRange(600, 90)).toBe("10:00 – 11:30 AM");
  expect(formatRange(660, 240)).toBe("11:00 AM – 3:00 PM");
});
test("lengths and limits", () => {
  expect([30, 60, 90, 120, 150, 360].map(formatLength)).toEqual(["30 min", "1 hr", "1½ hr", "2 hr", "2½ hr", "6 hr"]);
  expect(formatLimit(120)).toBe("Up to 2 hrs");
  expect(formatLimit(360)).toBe("Up to 6 hrs");
});

test("addDays crosses year boundary and accepts negative n", () => {
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
});
test("addDays stays on local calendar days across DST", () => {
  expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
  expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
  expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
  expect(addDays("2026-03-09", -1)).toBe("2026-03-08");
});
test("nextWeek from a Monday is the following Mon–Sun", () =>
  expect(nextWeek("2026-11-02")).toEqual({ from: "2026-11-09", to: "2026-11-15" }));
test("formatRange handles midnight close", () => {
  expect(formatRange(1320, 120)).toBe("10:00 PM – 12:00 AM");
});
test("weekday is 0 for Sunday", () => {
  expect(weekday("2026-11-01")).toBe(0);
  expect(weekday("2026-10-29")).toBe(4);
  expect(weekday("2026-10-31")).toBe(6);
});
test("fromISODate is local midnight", () => {
  const d = fromISODate("2026-10-29");
  expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 29, 0, 0]);
});
