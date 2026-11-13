import { AMENITIES } from "@/booking/amenities";
import { getAmenity } from "@/booking/amenities";
import { LENGTH_STEP, hasOpenSlot, lengthFits, slotsFor } from "@/booking/availability";
import { formatLength, formatTime, fromISODate, inWindow, toISODate } from "@/booking/dates";
import type { AmenityId, Booking, ISODate } from "@/booking/types";

export type Step = "amenity" | "date" | "time" | "length" | "review";
// `time` is minutes since midnight; `minutes` is the booking length.
export type LinkDraft = { amenity?: AmenityId; date?: ISODate; time?: number; minutes?: number };
export type DropNote =
  | { reason: "amenity" }
  | { reason: "date" }
  | { reason: "timeInvalid" } // a time the page can't read, e.g. "10am", "25" or "10:60"
  | { reason: "timeTaken"; time: number }
  | { reason: "timeUnavailable"; time: number } // not a start time that day, e.g. 10:15 or after closing
  | { reason: "lengthInvalid" } // not a whole number of half-hours within the amenity's limit
  | { reason: "lengthDoesntFit"; minutes: number };
export type ParsedLink = { token?: string; draft: LinkDraft; note?: DropNote };

const isRealDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && toISODate(fromISODate(s)) === s;

// "10:30" or a bare hour "10" (links sent before lengths existed) → minutes since midnight.
function readTime(raw: string): number | undefined {
  const m = raw.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return undefined;
  const [h, min] = [Number(m[1]), Number(m[2] ?? 0)];
  return h <= 23 && min <= 59 ? h * 60 + min : undefined;
}

const clock24 = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// Reads amenity → date → time → length in order and stops at the first value that is missing or can't be used.
// A value that can't be used is dropped, with a note saying why; a missing one just ends the read.
export function parseLink(search: string, bookings: Booking[], now: Date): ParsedLink {
  const q = new URLSearchParams(search);
  const token = q.get("token") ?? undefined;
  const out = (draft: LinkDraft, note?: DropNote): ParsedLink => ({
    ...(token !== undefined && { token }),
    draft,
    ...(note && { note }),
  });

  const rawAmenity = q.get("amenity");
  if (!rawAmenity) return out({});
  const amenity = AMENITIES.find((a) => a.id === rawAmenity.toLowerCase())?.id;
  if (!amenity) return out({}, { reason: "amenity" });

  const date = q.get("date");
  if (!date) return out({ amenity });
  if (!isRealDate(date) || !inWindow(date, toISODate(now)) || !hasOpenSlot(amenity, date, bookings, now)) {
    return out({ amenity }, { reason: "date" });
  }

  const rawTime = q.get("time") ?? "";
  if (!rawTime) return out({ amenity, date });
  const time = readTime(rawTime);
  if (time === undefined) return out({ amenity, date }, { reason: "timeInvalid" });
  const slot = slotsFor(amenity, date, bookings, now).find((s) => s.time === time);
  if (!slot) return out({ amenity, date }, { reason: "timeUnavailable", time });
  if (!slot.open) return out({ amenity, date }, { reason: "timeTaken", time });

  const rawLength = q.get("length") ?? "";
  if (!rawLength) return out({ amenity, date, time });
  const minutes = Number(rawLength);
  if (!/^\d+$/.test(rawLength) || minutes < LENGTH_STEP || minutes % LENGTH_STEP !== 0 || minutes > getAmenity(amenity).maxMinutes) {
    return out({ amenity, date, time }, { reason: "lengthInvalid" });
  }
  if (!lengthFits(amenity, date, time, minutes, bookings)) return out({ amenity, date, time }, { reason: "lengthDoesntFit", minutes });
  return out({ amenity, date, time, minutes });
}

export function toSearch(token: string | undefined, draft: LinkDraft): string {
  const q = new URLSearchParams();
  if (token !== undefined) q.set("token", token);
  if (draft.amenity) q.set("amenity", draft.amenity);
  if (draft.date) q.set("date", draft.date);
  if (draft.time !== undefined) q.set("time", clock24(draft.time));
  if (draft.minutes !== undefined) q.set("length", String(draft.minutes));
  // ":" is fine in a query, and "time=10:30" reads better than "time=10%3A30" in a texted link.
  const s = q.toString().replace(/%3A/g, ":");
  return s ? `?${s}` : "";
}

export function stepOf(draft: LinkDraft): Step {
  if (!draft.amenity) return "amenity";
  if (!draft.date) return "date";
  if (draft.time === undefined) return "time";
  if (draft.minutes === undefined) return "length";
  return "review";
}

export function stepBack(draft: LinkDraft): LinkDraft {
  if (draft.minutes !== undefined) return { amenity: draft.amenity, date: draft.date, time: draft.time };
  if (draft.time !== undefined) return { amenity: draft.amenity, date: draft.date };
  if (draft.date) return { amenity: draft.amenity };
  return {};
}

export function noteText(note: DropNote): string {
  switch (note.reason) {
    case "amenity":
      return "We couldn't find that amenity. Pick one below.";
    case "date":
      return "That date isn't available. Pick another day.";
    case "timeInvalid":
      return "That time isn't available. Pick another time.";
    case "timeTaken":
      return `${formatTime(note.time)} is taken that day. Pick another time.`;
    case "timeUnavailable":
      return `${formatTime(note.time)} isn't available that day. Pick another time.`;
    case "lengthInvalid":
      return "That length isn't available. Pick how long.";
    case "lengthDoesntFit":
      return `${formatLength(note.minutes)} doesn't fit at that time. Pick how long.`;
  }
}

export function isBookingLinkPath(pathname: string): boolean {
  return pathname === "/booking-link" || pathname === "/booking-link/";
}
