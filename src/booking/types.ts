export type AmenityId = "tennis" | "pickleball" | "clubhouse" | "basketball" | "lounge" | "conference";
export type Amenity = {
  id: AmenityId; name: string; image: string;
  maxMinutes: number; // longest booking allowed (the block limit)
  maxGuests: number;
  open: number;       // opening hour, 0–23
  close: number;      // closing hour, 0–24
  aliases: string[];  // lowercase words the reader matches
};
export type ISODate = string; // local "YYYY-MM-DD"
export type DateRange = { from: ISODate; to: ISODate }; // inclusive
export type TimeOfDay = "morning" | "afternoon" | "evening"; // [open,12) [12,17) [17,close)
export type Draft = {
  amenity?: AmenityId; date?: ISODate; time?: number; minutes?: number; guests: number; // time: minutes since midnight
  range?: DateRange; timeOfDay?: TimeOfDay; find?: boolean;
};
// `time` is the start in minutes since midnight; `minutes` is the length.
export type Booking = { confirmation: string; amenity: AmenityId; date: ISODate; time: number; minutes: number; guests: number };

export type Intent =
  | "book" | "find" | "changeAmenity" | "changeDay" | "changeTime" | "changeLength"
  | "confirm" | "listReservations" | "thanks" | "offTopic" | "unknown";
export type ChangeTarget = "amenity" | "day" | "time" | "length";
export type Interpretation = {
  intent: Intent;
  slots: { amenity?: AmenityId; date?: ISODate; time?: number; minutes?: number; timeOfDay?: TimeOfDay; guests?: number };
  range?: DateRange;
  snappedFrom?: string;    // e.g. "10:15" when the time was snapped down to the half-hour
  ambiguous?: "court";
  outOfWindow?: boolean;
  changeTarget?: ChangeTarget; // "change the time", "different day", "go back": step back like the `back` event
  reply?: string;          // future Claude reader only; v1 never sets it
};

export type Chip = { label: string; event: ChatEvent };
export type Widget =
  | { kind: "amenities" }
  | { kind: "days"; from: ISODate; count: number }
  | { kind: "calendar"; month: ISODate }  // first day of the shown month
  | { kind: "slots"; amenity: AmenityId; date: ISODate; timeOfDay?: TimeOfDay }
  | { kind: "slotList"; amenity: AmenityId; range: DateRange }
  | { kind: "lengths"; amenity: AmenityId; date: ISODate; time: number }
  | { kind: "summary"; amenity: AmenityId; date: ISODate; time: number; minutes: number; guests: number }
  | { kind: "confirmation"; booking: Booking }
  | { kind: "reservations"; bookings: Booking[] }
  | { kind: "chips"; chips: Chip[] };
export type ChatMessage = { id: number; role: "user" | "agent"; text?: string; widget?: Widget; active: boolean };
export type ChatState = {
  now: Date; messages: ChatMessage[]; draft: Draft; bookings: Booking[]; pending: boolean; nextId: number;
  pendingTurn?: number; // id of the user message whose reader result is awaited
};

type BaseEvent =
  | { type: "commonQuestion"; text: string; from?: number } // `from` is set only when sent from a chip
  | { type: "userText"; text: string }                      // echoes text, sets pending; turn = the echo's id
  | { type: "interpreted"; result: Interpretation; turn: number } // ignored unless turn === pendingTurn
  | { type: "interpretFailed"; turn: number }                // ignored unless turn === pendingTurn
  | { type: "pickAmenity"; amenity: AmenityId; from: number } // `from` = id of the widget message tapped
  | { type: "pickDate"; date: ISODate; from: number }
  | { type: "openCalendar"; from: number }
  | { type: "calendarMonth"; month: ISODate; from: number }
  | { type: "pickSlot"; date: ISODate; time: number; from: number }
  | { type: "pickLength"; minutes: number; from: number }
  | { type: "setGuests"; guests: number; from: number }
  | { type: "confirm"; from: number }
  | { type: "change"; from: number }
  | { type: "back"; to: ChangeTarget; from: number }
  | { type: "bookAnother"; from: number }
  | { type: "listReservations"; from: number };
// `now` (optional): the time the event happened. The reducer moves its clock to it, so "today" never goes stale.
export type ChatEvent = BaseEvent & { now?: Date };
