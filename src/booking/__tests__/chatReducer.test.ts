import { describe, expect, test } from "vitest";
import { COMMON_QUESTIONS, RESERVE_QUESTION, chatReducer, initChat } from "../chatReducer";
import { addDays, formatDayLong, formatHour } from "../dates";
import { hasOpenSlot, isFullyBookedByMock, openSlotsInRange, slotsFor } from "../availability";
import { parseMessage } from "../rulesReader";
import type { AmenityId, ChatEvent, ChatState, ISODate, Interpretation, Widget } from "../types";

const NOW = new Date(2026, 9, 29, 9, 0);
const TODAY = "2026-10-29";
const s0 = initChat(NOW);

const last = (s: ChatState) => s.messages[s.messages.length - 1];
const activeWidgets = (s: ChatState): Widget[] =>
  s.messages.filter((m) => m.active && m.widget).map((m) => m.widget!);
const agentTexts = (s: ChatState) => s.messages.filter((m) => m.role === "agent" && m.text).map((m) => m.text!);
const activeId = (s: ChatState, kind: Widget["kind"]) =>
  s.messages.find((m) => m.active && m.widget?.kind === kind)!.id;
const run = (s: ChatState, ...events: ChatEvent[]) => events.reduce(chatReducer, s);

// ---- dates/hours found by searching the mock calendar, never hard-coded ----

const strip = (n = 14) => Array.from({ length: n }, (_, i) => addDays(TODAY, i));

function openDay(amenity: AmenityId): ISODate {
  return strip().find((d) => hasOpenSlot(amenity, d, [], NOW))!;
}
function openHour(amenity: AmenityId, date: ISODate): number {
  return slotsFor(amenity, date, [], NOW).find((s) => s.open)!.hour;
}
// A day that has both an open and a taken start, plus that taken hour.
function dayWithTakenHour(amenity: AmenityId): { date: ISODate; hour: number } {
  for (let i = 1; i <= 60; i++) {
    const date = addDays(TODAY, i);
    const slots = slotsFor(amenity, date, [], NOW);
    const taken = slots.find((s) => !s.open);
    if (taken && slots.some((s) => s.open)) return { date, hour: taken.hour };
  }
  throw new Error("no day with a taken hour");
}

const OPEN_DAY = openDay("tennis");
const OPEN_HOUR = openHour("tennis", OPEN_DAY);

function toSummary(): ChatState {
  let s = chatReducer(s0, { type: "commonQuestion", text: RESERVE_QUESTION });
  s = chatReducer(s, { type: "pickAmenity", amenity: "tennis", from: last(s).id });
  s = chatReducer(s, { type: "pickDate", date: OPEN_DAY, from: last(s).id });
  return chatReducer(s, { type: "pickSlot", date: OPEN_DAY, time: OPEN_HOUR, from: activeId(s, "slots") });
}

function typed(s: ChatState, result: Interpretation): ChatState {
  return run(s, { type: "userText", text: "typed" }, { type: "interpreted", result });
}

describe("initChat and constants", () => {
  test("initial state", () => {
    expect(s0).toEqual({ now: NOW, messages: [], draft: { guests: 1 }, bookings: [], pending: false, nextId: 1 });
  });
  test("common questions start with the reserve question", () => {
    expect(RESERVE_QUESTION).toBe("Reserve an amenity for me");
    expect(COMMON_QUESTIONS).toEqual([
      "Reserve an amenity for me",
      "What is my current account balance?",
      "How do I submit an architectural modification (ARC) request and track status?",
      "I received a violation—what is it for and how do I resolve/appeal it?",
      "What is the process to request a new pool key?",
    ]);
  });
});

describe("tap path", () => {
  test("reserve question shows amenity tiles", () => {
    const s = chatReducer(s0, { type: "commonQuestion", text: RESERVE_QUESTION });
    expect(s.messages[0]).toMatchObject({ role: "user", text: "Reserve an amenity for me" });
    expect(last(s)).toMatchObject({ role: "agent", text: "Happy to help! Which amenity would you like to reserve?" });
    expect(last(s).widget).toEqual({ kind: "amenities" });
  });

  test("other common questions get the canned reply", () => {
    const s = chatReducer(s0, { type: "commonQuestion", text: COMMON_QUESTIONS[1] });
    expect(s.messages[0]).toMatchObject({ role: "user", text: COMMON_QUESTIONS[1] });
    expect(last(s).text).toBe('I can help you reserve an amenity. Tap "Reserve an amenity for me" to get started.');
    expect(last(s).widget).toBeUndefined();
  });

  test("tap path reaches summary then confirmation", () => {
    let s = chatReducer(s0, { type: "commonQuestion", text: RESERVE_QUESTION });
    s = chatReducer(s, { type: "pickAmenity", amenity: "tennis", from: last(s).id });
    expect(s.messages.at(-2)).toMatchObject({ role: "user", text: "Tennis Court" });
    expect(last(s).text).toBe("Great choice. What day works for you? Tap a day or type one, like “Saturday”.");
    expect(last(s).widget).toEqual({ kind: "days", from: "2026-10-29", count: 14 });
    s = chatReducer(s, { type: "pickDate", date: OPEN_DAY, from: last(s).id });
    expect(s.messages.at(-3)).toMatchObject({ role: "user", text: formatDayLong(OPEN_DAY) });
    expect(s.messages.at(-2)?.text).toBe(`Here are the open 1-hour slots for the Tennis Court on ${formatDayLong(OPEN_DAY)}:`);
    const slotsMsg = s.messages.find((m) => m.active && m.widget?.kind === "slots")!;
    expect(slotsMsg.widget).toEqual({ kind: "slots", amenity: "tennis", date: OPEN_DAY });
    s = chatReducer(s, { type: "pickSlot", date: OPEN_DAY, time: OPEN_HOUR, from: slotsMsg.id });
    expect(s.messages.at(-2)).toMatchObject({ role: "user", text: formatHour(OPEN_HOUR) });
    expect(last(s).text).toBe("Here's your reservation. Does this look right?");
    expect(last(s).widget).toMatchObject({ kind: "summary", amenity: "tennis", date: OPEN_DAY, time: OPEN_HOUR, guests: 1 });
    s = chatReducer(s, { type: "confirm", from: last(s).id });
    expect(s.bookings).toHaveLength(1);
    expect(s.bookings[0]).toMatchObject({ amenity: "tennis", date: OPEN_DAY, time: OPEN_HOUR, guests: 1 });
    expect(s.bookings[0].confirmation).toMatch(/^RS\d{5}$/);
    expect(s.draft).toEqual({ guests: 1 });
    const confirmMsg = s.messages.find((m) => m.widget?.kind === "confirmation")!;
    expect(confirmMsg.text).toBe("You're all set!");
    expect(confirmMsg.widget).toEqual({ kind: "confirmation", booking: s.bookings[0] });
    expect(s.messages.find((m) => m.role === "user" && m.text === "Confirm")).toBeTruthy();
    expect(last(s).widget).toEqual({
      kind: "chips",
      chips: [
        { label: "Book another amenity", event: { type: "bookAnother", from: 0 } },
        { label: "View my reservations", event: { type: "listReservations", from: 0 } },
      ],
    });
    expect(activeWidgets(s).map((w) => w.kind)).toEqual(["confirmation", "chips"]);
  });

  test("confirmation number is deterministic", () => {
    const a = chatReducer(toSummary(), { type: "confirm", from: last(toSummary()).id });
    const b = chatReducer(toSummary(), { type: "confirm", from: last(toSummary()).id });
    expect(a.bookings[0].confirmation).toBe(b.bookings[0].confirmation);
  });

  test("message ids are unique and increasing", () => {
    const s = toSummary();
    const ids = s.messages.map((m) => m.id);
    expect(ids).toEqual([...ids].sort((x, y) => x - y));
    expect(new Set(ids).size).toBe(ids.length);
    expect(s.nextId).toBe(Math.max(...ids) + 1);
  });

  test("events from inactive widgets are ignored", () => {
    let s = toSummary();
    const summaryId = last(s).id;
    s = chatReducer(s, { type: "confirm", from: summaryId });
    const before = s;
    const after = chatReducer(before, { type: "confirm", from: summaryId });
    expect(after).toBe(before);
    expect(after.bookings).toHaveLength(1);
    // an unknown id is ignored too
    expect(chatReducer(before, { type: "pickAmenity", amenity: "lounge", from: 9999 })).toBe(before);
  });

  test("only the newest widget is active (slots + its chips together)", () => {
    let s = chatReducer(s0, { type: "commonQuestion", text: RESERVE_QUESTION });
    s = chatReducer(s, { type: "pickAmenity", amenity: "tennis", from: last(s).id });
    s = chatReducer(s, { type: "pickDate", date: OPEN_DAY, from: last(s).id });
    expect(activeWidgets(s).map((w) => w.kind)).toEqual(["slots", "chips"]);
    expect(last(s).widget).toEqual({
      kind: "chips",
      chips: [
        { label: "← Pick a different day", event: { type: "back", to: "day", from: 0 } },
        { label: "Change amenity", event: { type: "back", to: "amenity", from: 0 } },
      ],
    });
  });

  test("a fully booked day tapped re-asks for a day", () => {
    const full = strip(60).find((d) => isFullyBookedByMock("tennis", d))!;
    let s = run(s0, { type: "commonQuestion", text: RESERVE_QUESTION });
    s = chatReducer(s, { type: "pickAmenity", amenity: "tennis", from: last(s).id });
    s = chatReducer(s, { type: "pickDate", date: full, from: last(s).id });
    expect(last(s).text).toBe(`Tennis Court is fully booked on ${formatDayLong(full)}. Please pick another day.`);
    expect(last(s).widget).toEqual({ kind: "days", from: TODAY, count: 14 });
    expect(s.draft.date).toBeUndefined();
  });

  test("pickAmenity clamps guests", () => {
    let s = chatReducer(s0, { type: "commonQuestion", text: RESERVE_QUESTION });
    s = { ...s, draft: { guests: 30 } };
    s = chatReducer(s, { type: "pickAmenity", amenity: "tennis", from: last(s).id });
    expect(s.draft).toEqual({ amenity: "tennis", guests: 4 });
  });
});

describe("summary, change and back", () => {
  test("setGuests updates summary in place and clamps", () => {
    const before = toSummary();
    let s = chatReducer(before, { type: "setGuests", guests: 9, from: last(before).id });
    expect(last(s).widget).toMatchObject({ kind: "summary", guests: 4 });
    expect(s.draft.guests).toBe(4);
    expect(s.messages.length).toBe(before.messages.length);
    expect(last(s).id).toBe(last(before).id);
    s = chatReducer(s, { type: "setGuests", guests: 0, from: last(s).id });
    expect(last(s).widget).toMatchObject({ kind: "summary", guests: 1 });
    s = chatReducer(s, { type: "setGuests", guests: 3, from: last(s).id });
    s = chatReducer(s, { type: "confirm", from: last(s).id });
    expect(s.bookings[0].guests).toBe(3);
  });

  test("change shows three back chips", () => {
    const s = chatReducer(toSummary(), { type: "change", from: last(toSummary()).id });
    expect(s.messages.at(-2)).toMatchObject({ role: "user", text: "Change" });
    expect(last(s).widget).toEqual({
      kind: "chips",
      chips: [
        { label: "Different time", event: { type: "back", to: "time", from: 0 } },
        { label: "Different day", event: { type: "back", to: "day", from: 0 } },
        { label: "Different amenity", event: { type: "back", to: "amenity", from: 0 } },
      ],
    });
    expect(activeWidgets(s).map((w) => w.kind)).toEqual(["chips"]);
  });

  test("back to time / day echoes the chip label and re-asks", () => {
    let s = toSummary();
    s = chatReducer(s, { type: "change", from: last(s).id });
    const chipsId = last(s).id;
    const toTime = chatReducer(s, { type: "back", to: "time", from: chipsId });
    expect(toTime.messages.find((m) => m.id > chipsId && m.role === "user")?.text).toBe("Different time");
    expect(toTime.draft).toMatchObject({ amenity: "tennis", date: OPEN_DAY });
    expect(toTime.draft.time).toBeUndefined();
    expect(activeWidgets(toTime).map((w) => w.kind)).toEqual(["slots", "chips"]);

    const toDay = chatReducer(s, { type: "back", to: "day", from: chipsId });
    expect(toDay.messages.find((m) => m.id > chipsId && m.role === "user")?.text).toBe("Different day");
    expect(toDay.draft).toEqual({ amenity: "tennis", guests: 1 });
    expect(last(toDay).widget).toEqual({ kind: "days", from: TODAY, count: 14 });

    // "← Pick a different day" from the slots chips echoes that label
    const fromSlots = chatReducer(toTime, { type: "back", to: "day", from: last(toTime).id });
    expect(fromSlots.messages.at(-2)).toMatchObject({ role: "user", text: "← Pick a different day" });
  });

  test("back to amenity keeps the date and re-checks it on the next pick", () => {
    let s = toSummary();
    s = chatReducer(s, { type: "change", from: last(s).id });
    s = chatReducer(s, { type: "back", to: "amenity", from: last(s).id });
    expect(last(s).widget).toEqual({ kind: "amenities" });
    expect(s.draft).toEqual({ date: OPEN_DAY, time: OPEN_HOUR, guests: 1 });
    s = chatReducer(s, { type: "pickAmenity", amenity: "pickleball", from: last(s).id });
    const pbOpen = slotsFor("pickleball", OPEN_DAY, [], NOW).find((x) => x.hour === OPEN_HOUR)?.open;
    if (!hasOpenSlot("pickleball", OPEN_DAY, [], NOW)) {
      expect(last(s).widget?.kind).toBe("days");
    } else if (pbOpen) {
      expect(last(s).widget?.kind).toBe("summary");
    } else {
      expect(agentTexts(s).at(-1)).toContain(`${formatHour(OPEN_HOUR)} isn't available.`);
      expect(s.draft.time).toBeUndefined();
    }
  });

  test("book another restarts at amenities, view reservations lists bookings", () => {
    let s = toSummary();
    s = chatReducer(s, { type: "confirm", from: last(s).id });
    const chipsId = last(s).id;
    const listed = chatReducer(s, { type: "listReservations", from: chipsId });
    expect(listed.messages.at(-2)).toMatchObject({ role: "user", text: "View my reservations" });
    expect(last(listed)).toMatchObject({
      text: "Here are your reservations:",
      widget: { kind: "reservations", bookings: s.bookings },
    });
    const again = chatReducer(s, { type: "bookAnother", from: chipsId });
    expect(again.messages.at(-2)).toMatchObject({ role: "user", text: "Book another amenity" });
    expect(again.draft).toEqual({ guests: 1 });
    expect(last(again).widget).toEqual({ kind: "amenities" });
  });

  test("own booking blocks the same slot afterwards", () => {
    let s = toSummary();
    s = chatReducer(s, { type: "confirm", from: last(s).id });
    s = typed(s, { intent: "book", slots: { amenity: "tennis", date: OPEN_DAY, time: OPEN_HOUR } });
    expect(agentTexts(s).at(-1)).toContain("isn't available");
  });
});

describe("calendar", () => {
  function withStrip(): ChatState {
    let s = chatReducer(s0, { type: "commonQuestion", text: RESERVE_QUESTION });
    return chatReducer(s, { type: "pickAmenity", amenity: "tennis", from: last(s).id });
  }

  test("openCalendar appends a calendar and keeps the strip active", () => {
    const s0b = withStrip();
    const s = chatReducer(s0b, { type: "openCalendar", from: last(s0b).id });
    expect(s.messages.length).toBe(s0b.messages.length + 1);
    expect(last(s).widget).toEqual({ kind: "calendar", month: "2026-10-01" });
    expect(activeWidgets(s).map((w) => w.kind)).toEqual(["days", "calendar"]);
    // a date picked from the calendar works like the strip
    const picked = chatReducer(s, { type: "pickDate", date: OPEN_DAY, from: last(s).id });
    expect(picked.draft.date).toBe(OPEN_DAY);
  });

  test("calendarMonth edits in place and respects bounds", () => {
    const strip0 = withStrip();
    let s = chatReducer(strip0, { type: "openCalendar", from: last(strip0).id });
    const calId = last(s).id;
    s = chatReducer(s, { type: "calendarMonth", month: "2026-11-01", from: calId });
    expect(last(s)).toMatchObject({ id: calId, widget: { kind: "calendar", month: "2026-11-01" } });
    s = chatReducer(s, { type: "calendarMonth", month: "2026-12-01", from: calId });
    expect(last(s).widget).toEqual({ kind: "calendar", month: "2026-12-01" });
    expect(s.messages.length).toBe(strip0.messages.length + 1);
    const before = s;
    expect(chatReducer(before, { type: "calendarMonth", month: "2027-01-01", from: calId })).toBe(before);
    expect(chatReducer(before, { type: "calendarMonth", month: "2026-09-01", from: calId })).toBe(before);
  });
});

describe("typed time is kept until it is used (R6)", () => {
  // A tennis hour together with a day it is open on and a day it is taken on (both days still bookable).
  function hourWithOpenAndTakenDay(): { hour: number; openOn: ISODate; takenOn: ISODate } {
    for (const hour of [10, 11, 9, 14, 16, 18, 8, 12, 13, 15, 17, 19, 20, 7]) {
      const days = strip().filter((d) => d !== TODAY && hasOpenSlot("tennis", d, [], NOW));
      const at = (d: ISODate) => slotsFor("tennis", d, [], NOW).find((x) => x.hour === hour)!.open;
      const openOn = days.find(at);
      const takenOn = days.find((d) => !at(d));
      if (openOn && takenOn) return { hour, openOn, takenOn };
    }
    throw new Error("no suitable hour");
  }
  const { hour, openOn, takenOn } = hourWithOpenAndTakenDay();

  test("typed time then a tapped open day goes straight to the summary", () => {
    let s = typed(s0, { intent: "book", slots: { amenity: "tennis", time: hour } });
    expect(last(s).widget?.kind).toBe("days");
    expect(s.draft.time).toBe(hour);
    s = chatReducer(s, { type: "pickDate", date: openOn, from: last(s).id });
    expect(last(s).widget).toEqual({ kind: "summary", amenity: "tennis", date: openOn, time: hour, guests: 1 });
  });

  test("typed time then a tapped day where it is taken says so and shows slots", () => {
    let s = typed(s0, { intent: "book", slots: { amenity: "tennis", time: hour } });
    s = chatReducer(s, { type: "pickDate", date: takenOn, from: last(s).id });
    expect(agentTexts(s).at(-1)).toBe(
      `${formatHour(hour)} isn't available. Here are the open 1-hour slots for the Tennis Court on ${formatDayLong(takenOn)}:`,
    );
    expect(activeWidgets(s).map((w) => w.kind)).toEqual(["slots", "chips"]);
    expect(s.draft.time).toBeUndefined();
  });

  test("a typed range keeps a typed time", () => {
    let s = typed(s0, { intent: "book", slots: { amenity: "tennis", date: openOn, time: hour } });
    s = typed(s, parseMessage("next week", TODAY));
    expect(s.draft.date).toBeUndefined();
    expect(s.draft.time).toBe(hour);
    expect(s.draft.range).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(last(s).widget).toEqual({ kind: "days", from: "2026-11-02", count: 7 });
  });
});

describe("typed input", () => {
  test("userText echoes and sets pending only", () => {
    const s = chatReducer(s0, { type: "userText", text: "hello" });
    expect(s.pending).toBe(true);
    expect(s.messages).toEqual([{ id: 1, role: "user", text: "hello", active: true }]);
  });

  test("typed everything jumps to summary", () => {
    let s = chatReducer(s0, { type: "userText", text: "x" });
    expect(s.pending).toBe(true);
    s = chatReducer(s, { type: "interpreted", result: { intent: "book", slots: { amenity: "tennis", date: OPEN_DAY, time: OPEN_HOUR } } });
    expect(s.pending).toBe(false);
    expect(last(s).widget?.kind).toBe("summary");
  });

  test("typed taken time says unavailable and shows slots", () => {
    const { date, hour } = dayWithTakenHour("tennis");
    const s = typed(s0, { intent: "book", slots: { amenity: "tennis", date, time: hour } });
    expect(agentTexts(s).at(-1)).toContain("isn't available");
    expect(agentTexts(s).at(-1)).toBe(
      `${formatHour(hour)} isn't available. Here are the open 1-hour slots for the Tennis Court on ${formatDayLong(date)}:`,
    );
    expect(activeWidgets(s).map((w) => w.kind)).toEqual(["slots", "chips"]);
    expect(s.draft.time).toBeUndefined();
  });

  test("typed today when no starts left", () => {
    const late = initChat(new Date(2026, 9, 29, 20, 30));
    const s = typed(late, { intent: "book", slots: { amenity: "tennis", date: "2026-10-29" } });
    const text = agentTexts(s).at(-1)!;
    expect(text).toContain("fully booked on Thursday, Oct 29");
    expect(last(s).widget?.kind).toBe("days");
    expect(s.draft.date).toBeUndefined();
  });

  test("next week while strip showing adapts strip", () => {
    let s = chatReducer(s0, { type: "commonQuestion", text: RESERVE_QUESTION });
    s = chatReducer(s, { type: "pickAmenity", amenity: "tennis", from: last(s).id });
    s = typed(s, parseMessage("next week", TODAY));
    expect(last(s).text).toBe("What day works for you?");
    expect(last(s).widget).toEqual({ kind: "days", from: "2026-11-02", count: 7 });
  });

  test("find shows slot list", () => {
    let s = typed(s0, parseMessage("find times next week when the tennis court is available", TODAY));
    expect(last(s).text).toBe("Here are the open times for Tennis Court:");
    expect(last(s).widget).toEqual({ kind: "slotList", amenity: "tennis", range: { from: "2026-11-02", to: "2026-11-08" } });
    expect(s.draft.find).toBeFalsy();
    // tapping a tile in the list fills date + time
    const [{ date: day, hours: [hour] }] = openSlotsInRange("tennis", { from: "2026-11-02", to: "2026-11-08" }, [], NOW);
    s = chatReducer(s, { type: "pickSlot", date: day, time: hour, from: last(s).id });
    expect(s.messages.at(-2)).toMatchObject({ role: "user", text: formatHour(hour) });
    expect(last(s).widget).toMatchObject({ kind: "summary", date: day, time: hour });
    expect(s.draft.range).toBeUndefined();
  });

  test("find without a range defaults to the next 7 days", () => {
    const s = typed(s0, { intent: "find", slots: { amenity: "tennis" } });
    expect(last(s).widget).toEqual({ kind: "slotList", amenity: "tennis", range: { from: TODAY, to: "2026-11-04" } });
  });

  test("find without an amenity asks for it, then shows the list", () => {
    let s = typed(s0, parseMessage("find times next week", TODAY));
    expect(last(s).widget).toEqual({ kind: "amenities" });
    s = chatReducer(s, { type: "pickAmenity", amenity: "tennis", from: last(s).id });
    expect(last(s).widget).toEqual({ kind: "slotList", amenity: "tennis", range: { from: "2026-11-02", to: "2026-11-08" } });
  });

  test("change amenity clamps guests and drops a full date", () => {
    const D = strip(60).find((d) => isFullyBookedByMock("tennis", d) && hasOpenSlot("clubhouse", d, [], NOW))!;
    let s = typed(s0, { intent: "book", slots: { amenity: "clubhouse", date: D, guests: 30 } });
    expect(s.draft).toMatchObject({ amenity: "clubhouse", date: D, guests: 30 });
    s = typed(s, parseMessage("actually make it tennis", TODAY));
    expect(s.draft.amenity).toBe("tennis");
    expect(s.draft.guests).toBe(4);
    expect(s.draft.date).toBeUndefined();
    expect(last(s).text).toBe(`Tennis Court is fully booked on ${formatDayLong(D)}. Please pick another day.`);
  });

  test("change amenity keeps an open date and re-checks the time", () => {
    // a day open for both, with an hour that is open for tennis but taken for pickleball
    let found: { date: ISODate; hour: number } | undefined;
    for (const d of strip(60)) {
      const t = slotsFor("tennis", d, [], NOW);
      const p = slotsFor("pickleball", d, [], NOW);
      if (!p.some((x) => x.open)) continue;
      const h = t.find((x) => x.open && !p.find((y) => y.hour === x.hour)!.open);
      if (h) { found = { date: d, hour: h.hour }; break; }
    }
    expect(found).toBeDefined();
    const { date, hour } = found!;
    let s = typed(s0, { intent: "book", slots: { amenity: "tennis", date, time: hour } });
    expect(last(s).widget?.kind).toBe("summary");
    s = typed(s, { intent: "changeAmenity", slots: { amenity: "pickleball" } });
    expect(s.draft).toMatchObject({ amenity: "pickleball", date });
    expect(s.draft.time).toBeUndefined();
    expect(agentTexts(s).at(-1)).toContain(`${formatHour(hour)} isn't available.`);
    expect(activeWidgets(s)[0]).toEqual({ kind: "slots", amenity: "pickleball", date });
  });

  test("change day clears the time", () => {
    let s = typed(s0, { intent: "book", slots: { amenity: "tennis", date: OPEN_DAY, time: OPEN_HOUR } });
    const other = strip().find((d) => d !== OPEN_DAY && hasOpenSlot("tennis", d, [], NOW))!;
    s = typed(s, { intent: "changeDay", slots: { date: other } });
    expect(s.draft).toMatchObject({ amenity: "tennis", date: other });
    expect(s.draft.time).toBeUndefined();
    expect(activeWidgets(s).map((w) => w.kind)).toEqual(["slots", "chips"]);
  });

  test("time of day filters the slots widget", () => {
    const s = typed(s0, { intent: "book", slots: { amenity: "tennis", date: OPEN_DAY, timeOfDay: "afternoon" } });
    const w = activeWidgets(s)[0];
    const hasAfternoon = slotsFor("tennis", OPEN_DAY, [], NOW, "afternoon").some((x) => x.open);
    expect(w).toEqual(
      hasAfternoon
        ? { kind: "slots", amenity: "tennis", date: OPEN_DAY, timeOfDay: "afternoon" }
        : { kind: "slots", amenity: "tennis", date: OPEN_DAY },
    );
  });

  test("ambiguous court asks which court", () => {
    const s = typed(s0, parseMessage("court", TODAY));
    expect(last(s).text).toBe("Which court would you like?");
    expect(last(s).widget).toEqual({ kind: "amenities" });
  });

  test("unknown re-shows current picker", () => {
    let s = chatReducer(s0, { type: "commonQuestion", text: RESERVE_QUESTION });
    const oldId = last(s).id;
    s = typed(s, parseMessage("asdf", TODAY));
    const texts = agentTexts(s);
    expect(texts).toContain("Sorry, I didn't catch that. You can pick from the options below.");
    expect(last(s).widget).toEqual({ kind: "amenities" });
    expect(last(s).id).not.toBe(oldId);
    expect(activeWidgets(s)).toHaveLength(1);
  });

  test("unknown re-shows the slots and their chips", () => {
    let s = chatReducer(s0, { type: "commonQuestion", text: RESERVE_QUESTION });
    s = chatReducer(s, { type: "pickAmenity", amenity: "tennis", from: last(s).id });
    s = chatReducer(s, { type: "pickDate", date: OPEN_DAY, from: last(s).id });
    s = typed(s, { intent: "unknown", slots: {} });
    expect(activeWidgets(s).map((w) => w.kind)).toEqual(["slots", "chips"]);
    expect(s.messages.at(-2)?.text).toBe("Sorry, I didn't catch that. You can pick from the options below.");
  });

  test("unknown with no picker yet falls back to amenity tiles", () => {
    const s = typed(s0, { intent: "unknown", slots: {} });
    expect(last(s)).toMatchObject({
      text: "Sorry, I didn't catch that. You can pick from the options below.",
      widget: { kind: "amenities" },
    });
  });

  test("off topic gets the canned reply and keeps the picker live", () => {
    let s = chatReducer(s0, { type: "commonQuestion", text: RESERVE_QUESTION });
    s = typed(s, parseMessage("what is my balance", TODAY));
    expect(last(s).text).toBe('I can help you reserve an amenity. Tap "Reserve an amenity for me" to get started.');
    expect(activeWidgets(s)).toEqual([{ kind: "amenities" }]);
  });

  test("out of window", () => {
    const s = typed(s0, parseMessage("tennis on Feb 5", TODAY));
    const text = last(s).text;
    expect(text).toBe("I can only book up to 60 days ahead.");
    expect(last(s).widget).toEqual({ kind: "days", from: TODAY, count: 14 });
    expect(s.draft.amenity).toBe("tennis");
    expect(s.draft.date).toBeUndefined();
  });

  test("snapped time is announced", () => {
    const s = typed(s0, { intent: "book", slots: { amenity: "tennis", date: OPEN_DAY, time: 10 }, snappedFrom: "10:30" });
    const text = agentTexts(s).at(-1)!;
    expect(text).toContain("The closest start is 10:00 AM");
    expect(text.startsWith("The closest start is 10:00 AM.")).toBe(true);
  });

  test("reply from the reader replaces the built-in text", () => {
    const s = typed(s0, { intent: "book", slots: { amenity: "tennis" }, reply: "Sure, tennis it is." });
    expect(last(s).text).toBe("Sure, tennis it is.");
    expect(last(s).widget).toEqual({ kind: "days", from: TODAY, count: 14 });
  });

  test("typed confirm books when a summary is active, otherwise not understood", () => {
    const s = typed(toSummary(), { intent: "confirm", slots: {} });
    expect(s.bookings).toHaveLength(1);
    expect(s.messages.filter((m) => m.text === "Confirm")).toHaveLength(0);
    expect(activeWidgets(s).map((w) => w.kind)).toEqual(["confirmation", "chips"]);

    const early = typed(chatReducer(s0, { type: "commonQuestion", text: RESERVE_QUESTION }), { intent: "confirm", slots: {} });
    expect(early.bookings).toHaveLength(0);
    expect(agentTexts(early)).toContain("Sorry, I didn't catch that. You can pick from the options below.");
  });

  test("typed list reservations", () => {
    const none = typed(s0, parseMessage("show my reservations", TODAY));
    expect(last(none).text).toBe("You don't have any reservations yet.");
    let s = toSummary();
    s = chatReducer(s, { type: "confirm", from: last(s).id });
    s = typed(s, { intent: "listReservations", slots: {} });
    expect(last(s).widget).toEqual({ kind: "reservations", bookings: s.bookings });
  });

  test("typed guests are clamped", () => {
    const s = typed(s0, { intent: "book", slots: { amenity: "tennis", date: OPEN_DAY, time: OPEN_HOUR, guests: 12 } });
    expect(last(s).widget).toMatchObject({ kind: "summary", guests: 4 });
  });

  test("interpretFailed shows error and re-shows picker", () => {
    let s = chatReducer(s0, { type: "commonQuestion", text: RESERVE_QUESTION });
    s = chatReducer(s, { type: "pickAmenity", amenity: "tennis", from: last(s).id });
    s = chatReducer(s, { type: "userText", text: "saturday" });
    s = chatReducer(s, { type: "interpretFailed" });
    expect(s.pending).toBe(false);
    expect(last(s).text).toBe("Something went wrong, please try again.");
    expect(last(s).widget).toEqual({ kind: "days", from: TODAY, count: 14 });
    expect(activeWidgets(s)).toHaveLength(1);
  });
});
