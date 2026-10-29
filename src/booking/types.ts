export type AmenityId = "tennis" | "pickleball" | "clubhouse" | "basketball" | "lounge" | "conference";
export type Amenity = {
  id: AmenityId; name: string; image: string;
  hours: number;      // booking length
  maxGuests: number;
  open: number;       // opening hour, 0–23
  close: number;      // closing hour, 0–24
  aliases: string[];  // lowercase words the reader matches
};
export type ISODate = string; // local "YYYY-MM-DD"
export type DateRange = { from: ISODate; to: ISODate }; // inclusive
export type TimeOfDay = "morning" | "afternoon" | "evening"; // [open,12) [12,17) [17,close)
export type Draft = {
  amenity?: AmenityId; date?: ISODate; time?: number; guests: number;
  range?: DateRange; timeOfDay?: TimeOfDay; find?: boolean;
};
export type Booking = { confirmation: string; amenity: AmenityId; date: ISODate; time: number; guests: number };

export type Intent =
  | "book" | "find" | "changeAmenity" | "changeDay" | "changeTime"
  | "confirm" | "listReservations" | "offTopic" | "unknown";
export type Interpretation = {
  intent: Intent;
  slots: { amenity?: AmenityId; date?: ISODate; time?: number; timeOfDay?: TimeOfDay; guests?: number };
  range?: DateRange;
  snappedFrom?: string;    // e.g. "10:30" when the time was snapped to an hour
  ambiguous?: "court";
  outOfWindow?: boolean;
  reply?: string;          // future Claude reader only; v1 never sets it
};

export type Chip = { label: string; event: ChatEvent };
export type Widget =
  | { kind: "amenities" }
  | { kind: "days"; from: ISODate; count: number }
  | { kind: "calendar"; month: ISODate }  // first day of the shown month
  | { kind: "slots"; amenity: AmenityId; date: ISODate; timeOfDay?: TimeOfDay }
  | { kind: "slotList"; amenity: AmenityId; range: DateRange }
  | { kind: "summary"; amenity: AmenityId; date: ISODate; time: number; guests: number }
  | { kind: "confirmation"; booking: Booking }
  | { kind: "reservations"; bookings: Booking[] }
  | { kind: "chips"; chips: Chip[] };
export type ChatMessage = { id: number; role: "user" | "agent"; text?: string; widget?: Widget; active: boolean };
export type ChatState = { now: Date; messages: ChatMessage[]; draft: Draft; bookings: Booking[]; pending: boolean; nextId: number };

export type ChatEvent =
  | { type: "commonQuestion"; text: string }
  | { type: "userText"; text: string }                      // echoes text, sets pending
  | { type: "interpreted"; result: Interpretation }         // clears pending
  | { type: "interpretFailed" }                              // clears pending
  | { type: "pickAmenity"; amenity: AmenityId; from: number } // `from` = id of the widget message tapped
  | { type: "pickDate"; date: ISODate; from: number }
  | { type: "openCalendar"; from: number }
  | { type: "calendarMonth"; month: ISODate; from: number }
  | { type: "pickSlot"; date: ISODate; time: number; from: number }
  | { type: "setGuests"; guests: number; from: number }
  | { type: "confirm"; from: number }
  | { type: "change"; from: number }
  | { type: "back"; to: "amenity" | "day" | "time"; from: number }
  | { type: "bookAnother"; from: number }
  | { type: "listReservations"; from: number };
