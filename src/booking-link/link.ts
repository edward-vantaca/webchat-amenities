import { AMENITIES } from "@/booking/amenities";
import { hasOpenSlot, slotsFor } from "@/booking/availability";
import { formatHour, fromISODate, inWindow, toISODate } from "@/booking/dates";
import type { AmenityId, Booking, ISODate } from "@/booking/types";

export type Step = "amenity" | "date" | "time" | "review";
export type LinkDraft = { amenity?: AmenityId; date?: ISODate; time?: number };
export type DropNote =
  | { reason: "amenity" }
  | { reason: "date" }
  | { reason: "timeTaken"; time: number }
  | { reason: "timeUnavailable"; time: number };
export type ParsedLink = { token?: string; draft: LinkDraft; note?: DropNote };

const isRealDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && toISODate(fromISODate(s)) === s;

// Reads amenity → date → time in order and stops at the first value that is missing or can't be used.
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
  if (!/^\d{1,2}$/.test(rawTime)) return out({ amenity, date });
  const time = Number(rawTime);
  const slot = slotsFor(amenity, date, bookings, now).find((s) => s.hour === time);
  if (!slot) return out({ amenity, date }, { reason: "timeUnavailable", time });
  if (!slot.open) return out({ amenity, date }, { reason: "timeTaken", time });
  return out({ amenity, date, time });
}

export function toSearch(token: string | undefined, draft: LinkDraft): string {
  const q = new URLSearchParams();
  if (token !== undefined) q.set("token", token);
  if (draft.amenity) q.set("amenity", draft.amenity);
  if (draft.date) q.set("date", draft.date);
  if (draft.time !== undefined) q.set("time", String(draft.time));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function stepOf(draft: LinkDraft): Step {
  if (!draft.amenity) return "amenity";
  if (!draft.date) return "date";
  if (draft.time === undefined) return "time";
  return "review";
}

export function stepBack(draft: LinkDraft): LinkDraft {
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
    case "timeTaken":
      return `${formatHour(note.time)} is taken that day. Pick another time.`;
    case "timeUnavailable":
      return `${formatHour(note.time)} isn't available that day. Pick another time.`;
  }
}

export function isBookingLinkPath(pathname: string): boolean {
  return pathname === "/booking-link" || pathname === "/booking-link/";
}
