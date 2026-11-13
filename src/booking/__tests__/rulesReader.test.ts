import { describe, expect, test } from "vitest";
import { parseMessage } from "../rulesReader";
import { interpret } from "../interpret";

const p = (t: string) => parseMessage(t, "2026-10-29");

describe("parseMessage", () => {
  test("amenity only", () => expect(p("I want to book the tennis court")).toMatchObject({ intent: "book", slots: { amenity: "tennis" } }));
  test("everything at once", () =>
    expect(p("Saturday at 10am for tennis")).toMatchObject({ intent: "book", slots: { amenity: "tennis", date: "2026-10-31", time: 600 } }));
  test("bare hours", () => {
    expect(p("saturday at 3").slots.time).toBe(900);
    expect(p("saturday at 9").slots.time).toBe(540);
    expect(p("at noon").slots.time).toBe(720);
  });
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

describe("final review fixes", () => {
  test("an explicit date beats a weekday word (finding 2)", () => {
    expect(p("Saturday, Nov 14").slots.date).toBe("2026-11-14");
    expect(p("saturday nov 14").slots.date).toBe("2026-11-14");
    expect(p("friday 11/13").slots.date).toBe("2026-11-13");
    expect(p("monday the 16th").slots.date).toBe("2026-11-16");
  });
  test("next weekend is Sat-Sun of next week", () =>
    expect(p("next weekend").range).toEqual({ from: "2026-11-07", to: "2026-11-08" }));
  test("loose confirmations", () => {
    for (const t of ["yes, book it", "yes please", "confirm please", "book it please", "looks good, thanks", "Yes!"]) {
      expect(p(t).intent, t).toBe("confirm");
    }
  });
  test("thanks", () => {
    for (const t of ["thanks", "Thank you!", "ty", "thanks!"]) expect(p(t).intent, t).toBe("thanks");
  });
  test("singular reservation lists", () => expect(p("show my reservation").intent).toBe("listReservations"));
  test("a bare hour as the whole message is a time (R9)", () => {
    expect(p("10").slots.time).toBe(600);
    expect(p("3").slots.time).toBe(900);
    expect(p("6").slots.time).toBe(1080);
    expect(p("7").slots.time).toBe(420);
    expect(p("12").slots.time).toBe(720);
    expect(p("2:00").slots.time).toBe(840);
    expect(p("4 pm").slots.time).toBe(960);
    expect(p("tennis 10").slots.time).toBeUndefined();
  });
  test("change/back targets (R9)", () => {
    expect(p("change the time")).toMatchObject({ intent: "changeTime", changeTarget: "time" });
    expect(p("different day")).toMatchObject({ intent: "changeDay", changeTarget: "day" });
    expect(p("pick another date")).toMatchObject({ changeTarget: "day" });
    expect(p("go back to the amenity")).toMatchObject({ intent: "changeAmenity", changeTarget: "amenity" });
    expect(p("back to time").changeTarget).toBe("time");
    // a new value for the target is a plain change, not a step back
    expect(p("change the day to friday")).toMatchObject({ intent: "changeDay", slots: { date: "2026-10-30" } });
    expect(p("change the day to friday").changeTarget).toBeUndefined();
  });
  test("bare go back means the most recent step", () => {
    const at = (draft: Parameters<typeof parseMessage>[2]) => parseMessage("go back", "2026-10-29", draft).changeTarget;
    expect(at({ guests: 1, amenity: "tennis", date: "2026-10-30", time: 600 })).toBe("time");
    expect(at({ guests: 1, amenity: "tennis", date: "2026-10-30" })).toBe("day");
    expect(at({ guests: 1, amenity: "tennis" })).toBe("amenity");
    expect(at({ guests: 1 })).toBe("amenity");
    expect(p("Go back.").changeTarget).toBe("amenity");
  });
});

describe("booking length", () => {
  test("times are minutes; half-hours are exact", () => {
    expect(p("10:30 am")).toEqual({ intent: "book", slots: { time: 630 } });
    expect(p("10:30")).toEqual({ intent: "book", slots: { time: 630 } });
  });
  test("other minutes snap down to the half-hour", () => {
    expect(p("10:15 am")).toMatchObject({ slots: { time: 600 }, snappedFrom: "10:15 am" });
    expect(p("at 2:45")).toMatchObject({ slots: { time: 870 }, snappedFrom: "at 2:45" });
  });
  test("lengths", () => {
    const len = (t: string) => p(t).slots.minutes;
    expect(len("for 90 minutes")).toBe(90);
    expect(len("90 mins")).toBe(90);
    expect(len("for 2 hours")).toBe(120);
    expect(len("2 hrs")).toBe(120);
    expect(len("1.5 hours")).toBe(90);
    expect(len("an hour")).toBe(60);
    expect(len("half an hour")).toBe(30);
    expect(len("an hour and a half")).toBe(90);
    expect(len("2 hours and a half")).toBe(150);
    expect(len("45 minutes")).toBe(45);
    expect(len("1 hour 15")).toBe(75);
    expect(len("tennis")).toBeUndefined();
  });
  test("a length with a time and a day", () =>
    expect(p("tennis friday at 10 for 90 minutes")).toMatchObject({
      intent: "book", slots: { amenity: "tennis", date: "2026-10-30", time: 600, minutes: 90 } }));
  test("a length alone is a booking turn", () => expect(p("for 2 hours").intent).toBe("book"));
  test("length doesn't read as a time or guests", () => {
    expect(p("for 2 hours").slots.time).toBeUndefined();
    expect(p("for 2 hours").slots.guests).toBeUndefined();
    expect(p("2 hours at 3pm").slots).toMatchObject({ minutes: 120, time: 900 });
  });
  test("change the length", () => {
    for (const t of ["change the length", "different length", "longer", "shorter", "can it be longer"])
      expect(p(t), t).toMatchObject({ intent: "changeLength", changeTarget: "length" });
    expect(p("actually 2 hours")).toMatchObject({ intent: "changeLength", slots: { minutes: 120 } });
    expect(p("actually 2 hours").changeTarget).toBeUndefined();
  });
  test("a guest count, date or time after the length isn't read as minutes", () => {
    expect(p("tennis tuesday at 10 for 2 hours 3 people").slots).toMatchObject({ minutes: 120, guests: 3, time: 600 });
    expect(p("clubhouse for 6 hrs 40 guests").slots).toMatchObject({ minutes: 360, guests: 40 });
    expect(p("1 hr 2 people").slots.minutes).toBe(60);
    expect(p("2hrs 3 ppl").slots.minutes).toBe(120);
    expect(p("for 1 hour 11/20").slots.minutes).toBe(60);
    expect(p("2 hours 20th").slots.minutes).toBe(120);
    expect(p("2 hours 10 a.m.").slots.minutes).toBe(120);
    expect(p("1 hour 15").slots.minutes).toBe(75);
    expect(p("1 hour 15 minutes").slots.minutes).toBe(75);
  });
  test("an hour and some minutes", () => {
    expect(p("an hour and 30 minutes").slots.minutes).toBe(90);
    expect(p("an hour 30").slots.minutes).toBe(90);
    expect(p("1 hour and 30 minutes").slots.minutes).toBe(90);
  });
  test("go back from a full draft steps back from length", () =>
    expect(parseMessage("go back", "2026-10-29", { guests: 1, amenity: "tennis", date: "2026-10-30", time: 600, minutes: 60 }).changeTarget).toBe("length"));
});

describe("interpret", () => {
  test("resolves to parseMessage and never sets reply", async () => {
    const r = await interpret("tennis", { draft: { guests: 1 }, today: "2026-10-29", history: [] });
    expect(r).toEqual(p("tennis"));
    expect(r.reply).toBeUndefined();
  });
});
