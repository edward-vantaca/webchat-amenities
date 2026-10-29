import { getAmenity } from "./amenities";
import { hasOpenSlot, slotsFor } from "./availability";
import { addDays, formatDayLong, formatHour, lastBookable, toISODate } from "./dates";
import type {
  AmenityId, Booking, ChatEvent, ChatMessage, ChatState, Chip, DateRange, Draft, Interpretation, ISODate, Widget,
} from "./types";

export const RESERVE_QUESTION = "Reserve an amenity for me";
export const COMMON_QUESTIONS: string[] = [
  RESERVE_QUESTION,
  "What is my current account balance?",
  "How do I submit an architectural modification (ARC) request and track status?",
  "I received a violation—what is it for and how do I resolve/appeal it?",
  "What is the process to request a new pool key?",
];

const NOT_UNDERSTOOD = "Sorry, I didn't catch that. You can pick from the options below.";
const OUT_OF_WINDOW = "I can only book up to 60 days ahead.";
const ERROR_REPLY = "Something went wrong, please try again.";
const OFF_TOPIC = 'I can help you reserve an amenity. Tap "Reserve an amenity for me" to get started.';

export function initChat(now: Date): ChatState {
  return { now, messages: [], draft: { guests: 1 }, bookings: [], pending: false, nextId: 1 };
}

// ---- message helpers ----

type NewMessage = Omit<ChatMessage, "id" | "active">;
type TapEvent = Extract<ChatEvent, { from: number }>;

// Chip events carry `from: 0`; the ChipRow widget fills in its own message id before dispatching.
const chip = (label: string, event: ChatEvent): Chip => ({ label, event });

function append(state: ChatState, messages: NewMessage[]): ChatState {
  const added = messages.map((m, i) => ({ ...m, id: state.nextId + i, active: true }));
  return { ...state, messages: [...state.messages, ...added], nextId: state.nextId + added.length };
}

// Deactivates every existing message, then echoes the tap (if any) as the resident's bubble.
function startTurn(state: ChatState, echo?: string): ChatState {
  const s = { ...state, messages: state.messages.map((m) => (m.active ? { ...m, active: false } : m)) };
  return echo === undefined ? s : append(s, [{ role: "user", text: echo }]);
}

function without(draft: Draft, ...keys: (keyof Draft)[]): Draft {
  const d = { ...draft };
  for (const k of keys) delete d[k];
  return d;
}

function clampGuests(guests: number, amenity?: AmenityId): number {
  const max = amenity ? getAmenity(amenity).maxGuests : Infinity;
  return Math.min(Math.max(1, Math.round(guests)), max);
}

const today = (state: ChatState) => toISODate(state.now);
const monthOf = (date: ISODate) => `${date.slice(0, 8)}01`;

// ---- advance: the prompt for the first missing piece ----

type PromptOptions = { ambiguous?: boolean; notes?: string[]; reply?: string };

function dayStrip(draft: Draft, todayISO: ISODate): Widget {
  if (draft.range) {
    const from = draft.range.from > todayISO ? draft.range.from : todayISO;
    let count = 0;
    for (let d = from; d <= draft.range.to; d = addDays(d, 1)) count++;
    if (count > 0) return { kind: "days", from, count };
  }
  return { kind: "days", from: todayISO, count: 14 };
}

function prompt(state: ChatState, draft: Draft, opts: PromptOptions): { draft: Draft; messages: NewMessage[] } {
  const notes = [...(opts.notes ?? [])];
  const say = (d: Draft, text: string, widget: Widget, extra: NewMessage[] = []) => ({
    draft: d,
    messages: [{ role: "agent" as const, text: opts.reply ?? [...notes, text].join(" "), widget }, ...extra],
  });
  const todayISO = today(state);

  if (opts.ambiguous) return say(draft, "Which court would you like?", { kind: "amenities" });
  if (!draft.amenity) return say(draft, "Happy to help! Which amenity would you like to reserve?", { kind: "amenities" });
  const a = getAmenity(draft.amenity);

  if (draft.find && draft.range) {
    return say(without(draft, "find"), `Here are the open times for ${a.name}:`, {
      kind: "slotList", amenity: a.id, range: draft.range,
    });
  }
  if (!draft.date) {
    const text = draft.range
      ? "What day works for you?"
      : "Great choice. What day works for you? Tap a day or type one, like “Saturday”.";
    return say(draft, text, dayStrip(draft, todayISO));
  }
  if (!hasOpenSlot(a.id, draft.date, state.bookings, state.now)) {
    const d = without(draft, "date", "time");
    return say(d, `${a.name} is fully booked on ${formatDayLong(draft.date)}. Please pick another day.`, dayStrip(d, todayISO));
  }

  const slots = slotsFor(a.id, draft.date, state.bookings, state.now);
  const timeOpen = slots.some((s) => s.hour === draft.time && s.open);
  if (!timeOpen) {
    if (draft.time !== undefined) notes.push(`${formatHour(draft.time)} isn't available.`);
    const d = without(draft, "time");
    const { timeOfDay } = d;
    const filtered = timeOfDay && slotsFor(a.id, d.date!, state.bookings, state.now, timeOfDay).some((s) => s.open);
    const widget: Widget = filtered
      ? { kind: "slots", amenity: a.id, date: d.date!, timeOfDay }
      : { kind: "slots", amenity: a.id, date: d.date! };
    const backChips: NewMessage = {
      role: "agent",
      widget: {
        kind: "chips",
        chips: [
          chip("← Pick a different day", { type: "back", to: "day", from: 0 }),
          chip("Change amenity", { type: "back", to: "amenity", from: 0 }),
        ],
      },
    };
    return say(d, `Here are the open ${a.hours}-hour slots for the ${a.name} on ${formatDayLong(d.date!)}:`, widget, [backChips]);
  }

  return say(draft, "Here's your reservation. Does this look right?", {
    kind: "summary", amenity: a.id, date: draft.date, time: draft.time!, guests: clampGuests(draft.guests, a.id),
  });
}

// Appends the next prompt. Callers run startTurn first, so deactivation happens only before appending.
function advance(state: ChatState, draft: Draft, opts: PromptOptions = {}): ChatState {
  const next = prompt(state, draft, opts);
  return append({ ...state, draft: next.draft }, next.messages);
}

// Not understood / error: say so and re-show copies of the live picker (and its chips).
function reshow(state: ChatState, text: string): ChatState {
  const live = state.messages.filter((m) => m.active && m.widget);
  if (live.length === 0) return advance(startTurn(state), state.draft, { reply: text });
  const copies = live.map((m, i): NewMessage => {
    const copyText = i === 0 ? text : m.text;
    return copyText === undefined ? { role: m.role, widget: m.widget } : { role: m.role, text: copyText, widget: m.widget };
  });
  return append(startTurn(state), copies);
}

// ---- confirmation and reservations ----

function confirmationNumber(nextId: number, date: ISODate, time: number): string {
  const seed = Number(date.replace(/-/g, "")) + nextId * 7919 + time * 31;
  return `RS${10000 + (seed % 90000)}`;
}

function confirm(state: ChatState, summary: ChatMessage, echo?: string): ChatState {
  if (summary.widget?.kind !== "summary") return state;
  const { amenity, date, time, guests } = summary.widget;
  const booking: Booking = { confirmation: confirmationNumber(state.nextId, date, time), amenity, date, time, guests };
  const s = startTurn({ ...state, bookings: [...state.bookings, booking], draft: { guests: 1 } }, echo);
  return append(s, [
    { role: "agent", text: "You're all set!", widget: { kind: "confirmation", booking } },
    {
      role: "agent",
      widget: {
        kind: "chips",
        chips: [
          chip("Book another amenity", { type: "bookAnother", from: 0 }),
          chip("View my reservations", { type: "listReservations", from: 0 }),
        ],
      },
    },
  ]);
}

// Informational: earlier pickers stay live so the resident is never stranded.
function listReservations(state: ChatState, reply?: string): ChatState {
  if (state.bookings.length === 0) {
    return append(state, [{ role: "agent", text: reply ?? "You don't have any reservations yet." }]);
  }
  return append(state, [
    { role: "agent", text: reply ?? "Here are your reservations:", widget: { kind: "reservations", bookings: state.bookings } },
  ]);
}

// ---- typed input ----

function onInterpreted(state: ChatState, r: Interpretation): ChatState {
  const todayISO = today(state);
  switch (r.intent) {
    case "unknown":
      return reshow(state, r.reply ?? NOT_UNDERSTOOD);
    case "offTopic":
      return append(state, [{ role: "agent", text: r.reply ?? OFF_TOPIC }]);
    case "listReservations":
      return listReservations(state, r.reply);
    case "confirm": {
      const summary = state.messages.find((m) => m.active && m.widget?.kind === "summary");
      return summary ? confirm(state, summary) : reshow(state, r.reply ?? NOT_UNDERSTOOD);
    }
  }

  const s = r.slots;
  let d: Draft = r.intent === "changeDay" ? without(state.draft, "time") : { ...state.draft };
  if (s.amenity) d.amenity = s.amenity;
  if (s.date) d = { ...without(d, "range"), date: s.date };
  if (s.time !== undefined) d.time = s.time;
  if (s.timeOfDay) d.timeOfDay = s.timeOfDay;
  if (s.guests !== undefined) d.guests = s.guests;
  if (r.range) d = { ...without(d, "date"), range: r.range };
  if (r.intent === "find" && !s.date) {
    const range: DateRange = r.range ?? { from: todayISO, to: addDays(todayISO, 6) };
    d = { ...without(d, "date", "time"), range, find: true };
  }
  d.guests = clampGuests(d.guests, d.amenity);

  if (r.outOfWindow) {
    d = without(d, "date", "time", "range", "find");
    return advance(startTurn(state), d, { reply: r.reply ?? OUT_OF_WINDOW });
  }

  const notes = r.snappedFrom && s.time !== undefined ? [`The closest start is ${formatHour(s.time)}.`] : [];
  return advance(startTurn(state), d, { ambiguous: r.ambiguous === "court" && !s.amenity, notes, reply: r.reply });
}

// ---- taps ----

const SOURCE_KINDS: Record<TapEvent["type"], Widget["kind"][]> = {
  pickAmenity: ["amenities"],
  pickDate: ["days", "calendar"],
  openCalendar: ["days"],
  calendarMonth: ["calendar"],
  pickSlot: ["slots", "slotList"],
  setGuests: ["summary"],
  confirm: ["summary"],
  change: ["summary"],
  back: ["chips"],
  bookAnother: ["chips"],
  listReservations: ["chips"],
};

const BACK_LABELS = { time: "Different time", day: "Different day", amenity: "Different amenity" } as const;

function chipLabel(source: ChatMessage, matches: (e: ChatEvent) => boolean, fallback: string): string {
  const chips = source.widget?.kind === "chips" ? source.widget.chips : [];
  return chips.find((c) => matches(c.event))?.label ?? fallback;
}

function onTap(state: ChatState, event: TapEvent, source: ChatMessage): ChatState {
  const { draft } = state;
  switch (event.type) {
    case "pickAmenity": {
      const d = { ...draft, amenity: event.amenity, guests: clampGuests(draft.guests, event.amenity) };
      return advance(startTurn(state, getAmenity(event.amenity).name), d);
    }
    case "pickDate": {
      const d = { ...without(draft, "range", "find"), date: event.date }; // keeps a typed time (R6)
      return advance(startTurn(state, formatDayLong(event.date)), d);
    }
    case "openCalendar": {
      if (state.messages.some((m) => m.active && m.widget?.kind === "calendar")) return state;
      return append(state, [{ role: "agent", widget: { kind: "calendar", month: monthOf(today(state)) } }]);
    }
    case "calendarMonth": {
      const min = monthOf(today(state));
      const max = monthOf(lastBookable(today(state)));
      if (event.month !== monthOf(event.month) || event.month < min || event.month > max) return state;
      const messages = state.messages.map((m) =>
        m.id === source.id ? { ...m, widget: { kind: "calendar" as const, month: event.month } } : m);
      return { ...state, messages };
    }
    case "pickSlot": {
      const d = { ...without(draft, "range", "find"), date: event.date, time: event.time };
      return advance(startTurn(state, formatHour(event.time)), d);
    }
    case "setGuests": {
      if (source.widget?.kind !== "summary") return state;
      const guests = clampGuests(event.guests, source.widget.amenity);
      const widget = { ...source.widget, guests };
      const messages = state.messages.map((m) => (m.id === source.id ? { ...m, widget } : m));
      return { ...state, messages, draft: { ...draft, guests } };
    }
    case "confirm":
      return confirm(state, source, "Confirm");
    case "change":
      return append(startTurn(state, "Change"), [{
        role: "agent",
        text: "What would you like to change?",
        widget: {
          kind: "chips",
          chips: [
            chip(BACK_LABELS.time, { type: "back", to: "time", from: 0 }),
            chip(BACK_LABELS.day, { type: "back", to: "day", from: 0 }),
            chip(BACK_LABELS.amenity, { type: "back", to: "amenity", from: 0 }),
          ],
        },
      }]);
    case "back": {
      const d =
        event.to === "time" ? without(draft, "time")
        : event.to === "day" ? without(draft, "date", "time", "range", "find")
        : without(draft, "amenity");
      const label = chipLabel(source, (e) => e.type === "back" && e.to === event.to, BACK_LABELS[event.to]);
      return advance(startTurn(state, label), d);
    }
    case "bookAnother": {
      const label = chipLabel(source, (e) => e.type === "bookAnother", "Book another amenity");
      return advance(startTurn(state, label), { guests: 1 });
    }
    case "listReservations": {
      const label = chipLabel(source, (e) => e.type === "listReservations", "View my reservations");
      return listReservations(append(state, [{ role: "user", text: label }]));
    }
  }
}

// ---- reducer ----

export function chatReducer(state: ChatState, event: ChatEvent): ChatState {
  switch (event.type) {
    case "commonQuestion": {
      if (event.text === RESERVE_QUESTION) return advance(startTurn(state, event.text), state.draft);
      return append(state, [{ role: "user", text: event.text }, { role: "agent", text: OFF_TOPIC }]);
    }
    case "userText":
      return { ...append(state, [{ role: "user", text: event.text }]), pending: true };
    case "interpreted":
      return onInterpreted({ ...state, pending: false }, event.result);
    case "interpretFailed":
      return reshow({ ...state, pending: false }, ERROR_REPLY);
  }
  const source = state.messages.find((m) => m.id === event.from && m.active);
  if (!source?.widget || !SOURCE_KINDS[event.type].includes(source.widget.kind)) return state;
  return onTap(state, event, source);
}
