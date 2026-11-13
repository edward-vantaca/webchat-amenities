// Multi-turn scripts mixing taps and typed turns (typed turns go through the real rules reader).
// Days and hours come from the availability functions, never hard-coded.
import { describe, expect, test } from "vitest";
import { COMMON_QUESTIONS, RESERVE_QUESTION, chatReducer, initChat } from "../chatReducer";
import { addDays, formatDayLong, formatTime, toISODate } from "../dates";
import { hasOpenSlot, lengthFits, openSlotsInRange, slotsFor } from "../availability";
import { parseMessage } from "../rulesReader";
import { contextFor } from "../interpret";
import type { AmenityId, ChatEvent, ChatState, ISODate, TimeOfDay, Widget } from "../types";

const NOW = new Date(2026, 9, 29, 9, 0);
const TODAY = "2026-10-29";
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// ---- helpers ----

const last = (s: ChatState) => s.messages[s.messages.length - 1];
const agentTexts = (s: ChatState) => s.messages.filter((m) => m.role === "agent" && m.text).map((m) => m.text!);
const lastAgentText = (s: ChatState) => agentTexts(s).at(-1);
const activeKinds = (s: ChatState) => s.messages.filter((m) => m.active && m.widget).map((m) => m.widget!.kind);
const widgetsOf = (s: ChatState, kind: Widget["kind"]) => s.messages.filter((m) => m.widget?.kind === kind);

function say(s: ChatState, text: string): ChatState {
  const today = toISODate(s.now);
  const turn = s.nextId;
  s = chatReducer(s, { type: "userText", text });
  return chatReducer(s, { type: "interpreted", result: parseMessage(text, today, s.draft), turn });
}

// Taps the newest active widget of `kind` (default: the newest active widget of any kind).
type Tap = Extract<ChatEvent, { from: number }>;
type WithoutFrom<E> = E extends unknown ? Omit<E, "from"> : never;
type TapWithoutFrom = WithoutFrom<Tap>;
function tap(s: ChatState, event: TapWithoutFrom, kind?: Widget["kind"]): ChatState {
  const src = [...s.messages].reverse().find((m) => m.active && m.widget && (!kind || m.widget.kind === kind));
  if (!src) throw new Error(`no active ${kind ?? "widget"}`);
  return chatReducer(s, { ...event, from: src.id } as ChatEvent);
}

// Taps a chip by its label, sending the chip's own event the way ChipRow does.
function tapChip(s: ChatState, label: string): ChatState {
  const src = [...s.messages].reverse().find((m) => m.active && m.widget?.kind === "chips"
    && m.widget.chips.some((c) => c.label === label));
  if (!src || src.widget?.kind !== "chips") throw new Error(`no active chip "${label}"`);
  const c = src.widget.chips.find((x) => x.label === label)!;
  return chatReducer(s, { ...c.event, from: src.id } as ChatEvent);
}

const typedDay = (d: ISODate) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
// How a resident would type an on-the-hour time on its own: 7–11 → "7".."11", 12 → "12", 13–18 → "1".."6".
const typedHour = (m: number) => String(m / 60 > 12 ? m / 60 - 12 : m / 60);
// How a resident would type any time: "10:30 am".
const typedTime = (m: number) => formatTime(m).toLowerCase();
const openHours = (a: AmenityId, d: ISODate, tod?: TimeOfDay) =>
  slotsFor(a, d, [], NOW, tod).filter((x) => x.open).map((x) => x.time);
const days = (n: number) => Array.from({ length: n }, (_, i) => addDays(TODAY, i + 1));

function dayWith(pred: (d: ISODate) => boolean): ISODate {
  const d = days(59).find(pred);
  if (!d) throw new Error("no matching day");
  return d;
}

const OPEN_DAY = dayWith((d) => hasOpenSlot("tennis", d, [], NOW));
// An open start where a 1-hour booking fits.
const OPEN_TIME = openHours("tennis", OPEN_DAY).find((t) => lengthFits("tennis", OPEN_DAY, t, 60, []))!;

function bookTennis(): ChatState {
  let s = chatReducer(initChat(NOW), { type: "commonQuestion", text: RESERVE_QUESTION });
  s = tap(s, { type: "pickAmenity", amenity: "tennis" });
  s = tap(s, { type: "pickDate", date: OPEN_DAY }, "days");
  s = tap(s, { type: "pickSlot", date: OPEN_DAY, time: OPEN_TIME }, "slots");
  s = tap(s, { type: "pickLength", minutes: 60 }, "lengths");
  return tap(s, { type: "confirm" }, "summary");
}

function atSummary(): ChatState {
  let s = say(initChat(NOW), `tennis ${typedDay(OPEN_DAY)} at ${typedTime(OPEN_TIME)} for 1 hour`);
  expect(last(s).widget?.kind).toBe("summary");
  return s;
}

// ---- finding 1 / R8: off-topic is never a dead end ----

describe("off-topic (R8)", () => {
  const REPLY = "I can help you reserve an amenity. Tap below to get started.";
  const RESERVE_CHIP = { label: RESERVE_QUESTION, event: { type: "commonQuestion", text: RESERVE_QUESTION } };

  test("an off-topic common question first gets a Reserve chip that works", () => {
    let s = chatReducer(initChat(NOW), { type: "commonQuestion", text: COMMON_QUESTIONS[1] });
    expect(last(s)).toMatchObject({ role: "agent", text: REPLY, widget: { kind: "chips", chips: [RESERVE_CHIP] } });
    s = tapChip(s, RESERVE_QUESTION);
    expect(s.messages.at(-2)).toMatchObject({ role: "user", text: RESERVE_QUESTION });
    expect(last(s).widget).toEqual({ kind: "amenities" });
    expect(activeKinds(s)).toEqual(["amenities"]);
  });

  test("a Reserve chip from an inactive message is ignored", () => {
    let s = chatReducer(initChat(NOW), { type: "commonQuestion", text: COMMON_QUESTIONS[1] });
    const chipId = last(s).id;
    s = tapChip(s, RESERVE_QUESTION);
    const before = s;
    expect(chatReducer(before, { type: "commonQuestion", text: RESERVE_QUESTION, from: chipId })).toBe(before);
    expect(chatReducer(before, { type: "commonQuestion", text: RESERVE_QUESTION, from: 9999 })).toBe(before);
  });

  test("typed off-topic with nothing live gets the chip", () => {
    const s = say(initChat(NOW), "what is my balance?");
    expect(last(s)).toMatchObject({ text: REPLY, widget: { kind: "chips", chips: [RESERVE_CHIP] } });
  });

  test("typed off-topic after a booking keeps the live chips and adds none", () => {
    let s = bookTennis();
    s = say(s, "what is my balance?");
    expect(last(s)).toMatchObject({ role: "agent", text: REPLY });
    expect(last(s).widget).toBeUndefined();
    expect(activeKinds(s)).toEqual(["confirmation", "chips"]);
  });

  test("typed off-topic with a picker live keeps it live and adds no chip", () => {
    let s = chatReducer(initChat(NOW), { type: "commonQuestion", text: RESERVE_QUESTION });
    s = say(s, "how do I appeal a violation");
    expect(last(s)).toEqual({ id: last(s).id, role: "agent", text: REPLY, active: true });
    expect(activeKinds(s)).toEqual(["amenities"]);
  });
});

// ---- finding 2 ----

describe("explicit dates (finding 2)", () => {
  test("Saturday, Nov 14 books Nov 14", () => {
    const s = say(initChat(NOW), "tennis on Saturday, Nov 14");
    expect(lastAgentText(s)).toContain("Saturday, Nov 14"); // slots heading, or "fully booked on"
  });
});

// ---- finding 3 ----

describe("time-of-day filter (finding 3)", () => {
  const D = dayWith((d) => openHours("tennis", d, "morning").length > 0 && openHours("tennis", d, "afternoon").length > 0);

  test("the heading names the filter, and a different day clears it", () => {
    let s = chatReducer(initChat(NOW), { type: "commonQuestion", text: RESERVE_QUESTION });
    s = say(s, `tennis ${typedDay(D)} morning`);
    expect(s.messages.at(-2)?.text).toBe(`Here are the open morning start times for the Tennis Court on ${formatDayLong(D)}:`);
    expect(activeKinds(s)).toEqual(["slots", "chips"]);
    expect(widgetsOf(s, "slots").at(-1)?.widget).toEqual({ kind: "slots", amenity: "tennis", date: D, timeOfDay: "morning" });

    s = tapChip(s, "← Pick a different day");
    expect(s.draft.timeOfDay).toBeUndefined();
    expect(lastAgentText(s)).toBe("Which day would you like instead?");
    s = tap(s, { type: "pickDate", date: D }, "days");
    expect(s.messages.at(-2)?.text).toBe(`Here are the open start times for the Tennis Court on ${formatDayLong(D)}:`);
    expect(widgetsOf(s, "slots").at(-1)?.widget).toEqual({ kind: "slots", amenity: "tennis", date: D });
  });

  test("a tapped day clears the filter too", () => {
    let s = say(initChat(NOW), "tennis tomorrow morning");
    s = say(s, "different day");
    s = tap(s, { type: "pickDate", date: D }, "days");
    expect(s.draft.timeOfDay).toBeUndefined();
    expect(widgetsOf(s, "slots").at(-1)?.widget).toEqual({ kind: "slots", amenity: "tennis", date: D });
  });

  test("back to time and to amenity clear it", () => {
    let s = say(initChat(NOW), `tennis ${typedDay(D)} morning`);
    s = tapChip(s, "Change amenity");
    expect(s.draft.timeOfDay).toBeUndefined();
    s = say(initChat(NOW), `tennis ${typedDay(D)} morning`);
    s = tap(s, { type: "pickSlot", date: D, time: openHours("tennis", D, "morning")[0] }, "slots");
    s = tap(s, { type: "pickLength", minutes: 30 }, "lengths");
    s = tap(s, { type: "change" }, "summary");
    s = tapChip(s, "Different time");
    expect(s.draft.timeOfDay).toBeUndefined();
    expect(widgetsOf(s, "slots").at(-1)?.widget).toEqual({ kind: "slots", amenity: "tennis", date: D });
  });
});

// ---- finding 4 ----

describe("after a booking (finding 4)", () => {
  test("thanks gets You're welcome! and no second confirmation card", () => {
    let s = bookTennis();
    s = say(s, "thanks!");
    expect(lastAgentText(s)).toBe("You're welcome!");
    expect(widgetsOf(s, "confirmation")).toHaveLength(1);
    expect(activeKinds(s)).toEqual(["chips"]);
    expect(last(s).widget).toMatchObject({ kind: "chips", chips: [{ label: "Book another amenity" }, { label: "View my reservations" }] });
    s = say(s, "thank you");
    expect(lastAgentText(s)).toBe("You're welcome!");
    s = say(s, "ty");
    expect(lastAgentText(s)).toBe("You're welcome!");
    expect(widgetsOf(s, "confirmation")).toHaveLength(1);
  });

  test("not understood after a booking re-shows only the chips", () => {
    let s = bookTennis();
    s = say(s, "blorp");
    expect(widgetsOf(s, "confirmation")).toHaveLength(1);
    expect(activeKinds(s)).toEqual(["chips"]);
  });

  test("not understood after listing reservations does not copy the list", () => {
    let s = bookTennis();
    s = say(s, "show my reservation");
    expect(last(s).widget?.kind).toBe("reservations");
    s = say(s, "blorp");
    expect(widgetsOf(s, "reservations")).toHaveLength(1);
    expect(widgetsOf(s, "confirmation")).toHaveLength(1);
  });
});

// ---- finding 5 / R9 ----

describe("spec inputs (finding 5, R9)", () => {
  test("change the time / different day / go back step back like the back chips", () => {
    let s = atSummary();
    s = say(s, "change the time");
    expect(s.draft.time).toBeUndefined();
    expect(activeKinds(s)).toEqual(["slots", "chips"]);

    s = atSummary();
    s = say(s, "different day");
    expect(lastAgentText(s)).toBe("Which day would you like instead?");
    expect(last(s).widget).toEqual({ kind: "days", from: TODAY, count: 14 });
    expect(s.draft).toEqual({ amenity: "tennis", minutes: 60, guests: 1 });

    s = atSummary();
    s = say(s, "go back");
    expect(activeKinds(s)).toEqual(["lengths", "chips"]);
    s = say(s, "go back");
    expect(activeKinds(s)).toEqual(["slots", "chips"]);
    s = say(s, "go back");
    expect(last(s).widget?.kind).toBe("days");
    s = say(s, "go back");
    expect(last(s).widget).toEqual({ kind: "amenities" });
  });

  test("a bare hour while the slots show picks that time", () => {
    let s = say(initChat(NOW), `tennis ${typedDay(OPEN_DAY)}`);
    const h = openHours("tennis", OPEN_DAY).find((x) => x % 60 === 0 && x >= 420 && x <= 1080)!;
    s = say(s, typedHour(h));
    expect(widgetsOf(s, "lengths").at(-1)?.widget).toEqual({ kind: "lengths", amenity: "tennis", date: OPEN_DAY, time: h });
  });

  test("loose confirmations book", () => {
    for (const t of ["yes, book it", "yes please", "confirm please", "book it please", "looks good, thanks"]) {
      const s = say(atSummary(), t);
      expect(s.bookings, t).toHaveLength(1);
    }
  });

  test("next weekend shows that Saturday and Sunday", () => {
    const s = say(initChat(NOW), "tennis next weekend");
    expect(last(s).widget).toEqual({ kind: "days", from: "2026-11-07", count: 2 });
  });
});

// ---- finding 6 ----

describe("court with an amenity already set (finding 6)", () => {
  test("does not re-ask which court", () => {
    let s = say(initChat(NOW), "tennis");
    s = say(s, `is the court free ${typedDay(OPEN_DAY)}?`);
    expect(agentTexts(s)).not.toContain("Which court would you like?");
    expect(s.draft).toMatchObject({ amenity: "tennis", date: OPEN_DAY });
    expect(activeKinds(s)).toEqual(["slots", "chips"]);
  });
});

// ---- finding 7 ----

describe("slot list (finding 7)", () => {
  test("has back chips, and a tapped slot echoes day and time", () => {
    let s = say(initChat(NOW), "find tennis times next week");
    expect(activeKinds(s)).toEqual(["slotList", "chips"]);
    const [{ date, times: [h] }] = openSlotsInRange("tennis", { from: "2026-11-02", to: "2026-11-08" }, [], NOW);
    const picked = tap(s, { type: "pickSlot", date, time: h }, "slotList");
    expect(picked.messages.find((m) => m.role === "user" && m.id > last(s).id)?.text).toBe(`${formatDayLong(date)} at ${formatTime(h)}`);
    expect(activeKinds(picked)).toEqual(["lengths", "chips"]);
    s = tapChip(s, "← Pick a different day");
    expect(last(s).widget).toEqual({ kind: "days", from: TODAY, count: 14 });
    expect(s.draft.find).toBeFalsy();
  });

  test("an empty range says so and shows the 14-day strip", () => {
    const late = new Date(2026, 10, 1, 21, 0); // Sunday Nov 1, after the last tennis start
    const s = say(initChat(late), "find tennis times this weekend");
    expect(last(s).text).toBe("Tennis Court has no open times between Sunday, Nov 1 and Sunday, Nov 1.");
    expect(last(s).widget).toEqual({ kind: "days", from: "2026-11-01", count: 14 });
    expect(s.draft.range).toBeUndefined();
    expect(s.draft.find).toBeFalsy();
  });
});

// ---- minors ----

describe("guest clamp", () => {
  test("typed guests over the max say so", () => {
    const s = say(initChat(NOW), `tennis ${typedDay(OPEN_DAY)} for 9 people`);
    expect(lastAgentText(s)?.startsWith("The Tennis Court allows up to 4 guests, so I've set it to 4.")).toBe(true);
    expect(s.draft.guests).toBe(4);
  });
});

// ---- R10: swap point ----

describe("swap point (R10)", () => {
  test("a result for an old turn is ignored; the matching one is applied once", () => {
    let s = chatReducer(initChat(NOW), { type: "commonQuestion", text: RESERVE_QUESTION });
    const turn = s.nextId;
    s = chatReducer(s, { type: "userText", text: "tennis" });
    expect(s.pendingTurn).toBe(turn);
    const result = parseMessage("tennis", TODAY);
    const before = s;
    expect(chatReducer(before, { type: "interpreted", result, turn: turn - 1 })).toBe(before);
    expect(chatReducer(before, { type: "interpretFailed", turn: turn + 1 })).toBe(before);
    s = chatReducer(before, { type: "interpreted", result, turn });
    expect(s.pending).toBe(false);
    expect(s.draft.amenity).toBe("tennis");
    expect(chatReducer(s, { type: "interpreted", result: parseMessage("pickleball", TODAY), turn })).toBe(s);
    expect(chatReducer(s, { type: "interpretFailed", turn })).toBe(s);
  });

  test("the reader's reply keeps the reducer's own notices in front", () => {
    const run = (s: ChatState, text: string, reply: string) => {
      const turn = s.nextId;
      s = chatReducer(s, { type: "userText", text });
      return chatReducer(s, { type: "interpreted", result: { ...parseMessage(text, TODAY), reply }, turn });
    };
    // taken hour
    const D = dayWith((d) => slotsFor("tennis", d, [], NOW).some((x) => !x.open) && hasOpenSlot("tennis", d, [], NOW));
    const taken = slotsFor("tennis", D, [], NOW).find((x) => !x.open)!.time;
    let s = run(initChat(NOW), `tennis ${typedDay(D)} at ${typedTime(taken)}`, "Here you go.");
    expect(lastAgentText(s)).toBe(`${formatTime(taken)} isn't available. Here you go.`);
    // fully booked
    const full = dayWith((d) => !hasOpenSlot("tennis", d, [], NOW));
    s = run(initChat(NOW), `tennis ${typedDay(full)}`, "Pick again?");
    expect(lastAgentText(s)).toBe(`Tennis Court is fully booked on ${formatDayLong(full)}. Pick again?`);
    // closest start + guests clamped
    s = run(initChat(NOW), `tennis ${typedDay(OPEN_DAY)} for 9 people at ${typedTime(OPEN_TIME + 15)}`, "Okay.");
    expect(lastAgentText(s)).toBe(
      `The closest start is ${formatTime(OPEN_TIME)}. The Tennis Court allows up to 4 guests, so I've set it to 4. Okay.`,
    );
  });

  test("the context names the newest active widget", () => {
    let s = say(initChat(NOW), `tennis ${typedDay(OPEN_DAY)}`);
    expect(contextFor(s, NOW)).toEqual({ draft: s.draft, today: TODAY, history: s.messages, activeWidget: "chips" });
    s = tap(s, { type: "pickSlot", date: OPEN_DAY, time: OPEN_TIME }, "slots");
    expect(contextFor(s, NOW).activeWidget).toBe("chips"); // the lengths, then their "← Pick a different time" chip
    s = tap(s, { type: "pickLength", minutes: 60 }, "lengths");
    expect(contextFor(s, NOW).activeWidget).toBe("summary");
    expect(contextFor(initChat(NOW), NOW).activeWidget).toBeUndefined();
  });

  test("an event's now moves the clock", () => {
    const tomorrow = new Date(2026, 9, 30, 8, 0);
    let s = chatReducer(initChat(NOW), { type: "commonQuestion", text: RESERVE_QUESTION, now: tomorrow });
    s = chatReducer(s, { type: "pickAmenity", amenity: "tennis", from: last(s).id, now: tomorrow });
    expect(s.now).toBe(tomorrow);
    expect(last(s).widget).toEqual({ kind: "days", from: "2026-10-30", count: 14 });
    // an ignored event changes nothing, clock included
    expect(chatReducer(s, { type: "confirm", from: 9999, now: new Date(2026, 10, 5) })).toBe(s);
  });
});

// ---- booking length ----

describe("booking length", () => {
  test("day, time and length in one message reach the summary", () => {
    const s = say(initChat(NOW), `tennis ${typedDay(OPEN_DAY)} at ${typedTime(OPEN_TIME)} for 1 hour`);
    expect(last(s).widget).toMatchObject({ kind: "summary", time: OPEN_TIME, minutes: 60 });
  });

  test("a length that isn't in 30-minute steps is refused, with the tiles", () => {
    let s = say(initChat(NOW), `tennis ${typedDay(OPEN_DAY)} at ${typedTime(OPEN_TIME)}`);
    expect(widgetsOf(s, "lengths")).toHaveLength(1);
    s = say(s, "for 45 minutes");
    expect(lastAgentText(s)).toBe("Bookings go in 30-minute steps. How long would you like the Tennis Court?");
    expect(activeKinds(s)).toEqual(["lengths", "chips"]);
  });

  test("a kept length over a new amenity's limit is not offered", () => {
    const D = dayWith((d) => hasOpenSlot("clubhouse", d, [], NOW) && hasOpenSlot("tennis", d, [], NOW));
    let s = say(initChat(NOW), "clubhouse for 5 hours");
    expect(s.draft).toMatchObject({ amenity: "clubhouse", minutes: 300 });
    s = tap(s, { type: "pickDate", date: D }, "days");
    s = say(s, "actually tennis");
    expect(s.draft).toMatchObject({ amenity: "tennis", date: D });
    s = tap(s, { type: "pickSlot", date: D, time: openHours("tennis", D)[0] }, "slots");
    expect(lastAgentText(s)).toBe("The Tennis Court can be booked for up to 2 hrs. How long would you like the Tennis Court?");
    expect(activeKinds(s)).toEqual(["lengths", "chips"]);
    expect(s.messages.some((m) => m.widget?.kind === "summary" && m.widget.minutes === 300)).toBe(false);
  });

  test("a typed quarter-hour snaps down with a notice", () => {
    const D = dayWith((d) => openHours("tennis", d).includes(600));
    let s = say(initChat(NOW), `tennis ${typedDay(D)}`);
    s = say(s, "10:15");
    expect(lastAgentText(s)).toBe("The closest start is 10:00 AM. How long would you like the Tennis Court?");
  });

  test("longer goes back to the length tiles", () => {
    const s = say(atSummary(), "can it be longer?");
    expect(activeKinds(s)).toEqual(["lengths", "chips"]);
    expect(s.draft.time).toBe(OPEN_TIME);
  });
});
