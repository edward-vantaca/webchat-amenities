import { describe, expect, test } from "vitest";
import { parseMessage } from "../rulesReader";
import { interpret } from "../interpret";

const p = (t: string) => parseMessage(t, "2026-10-29");

describe("parseMessage", () => {
  test("amenity only", () => expect(p("I want to book the tennis court")).toMatchObject({ intent: "book", slots: { amenity: "tennis" } }));
  test("everything at once", () =>
    expect(p("Saturday at 10am for tennis")).toMatchObject({ intent: "book", slots: { amenity: "tennis", date: "2026-10-31", time: 10 } }));
  test("bare hours", () => {
    expect(p("saturday at 3").slots.time).toBe(15);
    expect(p("saturday at 9").slots.time).toBe(9);
    expect(p("at noon").slots.time).toBe(12);
  });
  test("snap half hours", () => expect(p("10:30 am")).toMatchObject({ slots: { time: 10 }, snappedFrom: "10:30 am" }));
  test("next week range", () => expect(p("next week").range).toEqual({ from: "2026-11-02", to: "2026-11-08" }));
  test("find", () =>
    expect(p("find times next week when the tennis court is available")).toMatchObject({
      intent: "find", slots: { amenity: "tennis" }, range: { from: "2026-11-02", to: "2026-11-08" } }));
  test("change amenity", () => expect(p("actually make it pickleball")).toMatchObject({ intent: "changeAmenity", slots: { amenity: "pickleball" } }));
  test("court is ambiguous", () => expect(p("book a court")).toMatchObject({ intent: "book", ambiguous: "court" }));
  test("dates", () => {
    expect(p("tomorrow").slots.date).toBe("2026-10-30");
    expect(p("thursday").slots.date).toBe("2026-10-29");
    expect(p("next friday").slots.date).toBe("2026-11-06");
    expect(p("nov 14").slots.date).toBe("2026-11-14");
    expect(p("11/14").slots.date).toBe("2026-11-14");
    expect(p("the 14th").slots.date).toBe("2026-11-14");
    expect(p("this weekend").range).toEqual({ from: "2026-10-31", to: "2026-11-01" });
  });
  test("out of window", () => expect(p("jan 5")).toMatchObject({ slots: { date: "2027-01-05" }, outOfWindow: true }));
  test("time of day", () => expect(p("saturday evening").slots).toMatchObject({ date: "2026-10-31", timeOfDay: "evening" }));
  test("guests", () => expect(p("tennis for 3 people").slots.guests).toBe(3));
  test("confirm / list / off-topic / unknown", () => {
    expect(p("yes").intent).toBe("confirm");
    expect(p("show my reservations").intent).toBe("listReservations");
    expect(p("What is my current account balance?").intent).toBe("offTopic");
    expect(p("blorp").intent).toBe("unknown");
  });
  test("omits absent keys", () => {
    const r = p("tennis");
    expect(r).toEqual({ intent: "book", slots: { amenity: "tennis" } });
  });
  test("the 14th rolls across the year boundary", () =>
    expect(parseMessage("the 14th", "2026-12-20").slots.date).toBe("2027-01-14"));
  test("month-name date earlier than today rolls to next year", () =>
    expect(p("oct 1")).toMatchObject({ slots: { date: "2027-10-01" }, outOfWindow: true }));
  test("weekend on a Sunday is that day only", () =>
    expect(parseMessage("this weekend", "2026-11-01").range).toEqual({ from: "2026-11-01", to: "2026-11-01" }));
});

describe("interpret", () => {
  test("resolves to parseMessage and never sets reply", async () => {
    const r = await interpret("tennis", { draft: { guests: 1 }, today: "2026-10-29", history: [] });
    expect(r).toEqual(p("tennis"));
    expect(r.reply).toBeUndefined();
  });
});
