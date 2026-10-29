import { AMENITIES } from "./amenities";
import { addDays, fromISODate, inWindow, nextWeek, toISODate, weekday } from "./dates";
import type { AmenityId, ChangeTarget, DateRange, Draft, ISODate, Intent, Interpretation, TimeOfDay } from "./types";

type Slots = Interpretation["slots"];
type DateRead = { date?: ISODate; range?: DateRange; timeOfDay?: TimeOfDay };
type TimeRead = { time?: number; snappedFrom?: string };

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTH_PREFIXES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAY_RE = WEEKDAYS.join("|");
const MONTH_RE = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---- amenity ----

function readAmenity(text: string): { amenity?: AmenityId; ambiguous?: "court" } {
  const hit = AMENITIES.find((a) => a.aliases.some((alias) => new RegExp(`\\b${escapeRe(alias)}\\b`).test(text)));
  if (hit) return { amenity: hit.id };
  if (/\bcourt\b/.test(text)) return { ambiguous: "court" };
  return {};
}

// ---- date ----

const nextWeekdayOnOrAfter = (today: ISODate, day: number): ISODate => addDays(today, (day - weekday(today) + 7) % 7);

// Builds a real calendar date, or undefined when the day does not exist (e.g. Feb 30).
function validDate(year: number, month: number, day: number): ISODate | undefined {
  const d = new Date(year, month, day);
  return d.getMonth() === month && d.getDate() === day ? toISODate(d) : undefined;
}

function monthDay(today: ISODate, month: number, day: number): ISODate | undefined {
  const year = fromISODate(today).getFullYear();
  const thisYear = validDate(year, month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return validDate(year + 1, month, day);
}

// "the 14th": next occurrence on or after today, skipping months without that day.
function dayOfMonth(today: ISODate, day: number): ISODate | undefined {
  const start = fromISODate(today);
  for (let i = 0; i < 12; i++) {
    const m = start.getMonth() + i;
    const date = validDate(start.getFullYear() + Math.floor(m / 12), m % 12, day);
    if (date && date >= today) return date;
  }
  return undefined;
}

function weekendRange(today: ISODate): DateRange {
  const day = weekday(today);
  if (day === 0) return { from: today, to: today };
  const from = nextWeekdayOnOrAfter(today, 6);
  return { from, to: addDays(from, 1) };
}

// An explicit date ("Saturday, Nov 14", "11/14", "the 14th") wins over a weekday word next to it.
function readExplicitDate(text: string, today: ISODate): ISODate | undefined {
  const monthName = text.match(new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  if (monthName) return monthDay(today, MONTH_PREFIXES.indexOf(monthName[1].slice(0, 3)), Number(monthName[2]));
  const numeric = text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (numeric) return monthDay(today, Number(numeric[1]) - 1, Number(numeric[2]));
  const ordinal = text.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/);
  if (ordinal) return dayOfMonth(today, Number(ordinal[1]));
  return undefined;
}

function readDate(text: string, today: ISODate): DateRead {
  if (/\btonight\b/.test(text)) return { date: today, timeOfDay: "evening" };
  if (/\btoday\b/.test(text)) return { date: today };
  if (/\btomorrow\b/.test(text)) return { date: addDays(today, 1) };
  if (/\bthis weekend\b/.test(text)) return { range: weekendRange(today) };
  if (/\bnext weekend\b/.test(text)) {
    const saturday = addDays(nextWeek(today).from, 5);
    return { range: { from: saturday, to: addDays(saturday, 1) } };
  }
  if (/\bnext week\b/.test(text)) return { range: nextWeek(today) };

  const explicit = readExplicitDate(text, today);
  if (explicit) return { date: explicit };

  const nextDay = text.match(new RegExp(`\\bnext (${WEEKDAY_RE})\\b`));
  if (nextDay) {
    const offset = (WEEKDAYS.indexOf(nextDay[1]) + 6) % 7; // Monday = 0
    return { date: addDays(nextWeek(today).from, offset) };
  }
  const named = text.match(new RegExp(`\\b(?:this )?(${WEEKDAY_RE})\\b`));
  if (named) return { date: nextWeekdayOnOrAfter(today, WEEKDAYS.indexOf(named[1])) };
  return {};
}

function readTimeOfDay(text: string): TimeOfDay | undefined {
  const m = text.match(/\b(morning|afternoon|evening)\b/);
  return m ? (m[1] as TimeOfDay) : undefined;
}

// ---- time ----

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function snap(hour: number, minutes: string | undefined, original: string): TimeRead {
  return minutes && minutes !== "00" ? { time: hour, snappedFrom: clean(original) } : { time: hour };
}

// A bare hour: 1–6 → PM, 7–11 → AM, 12 → noon.
function bareHour(h: number, minutes: string | undefined, original: string): TimeRead {
  if (h === 12) return snap(12, minutes, original);
  if (h >= 1 && h <= 6) return snap(h + 12, minutes, original);
  if (h >= 7 && h <= 11) return snap(h, minutes, original);
  return {};
}

function readTime(text: string): TimeRead {
  if (/\bnoon\b/.test(text)) return { time: 12 };

  const meridiem = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (meridiem) {
    const hour = (Number(meridiem[1]) % 12) + (meridiem[3] === "pm" ? 12 : 0);
    return snap(hour, meridiem[2], meridiem[0]);
  }

  const bare = text.match(/(?:\bat|@)\s*(\d{1,2})(?::(\d{2}))?\b/);
  if (bare) return bareHour(Number(bare[1]), bare[2], bare[0]);

  // "10" or "10:30" as the whole message (R9).
  const whole = text.match(/^(\d{1,2})(?::(\d{2}))?[\s.!]*$/);
  if (whole) return bareHour(Number(whole[1]), whole[2], `${whole[1]}${whole[2] ? `:${whole[2]}` : ""}`);
  return {};
}

// ---- guests ----

function readGuests(text: string): number | undefined {
  const m = text.match(/\b(\d+)\s+(?:people|persons|guests?)\b/) ?? text.match(/\bparty of (\d+)\b/);
  return m ? Number(m[1]) : undefined;
}

// ---- intent ----

// One or more of these words, separated by spaces/commas, with at least one real "yes".
const CONFIRM_RE = /^(?:(?:yes|yep|confirm|book it|looks good|please|thanks|thank you)[\s,.!]*)+$/;
const AFFIRM_RE = /\b(?:yes|yep|confirm|book it|looks good)\b/;
const THANKS_RE = /^(?:thanks|thank you|ty)(?: so much)?[\s,.!]*$/;
const LIST_RE = /\bmy (?:reservations?|bookings?)\b/;
const FIND_RE = /\b(?:find|show|availability|open times)\b|\bwhen\b.*\bavailable\b/;
const CHANGE_RE = /\b(?:different|another|change|instead|actually)\b/;
const BOOK_RE = /\b(?:reserve|book)\b/;
const OFF_TOPIC_RE = /\b(?:balance|arc|violation|pool key)\b/;
const STEP_RE = /\b(?:change|different|another|back)\b.*\b(time|day|date|amenity)\b/;
const GO_BACK_RE = /^go back[\s.!]*$/;
const CHANGE_INTENT: Record<ChangeTarget, Intent> = { amenity: "changeAmenity", day: "changeDay", time: "changeTime" };

// The most recent step of the booking in progress: the last slot filled, in amenity → day → time order.
function lastStep(draft?: Draft): ChangeTarget {
  if (draft?.time !== undefined && draft.date) return "time";
  if (draft?.date || draft?.range) return "day";
  return "amenity";
}

// "change the time", "different day", "back to amenity", bare "go back". A message that also
// gives a new value for that step ("change the day to friday") is a plain change instead.
function readChangeTarget(text: string, slots: Slots, draft?: Draft): ChangeTarget | undefined {
  if (GO_BACK_RE.test(text)) return lastStep(draft);
  const m = text.match(STEP_RE);
  if (!m) return undefined;
  const target: ChangeTarget = m[1] === "date" ? "day" : (m[1] as ChangeTarget);
  const given = target === "amenity" ? slots.amenity : target === "day" ? slots.date : slots.time;
  return given === undefined ? target : undefined;
}

function readIntent(text: string, found: { slots: Slots; range?: DateRange; ambiguous?: "court" }): Intent {
  const { slots, range, ambiguous } = found;
  if (CONFIRM_RE.test(text) && AFFIRM_RE.test(text)) return "confirm";
  if (THANKS_RE.test(text)) return "thanks";
  if (LIST_RE.test(text)) return "listReservations";
  if (FIND_RE.test(text)) return "find";
  if (CHANGE_RE.test(text)) {
    if (slots.amenity) return "changeAmenity";
    if (slots.date) return "changeDay";
    if (slots.time !== undefined) return "changeTime";
  }
  if (Object.keys(slots).length > 0 || range || ambiguous || BOOK_RE.test(text)) return "book";
  if (OFF_TOPIC_RE.test(text)) return "offTopic";
  return "unknown";
}

// ---- entry point ----

// `draft` (optional) lets a bare "go back" step back from wherever the booking is.
export function parseMessage(input: string, today: ISODate, draft?: Draft): Interpretation {
  const text = input.trim().toLowerCase();
  const { amenity, ambiguous } = readAmenity(text);
  const { date, range, timeOfDay: dateTimeOfDay } = readDate(text, today);
  const { time, snappedFrom } = readTime(text);
  const timeOfDay = dateTimeOfDay ?? readTimeOfDay(text);
  const guests = readGuests(text);

  const slots: Slots = {};
  if (amenity) slots.amenity = amenity;
  if (date) slots.date = date;
  if (time !== undefined) slots.time = time;
  if (timeOfDay) slots.timeOfDay = timeOfDay;
  if (guests !== undefined) slots.guests = guests;

  const changeTarget = readChangeTarget(text, slots, draft);
  const intent = changeTarget ? CHANGE_INTENT[changeTarget] : readIntent(text, { slots, range, ambiguous });
  const result: Interpretation = { intent, slots };
  if (changeTarget) result.changeTarget = changeTarget;
  if (range) result.range = range;
  if (snappedFrom) result.snappedFrom = snappedFrom;
  if (ambiguous) result.ambiguous = ambiguous;
  if (date && !inWindow(date, today)) result.outOfWindow = true;
  return result;
}
